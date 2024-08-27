# Fratch TV

Fratch TV is a simple Node.js application that serves a web page for playing videos in random order. It utilizes Docker to containerize the application.

## Getting Started

These instructions will help you set up and run the Fratch TV application.

### Prerequisites

Make sure you have Docker installed on your machine.

### Building the Docker Image

```bash
docker build -t fratch-tv .
```

### Running the Docker Container

```bash
docker run -p 1997:1997 fratch-tv
```

## Usage
Access the Fratch TV application by opening http://localhost:1997 in your web browser. The application allows you to play random videos with basic controls.

## Project Structure
- Dockerfile: Specifies the Docker image for the Node.js application.
- index.js: Node.js server code that handles video playback and server configuration.
- public/index.html: HTML file for the web page served by the Node.js server.
- public/scripts/playVideos.js: JavaScript file containing the logic for playing videos randomly.
- video/: Directory to store video files.
Additional Information
The application uses Video.js for video playback.
Video files are expected to be in the video/ directory and should have extensions like .mp4, .avi, .mkv, or .webm.

## License
This project is licensed under the MIT License - see the LICENSE.md file for details.
