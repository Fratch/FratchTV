"use strict";

const path = require("path");

const DEFAULT_VIDEO_EXTENSIONS = [".mp4", ".avi", ".mkv", ".webm"];

const MONTH_DAY_RE = /^(\d{1,2})-(\d{1,2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/* ------------------------------------------------------------------ *
 *  Estensioni e URL
 * ------------------------------------------------------------------ */

function normalizeExtensions(extensions = DEFAULT_VIDEO_EXTENSIONS) {
  return extensions.map((ext) =>
    ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`,
  );
}

function isVideoFile(filename, extensions = DEFAULT_VIDEO_EXTENSIONS) {
  const lower = filename.toLowerCase();
  return normalizeExtensions(extensions).some((extension) =>
    lower.endsWith(extension),
  );
}

function toVideoUrl(baseRoute, relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  const encoded = normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${baseRoute}/${encoded}`;
}

function createVideoEntry(baseRoute, relativePath) {
  return {
    filename: path.basename(relativePath),
    relativePath,
    url: toVideoUrl(baseRoute, relativePath),
  };
}

/* ------------------------------------------------------------------ *
 *  Intervalli di data e ora
 * ------------------------------------------------------------------ */

/** "MM-DD" -> { month, day } oppure null se il formato non è valido. */
function parseMonthDay(value) {
  const match = MONTH_DAY_RE.exec(String(value).trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

/** "HH:MM" -> minuti dalla mezzanotte oppure null se il formato non è valido. */
function parseTime(value) {
  const match = TIME_RE.exec(String(value).trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * La data cade nell'intervallo? Il giorno finale è incluso per intero.
 * Si confrontano mese e giorno come numeri (MMDD): niente oggetti Date,
 * quindi niente problemi con fuso orario, ora legale o anni bisestili.
 * Se l'inizio è dopo la fine l'intervallo scavalca il capodanno.
 */
function isDateWithinInterval(date, start, end) {
  const current = (date.getMonth() + 1) * 100 + date.getDate();
  const from = start.month * 100 + start.day;
  const to = end.month * 100 + end.day;
  return from <= to
    ? current >= from && current <= to
    : current >= from || current <= to;
}

/** Fascia oraria in minuti, estremi inclusi. Se inizio > fine scavalca la mezzanotte. */
function isTimeWithinInterval(date, start, end) {
  const current = date.getHours() * 60 + date.getMinutes();
  return start <= end
    ? current >= start && current <= end
    : current >= start || current <= end;
}

function isActive(interval) {
  return Boolean(interval) && interval.enabled !== false;
}

function matchesNamedDateIntervals(date, intervals = []) {
  return intervals.filter((interval) => {
    if (!isActive(interval)) return false;
    const start = parseMonthDay(interval.start);
    const end = parseMonthDay(interval.end);
    return Boolean(start && end) && isDateWithinInterval(date, start, end);
  });
}

function matchesNamedTimeIntervals(date, intervals = []) {
  return intervals.filter((interval) => {
    if (!isActive(interval)) return false;
    const start = parseTime(interval.start);
    const end = parseTime(interval.end);
    return (
      start !== null && end !== null && isTimeWithinInterval(date, start, end)
    );
  });
}

/** Elenco di messaggi sugli intervalli non validi (da mostrare all'avvio). */
function validateIntervals(namedDateIntervals = [], namedTimeIntervals = []) {
  const problems = [];
  namedDateIntervals.forEach((interval) => {
    if (!interval || !interval.name)
      problems.push('Intervallo data senza "name".');
    else if (!parseMonthDay(interval.start) || !parseMonthDay(interval.end)) {
      problems.push(
        `Intervallo data "${interval.name}": usa il formato MM-GG (es. "12-25").`,
      );
    }
  });
  namedTimeIntervals.forEach((interval) => {
    if (!interval || !interval.name)
      problems.push('Intervallo orario senza "name".');
    else if (
      parseTime(interval.start) === null ||
      parseTime(interval.end) === null
    ) {
      problems.push(
        `Intervallo orario "${interval.name}": usa il formato HH:MM (es. "18:30").`,
      );
    }
  });
  return problems;
}

/**
 * Cartelle da leggere, dalla più specifica alla meno specifica:
 * data/ora, data, ora, default.
 */
function buildPriorityList({ date, namedDateIntervals, namedTimeIntervals }) {
  const dateMatches = matchesNamedDateIntervals(date, namedDateIntervals).map(
    (interval) => interval.name,
  );
  const timeMatches = matchesNamedTimeIntervals(date, namedTimeIntervals).map(
    (interval) => interval.name,
  );

  return [
    ...dateMatches.flatMap((dateName) =>
      timeMatches.map((timeName) => `${dateName}/${timeName}`),
    ),
    ...dateMatches,
    ...timeMatches,
    "default",
  ];
}

/* ------------------------------------------------------------------ *
 *  Scaletta pesata
 * ------------------------------------------------------------------ */

/** Generatore pseudo-casuale con seme (mulberry32): stesso seme, stessa sequenza. */
function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates con generatore esterno. Non modifica l'array di partenza. */
function shuffleWithRandom(items, random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * "Sacchetto" di video: li estrae tutti una volta, poi si rimescola.
 * Al rimescolamento gli ultimi `gap` video usciti vengono messi in coda,
 * così nessun video torna prima di almeno `gap` altri dello stesso gruppo.
 */
function createBag(items, random, gap) {
  const keep = Math.max(0, Math.min(gap, items.length - 1));
  let bag = [];
  let played = [];

  return {
    next() {
      if (bag.length === 0) {
        let fresh = shuffleWithRandom(items, random);
        if (keep > 0 && played.length > 0) {
          const tail = played.slice(-keep);
          const tailUrls = new Set(tail.map((video) => video.url));
          fresh = fresh
            .filter((video) => !tailUrls.has(video.url))
            .concat(tail);
        }
        bag = fresh;
        played = [];
      }
      const video = bag.shift();
      played.push(video);
      return video;
    },
  };
}

/**
 * Costruisce la scaletta: a ogni posto sceglie con probabilità `scheduledWeight`
 * un video dalle cartelle di palinsesto (video.scheduled === true), altrimenti
 * dal fallback. Dentro ogni gruppo nessun video si ripete finché non sono usciti
 * gli altri. Seed uguale -> scaletta uguale.
 */
function buildPlaylist(videos, options = {}) {
  const { seed = 1, length = 50, scheduledWeight = 0.6, minGap = 5 } = options;
  if (!Array.isArray(videos) || videos.length === 0 || !(length > 0)) return [];

  const weight = Math.min(1, Math.max(0, Number(scheduledWeight)));
  const gap = Math.max(0, Math.floor(Number(minGap)) || 0);
  const random = createRandom(seed);

  const scheduled = videos.filter((video) => video.scheduled);
  const fallback = videos.filter((video) => !video.scheduled);
  const scheduledBag = scheduled.length
    ? createBag(scheduled, random, gap)
    : null;
  const fallbackBag = fallback.length ? createBag(fallback, random, gap) : null;

  const playlist = [];
  for (let i = 0; i < length; i += 1) {
    let useScheduled;
    if (!fallbackBag) useScheduled = true;
    else if (!scheduledBag) useScheduled = false;
    else useScheduled = random() < weight;
    playlist.push((useScheduled ? scheduledBag : fallbackBag).next());
  }
  return playlist;
}

module.exports = {
  DEFAULT_VIDEO_EXTENSIONS,
  buildPlaylist,
  buildPriorityList,
  createRandom,
  createVideoEntry,
  isDateWithinInterval,
  isTimeWithinInterval,
  isVideoFile,
  matchesNamedDateIntervals,
  matchesNamedTimeIntervals,
  parseMonthDay,
  parseTime,
  shuffleWithRandom,
  validateIntervals,
};
