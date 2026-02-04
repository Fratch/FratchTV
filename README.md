# Fratch TV

Fratch TV is a simple Node.js application that serves a web page for playing videos in random order. It utilizes Docker to containerize the application.

## Getting Started

These instructions will help you set up and run the Fratch TV application.

### Prerequisites

- Node.js 18+ (for local development without Docker)
- Docker (optional, only if you want to run via container)

### Building the Docker Image

```bash
docker build -t fratch-tv .
```

### Running the Docker Container

```bash
docker run -p 1997:1997 fratch-tv
```

### Running locally (no Docker)

```bash
npm install
npm start
```

Open http://localhost:1997 in your browser.

## Usage
Access the Fratch TV application by opening http://localhost:1997 in your web browser. The application allows you to play random videos with basic controls.

## Project Structure
- Dockerfile: Specifies the Docker image for the Node.js application.
- index.js: Node.js server code that handles video playback and server configuration.
- public/index.html: HTML file for the web page served by the Node.js server.
- public/scripts/playVideos.js: JavaScript file containing the logic for playing videos randomly.
- videos/: Directory to store video files.
Additional Information
The application uses Video.js for video playback.
### Scheduling folders

FratchTV can load videos based on the current date/time. Create folders inside `videos/` using these rules:

- `videos/<namedDateInterval>/<namedTimeInterval>/` (highest priority)
- `videos/<namedDateInterval>/`
- `videos/<namedTimeInterval>/`
- `videos/default/` (fallback)

Intervals are configured in `config.json`. For example, during `natale` + `sera`, videos inside
`videos/natale/sera` are added first, then `videos/natale`, then `videos/sera`, then `videos/default`.

Video files should have extensions like `.mp4`, `.avi`, `.mkv`, or `.webm`.

## License
This project is licensed under the MIT License - see the LICENSE.md file for details.
