// public/scripts/playVideos.js
const playButton = document.getElementById('playButton');
let videoPlayer = videojs('videoPlayer', { fluid: true }); // Initialize videoPlayer here

let shuffledVideos;
let currentIndex = 0;

playButton.addEventListener('click', () => {
  fetch('/videos')
    .then(response => response.json())
    .then(videos => {
      shuffledVideos = shuffleArray(videos);
      playVideosRandomly();
    });
});

function playVideosRandomly() {
  videoPlayer.on('ended', playNextVideo);

  document.addEventListener('keydown', handleKeyDown);

  // Start playing the first video
  playNextVideo();
}

function playNextVideo() {
  const currentVideo = shuffledVideos[currentIndex];
  videoPlayer.src({ src: `/video/${encodeURIComponent(currentVideo)}`, type: 'video/mp4' });
  videoPlayer.play();
  currentIndex = (currentIndex + 1) % shuffledVideos.length;
}

function handleKeyDown(event) {
  switch (event.key) {
    case ' ':
      // Space key: toggle play/pause
      videoPlayer.paused() ? videoPlayer.play() : videoPlayer.pause();
      break;
    case 'ArrowRight':
      // Right arrow key: play the next video
      playNextVideo();
      break;
    case 'ArrowLeft':
      // Left arrow key: play the previous video (if available)
      currentIndex = (currentIndex - 1 + shuffledVideos.length) % shuffledVideos.length;
      playNextVideo();
      break;
    case 'f':
      // 'f' key: toggle fullscreen
      if (document.fullscreenElement) {
        // If already in fullscreen, exit fullscreen
        document.exitFullscreen();
      } else {
        // If not in fullscreen, request fullscreen
        videoPlayer.requestFullscreen();
      }
      break;
    default:
      break;
  }
}

function shuffleArray(array) {
  let currentIndex = array.length, randomIndex;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
}
