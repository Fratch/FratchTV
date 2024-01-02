// index.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const port = 1997;

app.use(cors());
app.use(express.static('public'));
app.use('/video', express.static('video'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/videos', (req, res) => {
    const videoFolder = path.join(__dirname, 'video');
    fs.readdir(videoFolder, (err, files) => {
        if (err) {
            console.error('Error reading video folder:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            let videoFiles = files.filter(file => file.endsWith('.mp4') || file.endsWith('.avi') || file.endsWith('.mkv') || file.endsWith('.webm'));

            // Aggiunta video in base alla data
            const namedDateIntervals = [
                { name: 'estate', start: '2023-06-01', end: '2023-09-14' },
                { name: 'sanvalentino', start: '2023-02-14', end: '2023-02-14' },
                { name: 'inverno', start: '2023-12-21', end: '2023-03-19' },
                { name: 'natale', start: '2023-12-01', end: '2023-12-26' },
                { name: 'halloween', start: '2023-10-30', end: '2023-10-31' }
            ];
            const overlappingIntervals = getOverlappingIntervals(namedDateIntervals);
            const intervalPromises = [];

            for (const interval of overlappingIntervals) {
                const intervalFolder = path.join(videoFolder, interval.name);

                intervalPromises.push(new Promise((resolve, reject) => {
                    fs.readdir(intervalFolder, (intervalErr, intervalFiles) => {
                        if (intervalErr) {
                            console.error('Error reading interval video folder:', intervalErr);
                            reject(intervalErr);
                        } else {
                            let intervalVideoFiles = intervalFiles
                                .filter(file => file.endsWith('.mp4') || file.endsWith('.webm'))
                                .map(videoFile => `${interval.name}/${videoFile}`);
                            videoFiles = videoFiles.concat(intervalVideoFiles);
                            resolve();
                        }
                    });
                }));
            }

            // Aggiunta video in base all'orario
            const namedTimeIntervals = [
                { name: 'giorno', start: '06:00', end: '18:59' },
                { name: 'mattina', start: '06:00', end: '13:59' },
                { name: 'pomeriggio', start: '14:00', end: '17:59' },
                { name: 'sera', start: '18:00', end: '21:59' },
                { name: 'notte', start: '22:00', end: '05:59' }
            ];

            const overlappingTimes = getOverlappingTimes(namedTimeIntervals);
            const timePromises = [];

            for (const time of overlappingTimes) {
                const timeFolder = path.join(videoFolder, time.name);

                timePromises.push(new Promise((resolve, reject) => {
                    fs.readdir(timeFolder, (timeErr, timeFiles) => {
                        if (timeErr) {
                            console.error('Error reading time video folder:', timeErr);
                            reject(timeErr);
                        } else {
                            let timeVideoFiles = timeFiles
                                .filter(file => file.endsWith('.mp4') || file.endsWith('.webm'))
                                .map(videoFile => `${time.name}/${videoFile}`);
                            videoFiles = videoFiles.concat(timeVideoFiles);
                            resolve();
                        }
                    });
                }));
            }

            // Wait for all promises to resolve
            Promise.all([...intervalPromises, ...timePromises])
                .then(() => {
                    // Send the response after all promises have resolved
                    res.json(videoFiles);
                })
                .catch((error) => {
                    console.error('Error:', error);
                    res.status(500).json({ error: 'Internal Server Error' });
                });
        }
    });
});

function getOverlappingIntervals(namedDateIntervals) {
    const today = new Date();
    const overlappingIntervals = [];

    for (const interval of namedDateIntervals) {
        const startDate = new Date(interval.start);
        const endDate = new Date(interval.end);

        // Adjust start and end dates to the current year
        startDate.setFullYear(today.getFullYear());
        endDate.setFullYear(today.getFullYear());

        // Check if today is within the interval
        if (today >= startDate && today <= endDate) {
            overlappingIntervals.push(interval);
        }
    }

    return overlappingIntervals;
}


function getOverlappingTimes(namedTimeIntervals) {
    const currentHour = new Date().getHours();
    const overlappingTimes = [];

    for (const time of namedTimeIntervals) {
        const startTime = parseInt(time.start.split(':')[0]);
        const endTime = parseInt(time.end.split(':')[0]);

        if ((currentHour >= startTime && currentHour <= endTime) || (startTime > endTime && (currentHour >= startTime || currentHour <= endTime))) {
            overlappingTimes.push(time);
        }
    }

    return overlappingTimes;
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
