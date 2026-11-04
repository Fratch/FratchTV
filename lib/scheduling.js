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
 * Un "ciclo" contiene ogni video del pool esattamente una volta.
 * I video di palinsesto sono distribuiti a intervalli regolari: il ciclo è
 * diviso in tante fasce quanti sono, e ognuno finisce nella parte centrale
 * della sua fascia (posizione casuale, mai sul bordo). I posti restanti
 * sono riempiti dal fallback rimescolato.
 * `prev` è il ciclo precedente: serve a non far tornare subito un fallback
 * appena uscito a cavallo tra due cicli.
 */
function buildCycle(scheduled, fallback, random, prev, gap) {
  const total = scheduled.length + fallback.length;
  const slots = new Array(total).fill(null);

  if (scheduled.length > 0) {
    const width = total / scheduled.length;
    shuffleWithRandom(scheduled, random).forEach((video, i) => {
      let pos = Math.min(
        total - 1,
        Math.floor((i + 0.25 + 0.5 * random()) * width),
      );
      while (slots[pos]) pos = (pos + 1) % total; // posto occupato (pool piccoli)
      slots[pos] = video;
    });
  }

  const shuffledFallback = shuffleWithRandom(fallback, random);
  let next = 0;
  for (let pos = 0; pos < total; pos += 1) {
    if (!slots[pos]) slots[pos] = shuffledFallback[next++];
  }

  // Giunzione tra due cicli: un fallback tra gli ultimi `gap` del ciclo
  // precedente non deve riapparire nei primi `gap` posti di questo.
  if (prev && gap > 0) {
    const tail = new Set(prev.slice(-gap).map((v) => v.url));
    for (let i = 0; i < Math.min(gap, total); i += 1) {
      if (slots[i].scheduled || !tail.has(slots[i].url)) continue;
      for (let j = gap; j < total; j += 1) {
        if (!slots[j].scheduled && !tail.has(slots[j].url)) {
          [slots[i], slots[j]] = [slots[j], slots[i]];
          break;
        }
      }
    }
  }

  return slots;
}

/**
 * Costruisce la scaletta come sequenza di cicli completi.
 * - Ogni video esce una volta per ciclo, quindi nessuno si ripete prima che
 *   tutti gli altri (specifici e fallback) siano usciti.
 * - `length` è la lunghezza minima: si generano cicli finché la si raggiunge.
 * - Con `wholeCycles: true` l'ultimo ciclo non viene tagliato (lo usa il server,
 *   così il player riceve sempre giri completi). Altrimenti si taglia a `length`.
 * - `scheduledWeight` non è più usato: la frequenza dei video specifici
 *   dipende solo da quanti sono rispetto al totale.
 */
function buildPlaylist(videos, options = {}) {
  const { seed = 1, length = 50, minGap = 5, wholeCycles = false } = options;
  if (!Array.isArray(videos) || videos.length === 0 || !(length > 0)) return [];

  const gap = Math.max(0, Math.floor(Number(minGap)) || 0);
  const random = createRandom(seed);
  const scheduled = videos.filter((video) => video.scheduled);
  const fallback = videos.filter((video) => !video.scheduled);

  const playlist = [];
  let prev = null;
  while (playlist.length < length) {
    prev = buildCycle(scheduled, fallback, random, prev, gap);
    playlist.push(...prev);
  }
  return wholeCycles ? playlist : playlist.slice(0, length);
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
