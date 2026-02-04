const path = require('path');

const DEFAULT_VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.webm'];

function normalizeExtensions(extensions = DEFAULT_VIDEO_EXTENSIONS) {
  return extensions.map((ext) => (ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`));
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date - start;
  return Math.floor(diff / 86400000) + 1;
}

function parseMonthDay(value) {
  const [month, day] = value.split('-').map(Number);
  return { month, day };
}

function isDateWithinInterval(date, start, end) {
  const year = date.getFullYear();
  const startDate = new Date(year, start.month - 1, start.day);
  const endDate = new Date(year, end.month - 1, end.day);

  if (startDate <= endDate) {
    return date >= startDate && date <= endDate;
  }

  return date >= startDate || date <= endDate;
}

function parseTime(value) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function isTimeWithinInterval(date, start, end) {
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  if (start <= end) {
    return currentMinutes >= start && currentMinutes <= end;
  }
  return currentMinutes >= start || currentMinutes <= end;
}

function matchesNamedDateIntervals(date, intervals = []) {
  return intervals.filter((interval) => {
    const start = parseMonthDay(interval.start);
    const end = parseMonthDay(interval.end);
    return isDateWithinInterval(date, start, end);
  });
}

function matchesNamedTimeIntervals(date, intervals = []) {
  return intervals.filter((interval) => {
    const start = parseTime(interval.start);
    const end = parseTime(interval.end);
    return isTimeWithinInterval(date, start, end);
  });
}

function buildPriorityList({ date, namedDateIntervals, namedTimeIntervals }) {
  const dateMatches = matchesNamedDateIntervals(date, namedDateIntervals).map((interval) => interval.name);
  const timeMatches = matchesNamedTimeIntervals(date, namedTimeIntervals).map((interval) => interval.name);

  return [
    ...dateMatches.flatMap((dateName) => timeMatches.map((timeName) => `${dateName}/${timeName}`)),
    ...dateMatches,
    ...timeMatches,
    'default',
  ];
}

function isVideoFile(filename, extensions = DEFAULT_VIDEO_EXTENSIONS) {
  const normalizedExtensions = normalizeExtensions(extensions);
  return normalizedExtensions.some((extension) => filename.toLowerCase().endsWith(extension));
}

function toVideoUrl(baseRoute, relativePath) {
  const normalized = relativePath.split(path.sep).join('/');
  const encoded = normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${baseRoute}/${encoded}`;
}

function createVideoEntry(baseRoute, relativePath) {
  const filename = path.basename(relativePath);
  return {
    filename,
    relativePath,
    url: toVideoUrl(baseRoute, relativePath),
  };
}

function sortByDeterministicShuffle(videos, date = new Date()) {
  const daySeed = getDayOfYear(date);
  return [...videos]
    .map((video, index) => ({ video, score: ((index + 1) * 9301 + daySeed * 49297) % 233280 }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.video);
}

module.exports = {
  buildPriorityList,
  createVideoEntry,
  isVideoFile,
  sortByDeterministicShuffle,
};
