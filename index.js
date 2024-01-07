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

    const overlappingIntervals = getOverlappingIntervals();
    const intervalPromises = overlappingIntervals.map(interval =>
        getFilesInInterval(path.join(videoFolder, interval.name))
    );

    const overlappingTimes = getOverlappingTimes();
    const timePromises = overlappingTimes.map(time =>
        getFilesInInterval(path.join(videoFolder, time.name))
    );

    const results = await Promise.all([...intervalPromises, ...timePromises]);
    const intervalVideoFiles = results.flat();

    return [...videoFiles, ...intervalVideoFiles];
}

function filterVideoFiles(files) {
    return files.filter(file => file.endsWith('.mp4') || file.endsWith('.avi') || file.endsWith('.mkv') || file.endsWith('.webm'));
}

function getOverlappingIntervals() {
    const today = new Date();
    return namedDateIntervals.filter(interval => {
        const startDate = new Date(`${today.getFullYear()}-${interval.start}`);
        const endDate = new Date(`${today.getFullYear()}-${interval.end}`);
        return today >= startDate && today <= endDate;
    });
}

function getOverlappingTimes() {
    const currentHour = new Date().getHours();
    return namedTimeIntervals.filter(time => {
        const startTime = parseInt(time.start.split(':')[0]);
        const endTime = parseInt(time.end.split(':')[0]);
        return (
            (currentHour >= startTime && currentHour <= endTime) ||
            (startTime > endTime && (currentHour >= startTime || currentHour <= endTime))
        );
    });
}

async function getFilesInInterval(intervalFolder) {
    try {
        const intervalFiles = await fs.readdir(intervalFolder);
        return intervalFiles
            .filter(file => file.endsWith('.mp4') || file.endsWith('.webm'))
            .map(videoFile => path.join(intervalFolder, videoFile));
    } catch (error) {
        console.error('Error reading interval video folder:', error);
        throw error;
    }
}

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

app.use((req, res) => {
    res.status(404).send('Not Found');
});

const namedDateIntervals = [
    { name: 'estate', start: '06-01', end: '09-14' },
    { name: 'sanvalentino', start: '02-14', end: '02-14' },
    { name: 'inverno', start: '12-21', end: '03-19' },
    { name: 'natale', start: '12-01', end: '12-26' },
    { name: 'halloween', start: '10-30', end: '10-31' }
];

const namedTimeIntervals = [
    { name: 'giorno', start: '06:00', end: '18:59' },
    { name: 'mattina', start: '06:00', end: '13:59' },
    { name: 'pomeriggio', start: '14:00', end: '17:59' },
    { name: 'sera', start: '18:00', end: '21:59' },
    { name: 'notte', start: '22:00', end: '05:59' }
];
