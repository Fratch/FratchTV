const playButton = document.getElementById("playButton");
const videoPlayer = videojs('videoPlayer', {
  fill: true,                              // niente fluid: il rapporto lo decide lo stage
  userActions: { doubleClick: false },     // il doppio click lo gestisce stage.js
  controlBar: { fullscreenToggle: false }, // il fullscreen lo gestisce stage.js
});

let videoQueue = [];
let currentIndex = -1; // indice del video attualmente in riproduzione
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Fetch video files from the server and shuffle them.
 */
async function fetchAndShuffleVideos() {
  try {
    const response = await fetch("/videos");
    if (!response.ok) {
      throw new Error("Failed to fetch videos from the server");
    }
    const payload = await response.json();
    const videos = Array.isArray(payload) ? payload : payload.videos;
    if (!Array.isArray(videos) || videos.length === 0) {
      throw new Error("No videos available");
    }
    videoQueue = shuffleArray(videos);
  } catch (error) {
    console.error(error.message);
    alert("An error occurred while loading videos. Please try again later.");
  }
}

/**
 * Shuffle an array in random order (Fisher-Yates).
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getVideoSource(video) {
  return typeof video === "string" ? `/video/${encodeURI(video)}` : video.url;
}

function getVideoName(video) {
  return typeof video === "string" ? video : video.filename;
}

/**
 * Play the video at the given index (wraps around the queue).
 */
function playVideoAt(index) {
  if (videoQueue.length === 0) {
    console.warn("Video queue is empty.");
    return;
  }

  currentIndex = (index + videoQueue.length) % videoQueue.length;
  const video = videoQueue[currentIndex];

  videoPlayer.src({
    src: getVideoSource(video),
    type: getMimeType(getVideoName(video)),
  });

  const playPromise = videoPlayer.play();
  if (playPromise !== undefined) {
    playPromise.catch((error) =>
      console.warn("Playback was interrupted:", error.message),
    );
  }
}

function playNextVideo() {
  playVideoAt(currentIndex + 1);
}

function playPreviousVideo() {
  playVideoAt(currentIndex - 1);
}

/**
 * Get a basic MIME type for the video file.
 */
function getMimeType(filename) {
  const extension = filename.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
    case "avi":
      return "video/x-msvideo";
    case "mov":
      return "video/quicktime";
    case "mp4":
    default:
      return "video/mp4";
  }
}

/**
 * Skip broken videos, but stop if too many fail in a row.
 */
function handleVideoError() {
  const video = videoQueue[currentIndex];
  consecutiveErrors += 1;
  console.error(
    `Error loading video: ${video ? getVideoName(video) : "unknown"}`,
  );

  if (
    consecutiveErrors >= Math.min(MAX_CONSECUTIVE_ERRORS, videoQueue.length)
  ) {
    console.error("Too many consecutive errors, stopping playback.");
    alert("Impossibile riprodurre i video: controlla formato e codec.");
    return;
  }
  playNextVideo();
}

/**
 * Keyboard controls.
 */
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
  await fetchAndShuffleVideos();
  if (videoQueue.length === 0) return;

  videoPlayer.on("ended", playNextVideo);
  videoPlayer.on("error", handleVideoError);
  videoPlayer.on("playing", () => {
    consecutiveErrors = 0;
  });
  document.addEventListener("keydown", handleKeyDown);

  playNextVideo();
}

playButton.addEventListener("click", () => {
  playButton.style.display = "none";
  initializePlayer();
});
