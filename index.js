//index.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const port = 1997;
const videoFolder = path.join(__dirname, 'video');

app.use(cors());
app.use(express.static('public'));
app.use('/video', express.static('video'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/videos', async (req, res) => {
    try {
        const videoFiles = await getVideoFiles();
        res.json(videoFiles);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

async function getVideoFiles() {
    const files = await fs.readdir(videoFolder);
    const videoFiles = filterVideoFiles(files);

    const [intervalVideoFiles, timeVideoFiles] = await Promise.all([
        getFilesInNamedIntervals(),
        getFilesInNamedTimes(),
    ]);

    return [...videoFiles, ...intervalVideoFiles, ...timeVideoFiles];
}

function filterVideoFiles(files) {
    const videoExtensions = ['.mp4', '.avi', '.mkv', '.webm'];
    return files.filter(file => videoExtensions.some(ext => file.endsWith(ext)));
}

async function getFilesInInterval(intervalFolder) {
    try {
        const relativePath = path.relative(videoFolder, intervalFolder);
        const intervalFiles = await fs.readdir(intervalFolder);

        return intervalFiles
            .filter(file => file.endsWith('.mp4') || file.endsWith('.webm'))
            .map(videoFile => path.join(relativePath, videoFile));
    } catch (error) {
        console.error('Error reading/creating interval video folder:', error);
        throw error;
    }
}

async function getFilesInNamedIntervals() {
    const today = new Date();
    const overlappingIntervals = getOverlappingIntervals(today);

    const intervalPromises = overlappingIntervals.map(interval =>
        getFilesInInterval(path.join(videoFolder, interval.name))
    );

    const intervalVideoFiles = (await Promise.all(intervalPromises)).flat();
    return intervalVideoFiles;
}

async function getFilesInNamedTimes() {
    const currentHour = new Date().getHours();
    const overlappingTimes = getOverlappingTimes(currentHour);

    const timePromises = overlappingTimes.map(time =>
        getFilesInInterval(path.join(videoFolder, time.name))
    );

    const timeVideoFiles = (await Promise.all(timePromises)).flat();
    return timeVideoFiles;
}

function getOverlappingIntervals(today) {
    return config.namedDateIntervals.filter(interval => {
        const startDate = new Date(`${today.getFullYear()}-${interval.start}`);
        const endDate = new Date(`${today.getFullYear()}-${interval.end}`);
        return today >= startDate && today <= endDate;
    });
}

function getOverlappingTimes(currentHour) {
    return config.namedTimeIntervals.filter(time => {
        const startTime = parseInt(time.start.split(':')[0]);
        const endTime = parseInt(time.end.split(':')[0]);
        return (
            (currentHour >= startTime && currentHour <= endTime) ||
            (startTime > endTime && (currentHour >= startTime || currentHour <= endTime))
        );
    });
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