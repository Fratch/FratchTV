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
    const videos = await response.json();
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
  return array.sort(() => Math.random() - 0.5);
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
  videoPlayer.src({ src: `/video/${encodeURIComponent(currentVideo)}`, type: 'video/mp4' });
  videoPlayer.play();

  currentIndex = (currentIndex + 1) % videoQueue.length;
}

/**
 * Handle video playback errors by skipping to the next video.
 */
function handleVideoError() {
  console.error(`Error loading video: ${videoQueue[currentIndex]}`);
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
