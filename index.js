"use strict";

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const http = require("http");
const fs = require("fs").promises;
const path = require("path");

/* ------------------------------------------------------------------ *
 *  Configurazione
 * ------------------------------------------------------------------ */

const configPath = process.env.CONFIG_PATH
  ? path.resolve(process.env.CONFIG_PATH)
  : path.join(__dirname, "config.json");
const config = require(configPath);

// Il fuso orario decide quando scattano le fasce (sera, notte...).
// Ha la precedenza la variabile TZ (impostata nel Dockerfile), poi config.json.
if (!process.env.TZ && config.timezone) {
  process.env.TZ = config.timezone;
}

const {
  buildPlaylist,
  buildPriorityList,
  createVideoEntry,
  isVideoFile,
  validateIntervals,
} = require("./lib/scheduling");

const envFlag = (name) =>
  String(process.env[name] || "").toLowerCase() === "true";
const envNumber = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const port = envNumber("PORT", 1997);
const videoFolder = process.env.VIDEOS_DIR
  ? path.resolve(process.env.VIDEOS_DIR)
  : path.join(__dirname, "videos");
const publicDir = path.join(__dirname, "public");
const videojsDir = path.join(__dirname, "node_modules", "video.js", "dist");
const isProduction = process.env.NODE_ENV === "production";

// ?at=<data> permette di simulare data e ora: solo per i test.
const allowTimeOverride = envFlag("ALLOW_TIME_OVERRIDE");
// Per quanto tempo riusare la scansione delle cartelle.
const scanCacheMs = envNumber("VIDEOS_CACHE_SECONDS", 45) * 1000;

const playlistOptions = {
  length: Number(config.playlist?.length) || 50,
  scheduledWeight: config.playlist?.scheduledWeight ?? 0.6,
  minGap: config.playlist?.minGap ?? 5,
};

const MAX_FOLDER_DEPTH = 8;

validateIntervals(config.namedDateIntervals, config.namedTimeIntervals).forEach(
  (problem) => console.warn(`[config] ${problem}`),
);

/* ------------------------------------------------------------------ *
 *  App e middleware
 * ------------------------------------------------------------------ */

const app = express();

// Dietro un proxy (Caddy, Tailscale Funnel...) imposta TRUST_PROXY=1,
// altrimenti il rate limit vede tutti con lo stesso IP.
if (process.env.TRUST_PROXY) {
  const value = process.env.TRUST_PROXY;
  app.set("trust proxy", /^\d+$/.test(value) ? Number(value) : value);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // 'unsafe-inline' solo per gli stili: Video.js inserisce un <style> dinamico.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "data:"], // Video.js incorpora il font nel CSS
        mediaSrc: ["'self'", "blob:"],
        workerSrc: ["'self'", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);

// Healthcheck: prima dell'autenticazione, così Docker può interrogarlo.
app.get("/health", async (req, res) => {
  const folderOk = await pathExists(videoFolder);
  res
    .status(folderOk ? 200 : 503)
    .json({ status: folderOk ? "ok" : "videos folder missing" });
});

// Password opzionale
if (process.env.AUTH_USER && process.env.AUTH_PASS) {
  app.use(basicAuth(process.env.AUTH_USER, process.env.AUTH_PASS));
}

app.use(
  express.static(publicDir, {
    maxAge: isProduction ? "1h" : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html"))
        res.setHeader("Cache-Control", "no-cache");
    },
  }),
);
app.use(
  "/vendor/videojs",
  express.static(videojsDir, { maxAge: "7d", index: false }),
);
// maxAge: il browser può riusare i pezzi già scaricati (aiuta il precaricamento).
app.use(
  "/video",
  express.static(videoFolder, { maxAge: "1h", index: false, redirect: false }),
);

// Massimo 300 richieste ogni 15 minuti per IP (il player ne fa poche).
const videosLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: envNumber("VIDEOS_RATE_LIMIT", 300),
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/settings", (req, res) => {
  res.json(config.ui || {});
});

app.get("/videos", videosLimiter, async (req, res) => {
  try {
    if (!(await pathExists(videoFolder))) {
      console.error("Video folder does not exist.");
      return res.status(404).json({ error: "Video folder not found" });
    }

    const scheduleDate = getScheduleDate(req);
    const priorities = buildPriorityList({
      date: scheduleDate,
      namedDateIntervals: config.namedDateIntervals,
      namedTimeIntervals: config.namedTimeIntervals,
    });

    const pool = await getCollectedVideos(priorities);
    if (pool.length === 0) {
      console.warn("No videos found in the configured folders.");
      return res.status(404).json({ error: "No videos available" });
    }

    const seed = parseSeed(req.query.seed);
    const videos = buildPlaylist(pool, { ...playlistOptions, seed });

    res.set("Cache-Control", "no-store");
    res.json({
      date: scheduleDate.toISOString(),
      priorities,
      seed,
      total: pool.length,
      scheduled: pool.filter((video) => video.scheduled).length,
      videos,
    });
  } catch (error) {
    console.error("Error reading video folder:", error);
    res.status(500).json({ error: "Could not fetch videos" });
  }
});

app.use((req, res) => {
  res.status(404).send("Not Found");
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  // Gli errori 4xx (range non valido, URL malformato...) non sono guasti del server.
  const status = Number(err.status || err.statusCode) || 500;
  if (status >= 500) console.error(err.stack);
  if (err.headers) res.set(err.headers);
  res
    .status(status)
    .send(
      status >= 500
        ? "Something went wrong!"
        : http.STATUS_CODES[status] || "Error",
    );
});

/* ------------------------------------------------------------------ *
 *  Avvio e spegnimento
 * ------------------------------------------------------------------ */

const server = app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  console.log(
    `Videos: ${videoFolder} | TZ: ${process.env.TZ || "sistema"} | time override: ${allowTimeOverride}`,
  );
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => {
    console.log("Server has been gracefully terminated.");
    process.exit(0);
  });
  server.closeIdleConnections?.();
  // I video in streaming tengono aperte le connessioni: dopo 5 s si chiude comunque.
  setTimeout(() => {
    server.closeAllConnections?.();
    process.exit(0);
  }, 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

/* ------------------------------------------------------------------ *
 *  Funzioni di supporto
 * ------------------------------------------------------------------ */

function basicAuth(user, pass) {
  const digest = (value) => crypto.createHash("sha256").update(value).digest();
  const expectedUser = digest(user);
  const expectedPass = digest(pass);

  return (req, res, next) => {
    const header = req.headers.authorization || "";
    if (header.startsWith("Basic ")) {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator >= 0) {
        const userOk = crypto.timingSafeEqual(
          digest(decoded.slice(0, separator)),
          expectedUser,
        );
        const passOk = crypto.timingSafeEqual(
          digest(decoded.slice(separator + 1)),
          expectedPass,
        );
        if (userOk && passOk) return next();
      }
    }
    res.set("WWW-Authenticate", 'Basic realm="Fratch TV", charset="UTF-8"');
    return res.status(401).send("Authentication required");
  };
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function getScheduleDate(req) {
  const override = req.query.at;
  if (!allowTimeOverride || typeof override !== "string") {
    return new Date();
  }
  const parsed = new Date(override);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function parseSeed(value) {
  if (typeof value === "string" && /^\d{1,10}$/.test(value)) {
    const seed = Number(value);
    if (seed <= 4294967295) return seed;
  }
  return crypto.randomInt(0, 4294967296);
}

/* ---------------------- scansione con cache ---------------------- */

const scanCache = new Map(); // chiave = priorità -> { expires, promise }

function getCollectedVideos(priorities) {
  const key = priorities.join("|");
  const now = Date.now();

  const hit = scanCache.get(key);
  if (hit && hit.expires > now) return hit.promise;

  for (const [cachedKey, entry] of scanCache) {
    if (entry.expires <= now) scanCache.delete(cachedKey);
  }

  const promise = collectVideos(videoFolder, priorities);
  scanCache.set(key, { expires: now + scanCacheMs, promise });
  promise.catch(() => scanCache.delete(key)); // gli errori non si memorizzano
  return promise;
}

async function collectVideos(rootFolder, priorities) {
  const results = [];
  const seen = new Set();

  for (const priority of priorities) {
    const scheduled = priority !== "default";
    const entries = scheduled
      ? await readVideosFromFolder(path.join(rootFolder, priority), priority)
      : await readDefaultVideos(rootFolder);

    for (const entry of entries) {
      if (!seen.has(entry.relativePath)) {
        seen.add(entry.relativePath);
        results.push({ ...entry, scheduled });
      }
    }
  }

  return results;
}

// Fallback: videos/default/ (ricorsivo) + file sciolti nella radice di videos/ (non ricorsivo)
async function readDefaultVideos(rootFolder) {
  const nested = await readVideosFromFolder(
    path.join(rootFolder, "default"),
    "default",
  );

  const rootEntries = await fs.readdir(rootFolder, { withFileTypes: true });
  const loose = [];
  for (const entry of rootEntries) {
    if (entry.name.startsWith(".") || !isVideoFile(entry.name)) continue;
    const { isFile } = await classifyEntry(
      entry,
      path.join(rootFolder, entry.name),
    );
    if (isFile) loose.push(createVideoEntry("/video", entry.name));
  }

  return [...nested, ...loose];
}

async function readVideosFromFolder(folderPath, relativeBase) {
  try {
    const stats = await fs.stat(folderPath); // segue i symlink
    if (!stats.isDirectory()) {
      return [];
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return walkVideoFiles(folderPath, relativeBase, new Set(), 0);
}

// Dirent.isDirectory()/isFile() non seguono i symlink: li risolviamo con stat().
async function classifyEntry(entry, entryPath) {
  if (entry.isSymbolicLink()) {
    try {
      const stats = await fs.stat(entryPath);
      return { isDirectory: stats.isDirectory(), isFile: stats.isFile() };
    } catch {
      return { isDirectory: false, isFile: false }; // symlink rotto
    }
  }
  return { isDirectory: entry.isDirectory(), isFile: entry.isFile() };
}

async function walkVideoFiles(folderPath, relativeBase, visited, depth) {
  if (depth > MAX_FOLDER_DEPTH) return [];

  let realFolder;
  try {
    realFolder = await fs.realpath(folderPath);
  } catch {
    return [];
  }
  if (visited.has(realFolder)) return []; // evita i cicli causati dai symlink
  visited.add(realFolder);

  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const videos = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // file nascosti (.DS_Store, ._file.mp4)
    const entryPath = path.join(folderPath, entry.name);
    const relativePath = path.join(relativeBase, entry.name);
    const { isDirectory, isFile } = await classifyEntry(entry, entryPath);

    if (isDirectory) {
      videos.push(
        ...(await walkVideoFiles(entryPath, relativePath, visited, depth + 1)),
      );
    } else if (isFile && isVideoFile(entry.name)) {
      videos.push(createVideoEntry("/video", relativePath));
    }
  }

  return videos;
}