"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPriorityList,
  createRandom,
  createVideoEntry,
  isVideoFile,
  matchesNamedDateIntervals,
  matchesNamedTimeIntervals,
  parseMonthDay,
  parseTime,
  shuffleWithRandom,
  validateIntervals,
} = require("../lib/scheduling");

/* ------------------------------------------------------------------ *
 *  parseMonthDay / parseTime — validazione dei formati
 * ------------------------------------------------------------------ */

test("parseMonthDay accetta MM-GG e rifiuta formati non validi", () => {
  assert.deepEqual(parseMonthDay("12-25"), { month: 12, day: 25 });
  assert.deepEqual(parseMonthDay("1-1"), { month: 1, day: 1 });
  assert.deepEqual(parseMonthDay(" 06-01 "), { month: 6, day: 1 });

  assert.equal(parseMonthDay("13-01"), null); // mese > 12
  assert.equal(parseMonthDay("00-01"), null); // mese 0
  assert.equal(parseMonthDay("12-32"), null); // giorno > 31
  assert.equal(parseMonthDay("12-0"), null); // giorno 0
  assert.equal(parseMonthDay("12/25"), null); // separatore errato
  assert.equal(parseMonthDay("2026-12-25"), null); // anno incluso
  assert.equal(parseMonthDay(null), null);
  assert.equal(parseMonthDay(undefined), null);
});

test("parseTime accetta HH:MM e rifiuta formati non validi", () => {
  assert.equal(parseTime("00:00"), 0);
  assert.equal(parseTime("23:59"), 23 * 60 + 59);
  assert.equal(parseTime(" 06:30 "), 6 * 60 + 30);

  assert.equal(parseTime("24:00"), null); // ora 24
  assert.equal(parseTime("12:60"), null); // minuti 60
  assert.equal(parseTime("12"), null);
  assert.equal(parseTime("12-30"), null);
  assert.equal(parseTime(null), null);
});

/* ------------------------------------------------------------------ *
 *  isVideoFile — estensioni supportate
 * ------------------------------------------------------------------ */

test("isVideoFile riconosce le estensioni supportate (case-insensitive)", () => {
  assert.equal(isVideoFile("film.mp4"), true);
  assert.equal(isVideoFile("FILM.MP4"), true);
  assert.equal(isVideoFile("clip.Mkv"), true);
  assert.equal(isVideoFile("old.avi"), true);
  assert.equal(isVideoFile("web.webm"), true);

  assert.equal(isVideoFile("poster.jpg"), false);
  assert.equal(isVideoFile("notes.txt"), false);
  assert.equal(isVideoFile("README"), false);
  assert.equal(isVideoFile(".DS_Store"), false);
});

test("isVideoFile accetta un elenco personalizzato di estensioni", () => {
  assert.equal(isVideoFile("clip.mov", [".mov"]), true);
  assert.equal(isVideoFile("clip.mov"), false); // non è di default
  assert.equal(isVideoFile("clip.MP4", ["mp4"]), true); // senza punto, maiuscolo
});

/* ------------------------------------------------------------------ *
 *  createVideoEntry — URL e percorsi
 * ------------------------------------------------------------------ */

test("createVideoEntry codifica correttamente spazi e caratteri speciali", () => {
  const entry = createVideoEntry("/video", "natale/La vigilia (2024).mp4");
  assert.equal(entry.filename, "La vigilia (2024).mp4");
  assert.equal(entry.relativePath, "natale/La vigilia (2024).mp4");
  assert.equal(entry.url, "/video/natale/La%20vigilia%20(2024).mp4");
});

test("createVideoEntry preserva la struttura delle sottocartelle", () => {
  const entry = createVideoEntry("/video", "sub/folder/clip.mp4");
  assert.equal(entry.filename, "clip.mp4");
  assert.equal(entry.url, "/video/sub/folder/clip.mp4");
});

test("createVideoEntry gestisce percorsi senza sottocartelle", () => {
  const entry = createVideoEntry("/video", "clip.mp4");
  assert.equal(entry.filename, "clip.mp4");
  assert.equal(entry.url, "/video/clip.mp4");
});

/* ------------------------------------------------------------------ *
 *  buildPriorityList — ordine e combinazioni
 * ------------------------------------------------------------------ */

test("buildPriorityList senza intervalli attivi restituisce solo default", () => {
  const date = new Date(2026, 5, 15, 12, 0); // giugno, mezzogiorno
  assert.deepEqual(
    buildPriorityList({ date, namedDateIntervals: [], namedTimeIntervals: [] }),
    ["default"],
  );
});

test("buildPriorityList con solo intervallo data", () => {
  const date = new Date(2026, 11, 25, 3, 0); // 25 dic, 03:00
  const namedDateIntervals = [
    { name: "natale", start: "12-01", end: "12-26" },
  ];
  const namedTimeIntervals = [
    { name: "sera", start: "18:00", end: "21:59" },
  ];
  // 03:00 non è in sera: solo la data matcha
  assert.deepEqual(
    buildPriorityList({ date, namedDateIntervals, namedTimeIntervals }),
    ["natale", "default"],
  );
});

test("buildPriorityList con solo intervallo orario", () => {
  const date = new Date(2026, 5, 15, 20, 0); // 15 giugno, 20:00
  const namedDateIntervals = [
    { name: "natale", start: "12-01", end: "12-26" },
  ];
  const namedTimeIntervals = [
    { name: "sera", start: "18:00", end: "21:59" },
  ];
  // 15 giugno non è natale: solo l'ora matcha
  assert.deepEqual(
    buildPriorityList({ date, namedDateIntervals, namedTimeIntervals }),
    ["sera", "default"],
  );
});

test("buildPriorityList combina data e ora nell'ordine atteso", () => {
  const date = new Date(2026, 11, 25, 20, 0); // 25 dic, 20:00
  const namedDateIntervals = [
    { name: "natale", start: "12-01", end: "12-26" },
    { name: "inverno", start: "12-21", end: "03-19" },
  ];
  const namedTimeIntervals = [
    { name: "sera", start: "18:00", end: "21:59" },
    { name: "giorno", start: "06:00", end: "18:59" }, // non match a 20:00
    { name: "notte", start: "22:00", end: "05:59" }, // non match a 20:00
  ];

  assert.deepEqual(
    buildPriorityList({ date, namedDateIntervals, namedTimeIntervals }),
    [
      "natale/sera",
      "inverno/sera",
      "natale",
      "inverno",
      "sera",
      "default",
    ],
  );
});

test("buildPriorityList con intervallo notturno che scavalca la mezzanotte", () => {
  const date = new Date(2026, 5, 15, 3, 0); // 15 giugno, 03:00
  const namedTimeIntervals = [
    { name: "notte", start: "22:00", end: "05:59" },
    { name: "giorno", start: "06:00", end: "18:59" },
  ];
  assert.deepEqual(
    buildPriorityList({ date, namedTimeIntervals }),
    ["notte", "default"],
  );
});

test("buildPriorityList ignora gli intervalli disabilitati", () => {
  const date = new Date(2026, 0, 1, 10, 0); // 1 gen, 10:00
  const namedDateIntervals = [
    { name: "compleanno", start: "01-01", end: "01-01", enabled: false },
  ];
  const namedTimeIntervals = [
    { name: "mattina", start: "06:00", end: "13:59" },
  ];
  assert.deepEqual(
    buildPriorityList({ date, namedDateIntervals, namedTimeIntervals }),
    ["mattina", "default"],
  );
});

/* ------------------------------------------------------------------ *
 *  matchesNamed*Intervals — filtro enabled + formato
 * ------------------------------------------------------------------ */

test("matchesNamedDateIntervals salta intervalli disabilitati o malformati", () => {
  const date = new Date(2026, 11, 25, 12, 0);
  const intervals = [
    { name: "natale", start: "12-01", end: "12-26" },
    { name: "disabilitato", start: "12-01", end: "12-26", enabled: false },
    { name: "malformato", start: "not-a-date", end: "12-26" },
  ];
  const matched = matchesNamedDateIntervals(date, intervals).map((i) => i.name);
  assert.deepEqual(matched, ["natale"]);
});

test("matchesNamedTimeIntervals salta intervalli disabilitati o malformati", () => {
  const date = new Date(2026, 11, 25, 20, 0);
  const intervals = [
    { name: "sera", start: "18:00", end: "21:59" },
    { name: "disabilitato", start: "18:00", end: "21:59", enabled: false },
    { name: "malformato", start: "18:00", end: "99:99" },
  ];
  const matched = matchesNamedTimeIntervals(date, intervals).map((i) => i.name);
  assert.deepEqual(matched, ["sera"]);
});

/* ------------------------------------------------------------------ *
 *  validateIntervals — messaggi diagnostici
 * ------------------------------------------------------------------ */

test("validateIntervals non segnala problemi per configurazioni valide", () => {
  const problems = validateIntervals(
    [
      { name: "natale", start: "12-01", end: "12-26" },
      { name: "estate", start: "06-01", end: "09-14" },
    ],
    [
      { name: "sera", start: "18:00", end: "21:59" },
      { name: "notte", start: "22:00", end: "05:59" },
    ],
  );
  assert.deepEqual(problems, []);
});

test("validateIntervals segnala name mancante, date e orari invalidi", () => {
  const problems = validateIntervals(
    [
      { start: "12-01", end: "12-26" }, // manca name
      { name: "rotto", start: "xx", end: "12-26" },
    ],
    [{ name: "sera", start: "18:00", end: "99:99" }],
  );
  assert.equal(problems.length, 3);
  assert.ok(problems.some((p) => p.includes("senza")));
  assert.ok(problems.some((p) => p.includes('"rotto"')));
  assert.ok(problems.some((p) => p.includes('"sera"')));
});

/* ------------------------------------------------------------------ *
 *  shuffleWithRandom — comportamento Fisher-Yates
 * ------------------------------------------------------------------ */

test("shuffleWithRandom non modifica l'array originale e conserva gli elementi", () => {
  const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const copy = [...original];
  const shuffled = shuffleWithRandom(original, createRandom(123));
  assert.deepEqual(original, copy, "l'array originale è stato modificato");
  assert.deepEqual([...shuffled].sort((a, b) => a - b), copy);
});

test("shuffleWithRandom è deterministico con lo stesso seed", () => {
  const items = ["a", "b", "c", "d", "e", "f"];
  const a = shuffleWithRandom(items, createRandom(42));
  const b = shuffleWithRandom(items, createRandom(42));
  assert.deepEqual(a, b);
});

test("shuffleWithRandom gestisce array vuoti e a un elemento", () => {
  assert.deepEqual(shuffleWithRandom([], createRandom(1)), []);
  assert.deepEqual(shuffleWithRandom([1], createRandom(1)), [1]);
});