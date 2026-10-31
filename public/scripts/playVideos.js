const playButton = document.getElementById('playButton');
const videoPlayer = videojs('videoPlayer', {
  fill: true,                              // niente fluid: il rapporto lo decide lo stage
  userActions: { doubleClick: false },     // il doppio click lo gestisce stage.js
  controlBar: { fullscreenToggle: false }, // il fullscreen lo gestisce stage.js
  inactivityTimeout: 3000,
});

/* ------------------------------------------------------------------ *
 *  Impostazioni
 * ------------------------------------------------------------------ */

const REFRESH_MS = 10 * 60 * 1000;   // ogni quanto controllare se il palinsesto è cambiato
const REFILL_THRESHOLD = 3;          // quando restano pochi video chiedo una nuova scaletta
const HISTORY_LIMIT = 30;            // quanti video "già visti" tenere per il tasto indietro
const RECENT_WINDOW = 5;             // non ripetere i video usciti da poco tra due scalette
const MAX_CONSECUTIVE_ERRORS = 5;
const RESTART_DELAY_MS = 30 * 1000;  // pausa prima di riprovare dopo troppi errori

/* ------------------------------------------------------------------ *
 *  Stato
 * ------------------------------------------------------------------ */

let queue = [];              // scaletta: passato + video in corso + prossimi
let currentIndex = -1;       // indice del video in riproduzione
let prioritiesKey = '';      // "firma" del palinsesto attuale (cartelle attive)
let lastFetch = 0;
let fetching = false;
let consecutiveErrors = 0;
let restartTimer = null;
let started = false;
let preloadedFor = null;

// Elemento nascosto che scarica in anticipo il video successivo
const preloader = document.createElement('video');
preloader.preload = 'auto';
preloader.muted = true;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const notify = (text) => window.TvStage && window.TvStage.notify(text);

/* ------------------------------------------------------------------ *
 *  Scaletta dal server
 * ------------------------------------------------------------------ */

/**
 * Chiede al server una scaletta nuova (il seed casuale la rende diversa
 * ogni volta). Il server applica il peso del palinsesto e la distanza
 * minima tra le ripetizioni.
 */
async function fetchPlaylist() {
  const seed = Math.floor(Math.random() * 4294967296);
  const response = await fetch(`/videos?seed=${seed}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch videos (HTTP ${response.status})`);
  }
  const payload = await response.json();
  const videos = Array.isArray(payload) ? payload : payload.videos;
  if (!Array.isArray(videos) || videos.length === 0) {
    throw new Error('No videos available');
  }
  const priorities = Array.isArray(payload.priorities) ? payload.priorities : [];
  return { videos, key: priorities.join('|') };
}

/** Primo caricamento: riprova senza fermarsi finché il server risponde. */
async function loadInitialPlaylist() {
  let delay = 5000;
  for (;;) {
    try {
      const { videos, key } = await fetchPlaylist();
      queue = videos;
      currentIndex = -1;
      prioritiesKey = key;
      lastFetch = Date.now();
      return;
    } catch (error) {
      console.warn(error.message);
      notify('Server non raggiungibile, riprovo…');
      await sleep(delay);
      delay = Math.min(delay * 2, 60000);
    }
  }
}

/**
 * Sposta fuori dai primi posti i video visti da poco, scambiandoli con
 * altri più avanti, così tra una scaletta e la successiva non c'è
 * un ripetersi immediato.
 */
function avoidRecent(list, recentUrls) {
  const result = [...list];
  const recent = new Set(recentUrls);
  for (let i = 0; i < Math.min(RECENT_WINDOW, result.length); i += 1) {
    if (!recent.has(result[i].url)) continue;
    const j = result.findIndex((video, index) => index >= RECENT_WINDOW && !recent.has(video.url));
    if (j === -1) break;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const urlsOf = (videos) => videos.map((video) => video.url);

/** Palinsesto cambiato: tengo passato e video in corso, sostituisco il futuro. */
function replaceFuture(videos) {
  const history = queue.slice(0, currentIndex + 1);
  const recent = urlsOf(history.slice(-RECENT_WINDOW));
  queue = history.concat(avoidRecent(videos, recent));
}

/** Stesso palinsesto ma la scaletta sta finendo: accodo la nuova. */
function appendPlaylist(videos) {
  const recent = urlsOf(queue.slice(-RECENT_WINDOW));
  queue = queue.concat(avoidRecent(videos, recent));
}

function trimHistory() {
  const excess = currentIndex + 1 - HISTORY_LIMIT;
  if (excess > 0) {
    queue = queue.slice(excess);
    currentIndex -= excess;
  }
}

/**
 * Chiamata a ogni cambio video (mai a metà di un video, quindi senza
 * interruzioni). Aggiorna la scaletta solo quando serve:
 * - il palinsesto è cambiato (es. è iniziata la sera) -> nuovo futuro;
 * - restano pochi video -> nuova scaletta in coda;
 * - altrimenti non tocca niente.
 */
async function maintainQueue() {
  if (fetching) return;
  const remaining = queue.length - 1 - currentIndex;
  const due = Date.now() - lastFetch >= REFRESH_MS;
  if (remaining > REFILL_THRESHOLD && !due) return;

  fetching = true;
  try {
    const { videos, key } = await fetchPlaylist();
    lastFetch = Date.now();
    if (key !== prioritiesKey) {
      prioritiesKey = key;
      replaceFuture(videos);
    } else if (remaining <= REFILL_THRESHOLD) {
      appendPlaylist(videos);
    }
  } catch (error) {
    // Nessun avviso a schermo: si continua con la scaletta attuale e si riprova tra poco.
    console.warn('Aggiornamento scaletta non riuscito:', error.message);
    lastFetch = Date.now() - REFRESH_MS + 60 * 1000;
  } finally {
    fetching = false;
  }
}

/* ------------------------------------------------------------------ *
 *  Riproduzione
 * ------------------------------------------------------------------ */

function getVideoSource(video) {
  return typeof video === 'string' ? `/video/${encodeURI(video)}` : video.url;
}

function getVideoName(video) {
  return typeof video === 'string' ? video : video.filename;
}

function getMimeType(filename) {
  const extension = filename.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'webm':
      return 'video/webm';
    case 'mkv':
      return 'video/x-matroska';
    case 'avi':
      return 'video/x-msvideo';
    case 'mov':
      return 'video/quicktime';
    case 'mp4':
    default:
      return 'video/mp4';
  }
}

function showPlayButton() {
  playButton.style.display = '';
}

/** Riproduce il video all'indice dato (con giro completo della scaletta). */
function playVideoAt(index) {
  if (queue.length === 0) {
    console.warn('Video queue is empty.');
    return;
  }

  currentIndex = (index + queue.length) % queue.length;
  const video = queue[currentIndex];

  videoPlayer.src({
    src: getVideoSource(video),
    type: getMimeType(getVideoName(video)),
  });

  const playPromise = videoPlayer.play();
  if (playPromise !== undefined) {
    playPromise.catch((error) => {
      console.warn('Playback was interrupted:', error.message);
      // Il browser blocca l'avvio automatico: serve un click dell'utente
      if (error.name === 'NotAllowedError') showPlayButton();
    });
  }
}

function playNextVideo() {
  playVideoAt(currentIndex + 1);
  trimHistory();
  maintainQueue();
}

function playPreviousVideo() {
  playVideoAt(currentIndex - 1);
}

/** Scarica in anticipo il video successivo (una volta sola per video). */
function preloadNext() {
  if (queue.length < 2) return;
  const next = queue[(currentIndex + 1) % queue.length];
  if (!next) return;
  preloader.src = getVideoSource(next);
  preloader.load();
}

/** Dopo troppi errori di fila: messaggio a schermo e nuovo tentativo, senza alert. */
function scheduleRestart() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(async () => {
    consecutiveErrors = 0;
    try {
      const { videos, key } = await fetchPlaylist();
      queue = videos;
      currentIndex = -1;
      prioritiesKey = key;
      lastFetch = Date.now();
      playNextVideo();
    } catch (error) {
      console.warn(error.message);
      scheduleRestart();
    }
  }, RESTART_DELAY_MS);
}

/** Salta i video che non si riproducono, ma si ferma se falliscono tutti di fila. */
function handleVideoError() {
  const video = queue[currentIndex];
  consecutiveErrors += 1;
  console.error(`Error loading video: ${video ? getVideoName(video) : 'unknown'}`);

  if (consecutiveErrors >= Math.min(MAX_CONSECUTIVE_ERRORS, queue.length)) {
    console.error('Too many consecutive errors, will retry shortly.');
    notify('Impossibile riprodurre i video: controlla formato e codec. Riprovo tra poco…');
    scheduleRestart();
    return;
  }
  playNextVideo();
}

/* ------------------------------------------------------------------ *
 *  Tastiera e avvio
 * ------------------------------------------------------------------ */

function handleKeyDown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  switch (event.key) {
    case ' ':
      event.preventDefault();
      videoPlayer.paused() ? videoPlayer.play() : videoPlayer.pause();
      break;
    case 'ArrowRight':
      playNextVideo();
      break;
    case 'ArrowLeft':
      playPreviousVideo();
      break;
    case 'r':
    case 'R':
      TvStage.cycleAspect();
      break;
    case 'l':
    case 'L':
      TvStage.toggleLogo();
      break;
    case 'f':
    case 'F':
      TvStage.toggleFullscreen();
      break;
    default:
      break;
  }
}

async function initializePlayer() {
  await loadInitialPlaylist();

  videoPlayer.on('ended', playNextVideo);
  videoPlayer.on('error', handleVideoError);
  videoPlayer.on('playing', () => {
    consecutiveErrors = 0;
    const current = queue[currentIndex];
    if (current && preloadedFor !== current.url) {
      preloadedFor = current.url;
      preloadNext();
    }
  });
  document.addEventListener('keydown', handleKeyDown);

  playNextVideo();
}

playButton.addEventListener('click', () => {
  playButton.style.display = 'none';
  if (started) {
    videoPlayer.play();
    return;
  }
  started = true;
  initializePlayer();
});

// Modalità kiosk: aprendo la pagina con ?kiosk parte da sola.
// Serve Chrome avviato con --autoplay-policy=no-user-gesture-required;
// altrimenti ricompare il pulsante play e basta un click.
if (new URLSearchParams(window.location.search).has('kiosk')) {
  playButton.click();
}