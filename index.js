const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const port = process.env.PORT || 1997;
const videoFolder = process.env.VIDEOS_DIR
  ? path.resolve(process.env.VIDEOS_DIR)
  : path.join(__dirname, "videos");
const configPath = path.join(__dirname, "config.json");
const config = require(configPath);
const {
  buildPriorityList,
  createVideoEntry,
  isVideoFile,
  sortByDeterministicShuffle,
} = require("./lib/scheduling");

app.use(cors());
app.use(express.static("public"));
app.use("/video", express.static(videoFolder));

// Set up rate limiter: maximum 100 requests per 15 minutes per IP
const videosLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Set up rate limiter for root route: maximum 100 requests per 15 minutes per IP
const rootLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/", rootLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/videos", videosLimiter, async (req, res) => {
  try {
    const folderExists = await fs
      .access(videoFolder)
      .then(() => true)
      .catch(() => false);
    if (!folderExists) {
      console.error("Video folder does not exist.");
      return res.status(404).json({ error: "Video folder not found" });
    }

    const scheduleDate = getScheduleDate(req);
    const priorities = buildPriorityList({
      date: scheduleDate,
      namedDateIntervals: config.namedDateIntervals,
      namedTimeIntervals: config.namedTimeIntervals,
    });

    const collectedVideos = await collectVideos(videoFolder, priorities);
    if (collectedVideos.length === 0) {
      console.warn("No videos found in the configured folders.");
      return res.status(404).json({ error: "No videos available" });
    }

    const shuffledVideos = sortByDeterministicShuffle(
      collectedVideos,
      scheduleDate,
    );
    res.json({
      date: scheduleDate.toISOString(),
      priorities,
      total: shuffledVideos.length,
      videos: shuffledVideos,
    });
  } catch (error) {
    console.error("Error reading video folder:", error);
    res.status(500).json({ error: "Could not fetch videos" });
  }
});

app.get("/settings", (req, res) => {
  res.json(config.ui || {});
});

const server = app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

process.on("SIGINT", () => {
  console.log("Server is shutting down...");
  server.close(() => {
    console.log("Server has been gracefully terminated.");
    process.exit(0);
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong!");
});

app.use((req, res) => {
  res.status(404).send("Not Found");
});

async function collectVideos(rootFolder, priorities) {
  const results = [];
  const seen = new Set();

  for (const priority of priorities) {
    const entries =
      priority === "default"
        ? await readDefaultVideos(rootFolder)
        : await readVideosFromFolder(path.join(rootFolder, priority), priority);

    for (const entry of entries) {
      if (!seen.has(entry.relativePath)) {
        seen.add(entry.relativePath);
        results.push(entry);
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
  const loose = rootEntries
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.name.startsWith(".") &&
        isVideoFile(entry.name),
    )
    .map((entry) => createVideoEntry("/video", entry.name));

  return [...nested, ...loose];
}

async function readVideosFromFolder(folderPath, relativeBase) {
  try {
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      return [];
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return walkVideoFiles(folderPath, relativeBase);
}

async function walkVideoFiles(folderPath, relativeBase) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const videos = [];

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);
    const relativePath = path.join(relativeBase, entry.name);
    if (entry.isDirectory()) {
      const nestedVideos = await walkVideoFiles(entryPath, relativePath);
      videos.push(...nestedVideos);
    } else if (entry.isFile() && isVideoFile(entry.name)) {
      videos.push(createVideoEntry("/video", relativePath));
    }
  }

  return videos;
}

function getScheduleDate(req) {
  const override = req.query.at;
  if (!override) {
    return new Date();
  }

  const parsed = new Date(override);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}
