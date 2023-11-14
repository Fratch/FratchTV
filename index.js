// index.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const port = 1997;

app.use(cors());
app.use(express.static('public'));
app.use('/video', express.static('video')); // Add this line

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
      const videoFiles = files.filter(file => file.endsWith('.mp4') || file.endsWith('.avi') || file.endsWith('.mkv') || file.endsWith('.webm'));
      res.json(videoFiles);
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
