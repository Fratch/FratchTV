const playButton = document.getElementById('playButton');
const videoPlayer = videojs('videoPlayer', { fluid: true });

let videoQueue = [];
let currentIndex = 0;

/**
 * Fetch video files from the server and shuffle them.
 */
async function fetchAndShuffleVideos() {
  try {
    const response = await fetch('/videos');
    if (!response.ok) {
      throw new Error('Failed to fetch videos from the server');
    }
    const payload = await response.json();
    const videos = Array.isArray(payload) ? payload : payload.videos;
    if (!Array.isArray(videos) || videos.length === 0) {
      throw new Error('No videos available');
    }
    videoQueue = shuffleArray(videos);
  } catch (error) {
    console.error(error.message);
    alert('An error occurred while loading videos. Please try again later.');
  }
}

/**
 * Shuffle an array in random order.
 * @param {Array} array - The array to shuffle.
 * @returns {Array} - The shuffled array.
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Play the next video in the queue.
 */
function playNextVideo() {
  if (videoQueue.length === 0) {
    console.warn('Video queue is empty.');
    return;
  }

  const currentVideo = videoQueue[currentIndex];
  const videoSource = typeof currentVideo === 'string' ? `/video/${encodeURI(currentVideo)}` : currentVideo.url;
  const videoName = typeof currentVideo === 'string' ? currentVideo : currentVideo.filename;
  videoPlayer.src({
    src: videoSource,
    type: getMimeType(videoName),
  });
  videoPlayer.play();

  currentIndex = (currentIndex + 1) % videoQueue.length;
}

/**
 * Get a basic MIME type for the video file.
 * @param {string} filename
 * @returns {string}
 */
function getMimeType(filename) {
  const extension = filename.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'webm':
      return 'video/webm';
    case 'mkv':
      return 'video/x-matroska';
    case 'avi':
      return 'video/x-msvideo';
    case 'mp4':
    default:
      return 'video/mp4';
  }
}

/**
 * Handle video playback errors by skipping to the next video.
 */
function handleVideoError() {
  const currentVideo = videoQueue[currentIndex];
  const videoName = typeof currentVideo === 'string' ? currentVideo : currentVideo.filename;
  console.error(`Error loading video: ${videoName}`);
  playNextVideo();
}

/**
 * Handle keyboard controls for video playback.
 * @param {KeyboardEvent} event - The keyboard event.
 */
function handleKeyDown(event) {
  switch (event.key) {
    case ' ': // Spacebar: toggle play/pause
      videoPlayer.paused() ? videoPlayer.play() : videoPlayer.pause();
      break;
    case 'ArrowRight': // Right arrow: skip to the next video
      playNextVideo();
      break;
    case 'ArrowLeft': // Left arrow: play the previous video
      currentIndex = (currentIndex - 1 + videoQueue.length) % videoQueue.length;
      playNextVideo();
      break;
    case 'f': // 'f' key: toggle fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoPlayer.requestFullscreen();
      }
      break;
    default:
      break;
  }
}

/**
 * Initialize the video player and set up event listeners.
 */
async function initializePlayer() {
  await fetchAndShuffleVideos();

  videoPlayer.on('ended', playNextVideo);
  videoPlayer.on('error', handleVideoError);
  document.addEventListener('keydown', handleKeyDown);

  playNextVideo();
}

/**
 * Hide the play button and start the video player.
 */
playButton.addEventListener('click', () => {
  playButton.style.display = 'none';
  initializePlayer();
});
