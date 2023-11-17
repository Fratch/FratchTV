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
                .filter(file => file.endsWith('.mp4') || file.endsWith('.avi') || file.endsWith('.mkv') || file.endsWith('.webm'))
                .map(videoFile => `${interval.name}/${videoFile}`);
              videoFiles = videoFiles.concat(intervalVideoFiles);
              resolve();
            }
          });
        }));
      }

      Promise.all(intervalPromises)
        .then(() => {
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

const namedDateIntervals = [
  //{ name: 'notte', start: '2023-11-01', end: '2023-11-17' },
  { name: 'estate', start: '2023-06-01', end: '2023-09-14' },
  { name: 'sanvalentino', start: '2023-02-14', end: '2023-02-14' },
  { name: 'inverno', start: '2023-12-21', end: '2023-03-19' },
  { name: 'natale', start: '2023-12-01', end: '2023-12-26' },
  { name: 'halloween', start: '2023-11-30', end: '2023-11-31' }
];

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
