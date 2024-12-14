const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const port = 1997;
const videoFolder = path.join(__dirname, 'videos'); // Correct path to 'videos' folder

app.use(cors());
app.use(express.static('public'));
app.use('/video', express.static(videoFolder));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/videos', async (req, res) => {
    try {
        const folderExists = await fs.access(videoFolder).then(() => true).catch(() => false);
        if (!folderExists) {
            console.error('Video folder does not exist.');
            return res.status(404).json({ error: 'Video folder not found' });
        }

        const files = await fs.readdir(videoFolder);
        const videoFiles = filterVideoFiles(files);

        if (videoFiles.length === 0) {
            console.warn('No videos found in the folder.');
            return res.status(404).json({ error: 'No videos available' });
        }

        res.json(videoFiles);
    } catch (error) {
        console.error('Error reading video folder:', error);
        res.status(500).json({ error: 'Could not fetch videos' });
    }
});

function filterVideoFiles(files) {
    const videoExtensions = ['.mp4', '.avi', '.mkv', '.webm'];
    return files.filter(file => videoExtensions.some(ext => file.endsWith(ext)));
}

const server = app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

process.on('SIGINT', () => {
    console.log('Server is shutting down...');
    server.close(() => {
        console.log('Server has been gracefully terminated.');
        process.exit(0);
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

app.use((req, res) => {
    res.status(404).send('Not Found');
});

const configPath = path.join(__dirname, 'config.json');
const config = require(configPath);
