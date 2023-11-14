// public/scripts/playVideos.js
const playButton = document.getElementById('playButton');
let videoPlayer; // Declare videoPlayer outside the functions to make it accessible

playButton.addEventListener('click', () => {
  fetch('/videos')
    .then(response => response.json())
    .then(videos => playVideosRandomly(videos));
});

function playVideosRandomly(videos) {
  const shuffledVideos = shuffleArray(videos);
  let currentIndex = 0;

  function playNextVideo() {
    const currentVideo = shuffledVideos[currentIndex];
    videoPlayer.src({ src: `/video/${encodeURIComponent(currentVideo)}`, type: 'video/mp4' });
    videoPlayer.play();
    currentIndex = (currentIndex + 1) % shuffledVideos.length;
  }

  // Initialize the videoPlayer instance
  videoPlayer = videojs('videoPlayer', { fluid: true });

  // Add 'ended' event listener to the player instance
  videoPlayer.on('ended', playNextVideo);

  // Start playing the first video
  playNextVideo();
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
