// public/scripts/playVideos.js
const playButton = document.getElementById('playButton');
let videoPlayer; // Declare videoPlayer outside the functions to make it accessible
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
    // Initialize the videoPlayer instance
    videoPlayer = videojs('videoPlayer', { fluid: true });

    // Add 'ended' event listener to the player instance
    videoPlayer.on('ended', playNextVideo);

    // Add keyboard controls
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
            currentIndex = (currentIndex - 2 + shuffledVideos.length) % shuffledVideos.length;
            playNextVideo();
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
