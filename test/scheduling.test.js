const test = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('../lib/scheduling');

// Date create con il costruttore locale: i test non dipendono dal fuso del computer.
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const interval = (start, end) => [parseMonthDay(start), parseMonthDay(end)];

/* ------------------------------ priorità ------------------------------ */

test('buildPriorityList orders date/time priorities and includes default', () => {
  const priorities = buildPriorityList({
    date: at(2024, 12, 24, 20, 0),
    namedDateIntervals: [{ name: 'natale', start: '12-01', end: '12-26' }],
    namedTimeIntervals: [{ name: 'sera', start: '18:00', end: '21:59' }],
  });
  assert.deepEqual(priorities, ['natale/sera', 'natale', 'sera', 'default']);
});

test('buildPriorityList combines every matching date with every matching time', () => {
  const priorities = buildPriorityList({
    date: at(2026, 12, 24, 20, 0),
    namedDateIntervals: [
      { name: 'inverno', start: '12-21', end: '03-19' },
      { name: 'natale', start: '12-01', end: '12-26' },
    ],
    namedTimeIntervals: [{ name: 'sera', start: '18:00', end: '21:59' }],
  });
  assert.deepEqual(priorities, ['inverno/sera', 'natale/sera', 'inverno', 'natale', 'sera', 'default']);
});

test('buildPriorityList falls back to default when nothing matches', () => {
  const priorities = buildPriorityList({
    date: at(2026, 5, 10, 3, 0),
    namedDateIntervals: [{ name: 'natale', start: '12-01', end: '12-26' }],
    namedTimeIntervals: [{ name: 'sera', start: '18:00', end: '21:59' }],
  });
  assert.deepEqual(priorities, ['default']);
});

/* --------------------------- intervalli di data --------------------------- */

test('date interval includes the whole last day (halloween 31 ottobre)', () => {
  const [start, end] = interval('10-30', '10-31');
  assert.equal(isDateWithinInterval(at(2026, 10, 30, 0, 0), start, end), true);
  assert.equal(isDateWithinInterval(at(2026, 10, 31, 10, 0), start, end), true);
  assert.equal(isDateWithinInterval(at(2026, 10, 31, 23, 59), start, end), true);
  assert.equal(isDateWithinInterval(at(2026, 11, 1, 0, 0), start, end), false);
  assert.equal(isDateWithinInterval(at(2026, 10, 29, 23, 59), start, end), false);
});

test('single-day interval (start === end) matches the whole day only', () => {
  const [start, end] = interval('02-14', '02-14');
  assert.equal(isDateWithinInterval(at(2026, 2, 14, 0, 0), start, end), true);
  assert.equal(isDateWithinInterval(at(2026, 2, 14, 12, 0), start, end), true);
  assert.equal(isDateWithinInterval(at(2026, 2, 14, 23, 59), start, end), true);
  assert.equal(isDateWithinInterval(at(2026, 2, 13, 23, 59), start, end), false);
  assert.equal(isDateWithinInterval(at(2026, 2, 15, 0, 0), start, end), false);
});

test('interval wrapping the new year (inverno 21 dic - 19 mar)', () => {
  const [start, end] = interval('12-21', '03-19');
  assert.equal(isDateWithinInterval(at(2026, 12, 20, 12, 0), start, end), false);
  assert.equal(isDateWithinInterval(at(2026, 12, 21, 0, 0), start, end), true);
  assert.equal(isDateWithinInterval(at(2026, 12, 31, 23, 59), start, end), true);
  assert.equal(isDateWithinInterval(at(2027, 1, 1, 0, 0), start, end), true);
  assert.equal(isDateWithinInterval(at(2027, 3, 19, 18, 0), start, end), true);
  assert.equal(isDateWithinInterval(at(2027, 3, 20, 0, 0), start, end), false);
  assert.equal(isDateWithinInterval(at(2026, 7, 1, 12, 0), start, end), false);
});

test('leap day is handled', () => {
  const [start, end] = interval('02-28', '03-01');
  assert.equal(isDateWithinInterval(at(2028, 2, 29, 12, 0), start, end), true);
  assert.equal(isDateWithinInterval(at(2028, 3, 2, 0, 0), start, end), false);
});

/* --------------------------- fasce orarie --------------------------- */

test('time interval has inclusive bounds', () => {
  const start = parseTime('18:00');
  const end = parseTime('21:59');
  assert.equal(isTimeWithinInterval(at(2026, 1, 1, 17, 59), start, end), false);
  assert.equal(isTimeWithinInterval(at(2026, 1, 1, 18, 0), start, end), true);
  assert.equal(isTimeWithinInterval(at(2026, 1, 1, 21, 59), start, end), true);
  assert.equal(isTimeWithinInterval(at(2026, 1, 1, 22, 0), start, end), false);
});

test('time interval wrapping midnight (notte 22:00 - 05:59)', () => {
  const start = parseTime('22:00');
  const end = parseTime('05:59');
  assert.equal(isTimeWithinInterval(at(2026, 1, 1, 21, 59), start, end), false);
  assert.equal(isTimeWithinInterval(at(2026, 1, 1, 22, 0), start, end), true);
  assert.equal(isTimeWithinInterval(at(2026, 1, 1, 23, 30), start, end), true);
  assert.equal(isTimeWithinInterval(at(2026, 1, 1, 0, 0), start, end), true);
  assert.equal(isTimeWithinInterval(at(2026, 1, 1, 5, 59), start, end), true);
  assert.equal(isTimeWithinInterval(at(2026, 1, 1, 6, 0), start, end), false);
});

test('single-minute time interval matches exactly that minute', () => {
  const start = parseTime('12:00');
  assert.equal(isTimeWithinInterval(at(2026, 1, 1, 12, 0), start, start), true);
  assert.equal(isTimeWithinInterval(at(2026, 1, 1, 12, 1), start, start), false);
});

/* ------------------------ validazione e config ------------------------ */

test('invalid or disabled intervals never match', () => {
  const date = at(2026, 12, 24, 20, 0);
  assert.deepEqual(matchesNamedDateIntervals(date, [{ name: 'x', start: 'MM-GG', end: '12-26' }]), []);
  assert.deepEqual(matchesNamedDateIntervals(date, [{ name: 'x', start: '13-01', end: '12-26' }]), []);
  assert.deepEqual(matchesNamedDateIntervals(date, [{ name: 'x', start: '12-01', end: '12-26', enabled: false }]), []);
  assert.deepEqual(matchesNamedTimeIntervals(date, [{ name: 'x', start: '25:00', end: '21:59' }]), []);
  assert.deepEqual(matchesNamedTimeIntervals(date, [{ name: 'x', start: '18:00', end: '21:59', enabled: false }]), []);
});

test('validateIntervals reports malformed entries', () => {
  assert.deepEqual(
    validateIntervals(
      [{ name: 'ok', start: '12-01', end: '12-26' }],
      [{ name: 'sera', start: '18:00', end: '21:59' }],
    ),
    [],
  );
  const problems = validateIntervals(
    [{ name: 'compleanno', start: 'MM-GG', end: 'MM-GG' }],
    [{ name: 'sera', start: '18', end: '21:59' }],
  );
  assert.equal(problems.length, 2);
  assert.match(problems[0], /compleanno/);
  assert.match(problems[1], /sera/);
});

/* ------------------------------- file ------------------------------- */

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

/* ------------------------- random e scaletta ------------------------- */

const makeVideos = (count, scheduled, prefix) =>
  Array.from({ length: count }, (_, i) => ({ url: `/video/${prefix}${i}.mp4`, scheduled }));

test('createRandom is deterministic and stays in [0, 1)', () => {
  const a = createRandom(123);
  const b = createRandom(123);
  const c = createRandom(124);
  const seqA = Array.from({ length: 20 }, () => a());
  const seqB = Array.from({ length: 20 }, () => b());
  const seqC = Array.from({ length: 20 }, () => c());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  assert.ok(seqA.every((n) => n >= 0 && n < 1));
});

test('shuffleWithRandom returns a permutation and leaves the input untouched', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const output = shuffleWithRandom(input, createRandom(7));
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...output].sort((x, y) => x - y), input);
});

test('buildPlaylist is deterministic per seed and differs between seeds', () => {
  const pool = [...makeVideos(7, true, 's'), ...makeVideos(40, false, 'f')];
  const a = buildPlaylist(pool, { seed: 1, length: 60 }).map((v) => v.url);
  const b = buildPlaylist(pool, { seed: 1, length: 60 }).map((v) => v.url);
  const c = buildPlaylist(pool, { seed: 2, length: 60 }).map((v) => v.url);
  assert.equal(a.length, 60);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('buildPlaylist respects the scheduled/fallback weight', () => {
  const pool = [...makeVideos(7, true, 's'), ...makeVideos(90, false, 'f')];
  const playlist = buildPlaylist(pool, { seed: 42, length: 4000, scheduledWeight: 0.6 });
  const ratio = playlist.filter((v) => v.scheduled).length / playlist.length;
  assert.ok(ratio > 0.57 && ratio < 0.63, `ratio fuori tolleranza: ${ratio}`);
});

test('buildPlaylist never repeats a video within minGap plays (large pools)', () => {
  const pool = [...makeVideos(7, true, 's'), ...makeVideos(90, false, 'f')];
  const playlist = buildPlaylist(pool, { seed: 99, length: 1500, minGap: 5 });
  playlist.forEach((video, index) => {
    for (let back = 1; back <= 5 && index - back >= 0; back += 1) {
      assert.notEqual(video.url, playlist[index - back].url, `ripetizione a distanza ${back} (posto ${index})`);
    }
  });
});

test('buildPlaylist covers the whole scheduled pool before repeating inside it', () => {
  const pool = [...makeVideos(7, true, 's'), ...makeVideos(30, false, 'f')];
  const playlist = buildPlaylist(pool, { seed: 5, length: 400 });
  const scheduledOnly = playlist.filter((v) => v.scheduled).map((v) => v.url);
  for (let i = 0; i + 7 <= scheduledOnly.length; i += 7) {
    assert.equal(new Set(scheduledOnly.slice(i, i + 7)).size, 7);
  }
});

test('buildPlaylist handles empty, single-group and single-video pools', () => {
  assert.deepEqual(buildPlaylist([], { seed: 1 }), []);

  const onlyFallback = buildPlaylist(makeVideos(10, false, 'f'), { seed: 1, length: 30 });
  assert.equal(onlyFallback.length, 30);
  assert.ok(onlyFallback.every((v) => !v.scheduled));

  const onlyScheduled = buildPlaylist(makeVideos(10, true, 's'), { seed: 1, length: 30 });
  assert.ok(onlyScheduled.every((v) => v.scheduled));

  const single = buildPlaylist(makeVideos(1, false, 'f'), { seed: 1, length: 5 });
  assert.equal(single.length, 5);
  assert.equal(new Set(single.map((v) => v.url)).size, 1);
});

/* -------------------------------------------------------------------------- */
/* NUOVI TEST INTEGRATI: Controllo pesi eccessivi e cartella notte / specifici  */
/* -------------------------------------------------------------------------- */

test('buildPlaylist does not cluster all scheduled (notte) videos at the very beginning', () => {
  // Simuliamo un pool con pochi video specifici (es. notte) e molti di default
  const notteVideos = makeVideos(5, true, 'notte/');
  const defaultVideos = makeVideos(30, false, 'default/');
  const pool = [...notteVideos, ...defaultVideos];

  const playlist = buildPlaylist(pool, { seed: 123, length: 50 });

  // Controlliamo i primi 6 video generati all'accensione
  const firstSix = playlist.slice(0, 6);
  const scheduledCountInFirstSix = firstSix.filter((v) => v.scheduled).length;

  // Se i pesi fossero sbilanciati in blocco, troveremmo quasi tutti i video scheduled all'inizio.
  // Con una corretta distribuzione e shuffle, non dovrebbero saturare interamente l'avvio.
  assert.ok(
    scheduledCountInFirstSix < 6,
    `I video specifici (notte) sono troppo pesanti e si ammassano tutti all'inizio: ${scheduledCountInFirstSix}/6`
  );
});

test('unique pool generation prevents duplicate entries when folder hierarchies overlap', () => {
  const duplicateEntry = { url: '/video/notte/shared.mp4', scheduled: true };
  
  // Simuliamo la deduplicazione a monte (tramite Set o filter) tipica della fusione cartelle
  const rawPool = [duplicateEntry, duplicateEntry, ...makeVideos(10, false, 'default/')];
  const uniquePool = Array.from(new Map(rawPool.map(v => [v.url, v])).values());

  const playlist = buildPlaylist(uniquePool, { seed: 77, length: 20 });
  
  // Verifica che non ci siano ripetizioni consecutive immediate nella playlist pulita
  for (let i = 1; i < playlist.length; i++) {
    if (playlist[i].url === playlist[i - 1].url) {
      assert.fail(`Trovata ripetizione consecutiva immediata del video: ${playlist[i].url} alla posizione ${i}`);
    }
  }
});