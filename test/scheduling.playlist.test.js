"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlaylist } = require("../lib/scheduling");

/* ------------------------------------------------------------------ *
 *  Aiuti
 * ------------------------------------------------------------------ */

function makeVideos(count, scheduled, prefix) {
  const p = prefix || (scheduled ? "s" : "f");
  return Array.from({ length: count }, (_, i) => ({
    filename: `${p}${i}.mp4`,
    relativePath: `${p}${i}.mp4`,
    url: `/video/${p}${i}.mp4`,
    scheduled,
  }));
}

/** Sequenze consecutive dello stesso tipo: [{ scheduled, count }, ...] */
function splitRuns(playlist) {
  const runs = [];
  for (const video of playlist) {
    const last = runs[runs.length - 1];
    if (last && last.scheduled === video.scheduled) {
      last.count += 1;
    } else {
      runs.push({ scheduled: video.scheduled, count: 1 });
    }
  }
  return runs;
}

/** Blocchi da `size` elementi, ciascuno come array di URL. */
function cycles(playlist, size) {
  const result = [];
  for (let i = 0; i + size <= playlist.length; i += size) {
    result.push(playlist.slice(i, i + size).map((v) => v.url));
  }
  return result;
}

/* ------------------------------------------------------------------ *
 *  createBag: nessun ciclo identico con pool piccolo e gap pieno
 * ------------------------------------------------------------------ */

test("createBag non ripete cicli identici con pool piccolo e gap pieno", () => {
  // Il bug originale: con pool di 5 e gap 5, ogni ciclo era identico
  // al precedente perché la coda veniva riappesa nell'ordine di uscita
  // invece di essere rimescolata.
  const videos = makeVideos(5, true);
  const playlist = buildPlaylist(videos, {
    seed: 42,
    length: 50,
    scheduledWeight: 1,
    minGap: 5,
  });

  const chunks = cycles(playlist, 5);

  // Ogni ciclo è una permutazione completa dei 5 video
  const expected = new Set(videos.map((v) => v.url));
  for (const chunk of chunks) {
    assert.equal(chunk.length, 5);
    assert.equal(new Set(chunk).size, 5, "ciclo con duplicati interni");
    for (const url of chunk) assert.ok(expected.has(url), `URL sconosciuto: ${url}`);
  }

  // Non tutti i cicli sono identici (era esattamente il bug originale)
  const signatures = new Set(chunks.map((c) => c.join("|")));
  assert.ok(
    signatures.size > 1,
    "tutti i cicli sono identici: il bug è tornato",
  );
});

/* ------------------------------------------------------------------ *
 *  buildPlaylist: proporzione scheduled vicina al peso
 * ------------------------------------------------------------------ */

test("buildPlaylist mantiene la proporzione scheduled vicina al peso", () => {
  // Pool scheduled piccolo (30) e fallback grande (300): è la configurazione
  // in cui il problema "scheduled ammassati" era più visibile.
  const videos = [
    ...makeVideos(30, true, "s"),
    ...makeVideos(300, false, "f"),
  ];

  let totalScheduled = 0;
  let totalItems = 0;
  for (let seed = 1; seed <= 100; seed += 1) {
    const playlist = buildPlaylist(videos, {
      seed,
      length: 100,
      scheduledWeight: 0.6,
      minGap: 5,
    });
    totalScheduled += playlist.filter((v) => v.scheduled).length;
    totalItems += playlist.length;
  }

  const proportion = totalScheduled / totalItems;
  assert.ok(
    proportion > 0.55 && proportion < 0.65,
    `proporzione scheduled troppo lontana da 0.6: ${proportion.toFixed(3)}`,
  );
});

/* ------------------------------------------------------------------ *
 *  buildPlaylist: niente raffiche lunghe di scheduled
 * ------------------------------------------------------------------ */

test("buildPlaylist non ammassa i video scheduled in raffiche lunghe", () => {
  const videos = [
    ...makeVideos(30, true, "s"),
    ...makeVideos(300, false, "f"),
  ];

  const scheduledRuns = [];
  for (let seed = 1; seed <= 100; seed += 1) {
    const playlist = buildPlaylist(videos, {
      seed,
      length: 100,
      scheduledWeight: 0.6,
      minGap: 5,
    });
    for (const run of splitRuns(playlist)) {
      if (run.scheduled) scheduledRuns.push(run.count);
    }
  }

  const avgRun =
    scheduledRuns.reduce((a, b) => a + b, 0) / scheduledRuns.length;
  const veryLong = scheduledRuns.filter((r) => r >= 10).length;

  // Con weight 0.6 e correzione del deficit, la media resta bassa.
  assert.ok(avgRun < 4, `run medio scheduled troppo alto: ${avgRun.toFixed(2)}`);
  // Le raffiche davvero lunghe (>= 10) dovrebbero essere rarissime.
  assert.ok(
    veryLong <= 5,
    `troppe raffiche scheduled >= 10: ${veryLong} su ${scheduledRuns.length}`,
  );
});

/* ------------------------------------------------------------------ *
 *  buildPlaylist: pool piccolo, tutti i video scheduled escono
 * ------------------------------------------------------------------ */

test("buildPlaylist con pool scheduled piccolo non esclude nessun video", () => {
  const videos = [
    ...makeVideos(3, true, "s"),
    ...makeVideos(50, false, "f"),
  ];
  const playlist = buildPlaylist(videos, {
    seed: 7,
    length: 200,
    scheduledWeight: 0.6,
    minGap: 5,
  });

  const scheduledUrls = new Set(
    playlist.filter((v) => v.scheduled).map((v) => v.url),
  );
  assert.deepEqual(
    [...scheduledUrls].sort(),
    ["/video/s0.mp4", "/video/s1.mp4", "/video/s2.mp4"],
  );
});

/* ------------------------------------------------------------------ *
 *  buildPlaylist: determinismo del seed
 * ------------------------------------------------------------------ */

test("buildPlaylist è deterministico rispetto al seed", () => {
  const videos = [
    ...makeVideos(10, true, "s"),
    ...makeVideos(50, false, "f"),
  ];
  const a = buildPlaylist(videos, {
    seed: 123,
    length: 50,
    scheduledWeight: 0.6,
    minGap: 5,
  });
  const b = buildPlaylist(videos, {
    seed: 123,
    length: 50,
    scheduledWeight: 0.6,
    minGap: 5,
  });
  assert.deepEqual(a.map((v) => v.url), b.map((v) => v.url));
});

/* ------------------------------------------------------------------ *
 *  buildPlaylist: casi limite invariati
 * ------------------------------------------------------------------ */

test("buildPlaylist restituisce [] con input vuoto o length non positiva", () => {
  const videos = makeVideos(3, false);
  assert.deepEqual(buildPlaylist([], { length: 10 }), []);
  assert.deepEqual(buildPlaylist(videos, { length: 0 }), []);
  assert.deepEqual(buildPlaylist(videos, { length: -1 }), []);
});

test("buildPlaylist usa il sacchetto disponibile quando manca l'altro gruppo", () => {
  const onlyScheduled = buildPlaylist(makeVideos(3, true), {
    seed: 1,
    length: 10,
    scheduledWeight: 0.6,
    minGap: 1,
  });
  assert.equal(onlyScheduled.length, 10);
  assert.ok(onlyScheduled.every((v) => v.scheduled));

  const onlyFallback = buildPlaylist(makeVideos(3, false), {
    seed: 1,
    length: 10,
    scheduledWeight: 0.6,
    minGap: 1,
  });
  assert.equal(onlyFallback.length, 10);
  assert.ok(onlyFallback.every((v) => !v.scheduled));
});