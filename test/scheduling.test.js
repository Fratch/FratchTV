const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPriorityList,
  createVideoEntry,
  isVideoFile,
  sortByDeterministicShuffle,
} = require('../lib/scheduling');

test('buildPriorityList orders date/time priorities and includes default', () => {
  const date = new Date('2024-12-24T20:00:00.000Z');
  const priorities = buildPriorityList({
    date,
    namedDateIntervals: [{ name: 'natale', start: '12-01', end: '12-26' }],
    namedTimeIntervals: [{ name: 'sera', start: '18:00', end: '21:59' }],
  });

  assert.deepEqual(priorities, ['natale/sera', 'natale', 'sera', 'default']);
});

test('isVideoFile matches common video extensions', () => {
  assert.equal(isVideoFile('movie.mp4'), true);
  assert.equal(isVideoFile('movie.MKV'), true);
  assert.equal(isVideoFile('document.pdf'), false);
});

test('createVideoEntry builds encoded URLs', () => {
  const entry = createVideoEntry('/video', 'sera/festività video.mp4');
  assert.equal(entry.filename, 'festività video.mp4');
  assert.equal(entry.relativePath, 'sera/festività video.mp4');
  assert.equal(entry.url, '/video/sera/festivit%C3%A0%20video.mp4');
});

test('sortByDeterministicShuffle is deterministic per date', () => {
  const date = new Date('2024-11-01T10:00:00.000Z');
  const videos = [{ filename: 'a' }, { filename: 'b' }, { filename: 'c' }];

  const first = sortByDeterministicShuffle(videos, date).map((video) => video.filename);
  const second = sortByDeterministicShuffle(videos, date).map((video) => video.filename);

  assert.deepEqual(first, second);
});
