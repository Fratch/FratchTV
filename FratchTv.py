import os
import random
from datetime import datetime, date

# Set the directory where the video files are located
video_dir = "videos"

# Set the date ranges and corresponding directories for additional videos
date_ranges = {
    (date(2022, 12, 1), date(2022, 12, 31)): "videos/natale",
    (date(2022, 6, 1), date(2022, 9, 21)): "videos/estate",
}

# Get the current date
today = date.today()

# Get a list of all video files in the directory
video_files = [f for f in os.listdir(video_dir) if f.endswith(".mp4") or f.endswith(".avi") or f.endswith(".mkv")]

# Shuffle the list of video files
random.shuffle(video_files)

# Create a queue for the video files
queue = video_files

# Check if the current date is within any of the specified date ranges
for daterange, dir in date_ranges.items():
    start, end = daterange
    if start <= today <= end:
        # If the current date is within the date range, add the videos from the corresponding directory to the queue
        additional_videos = [f for f in os.listdir(dir) if f.endswith(".mp4") or f.endswith(".avi")]
        queue += additional_videos

# Play the videos in the queue
for video in queue:
    # Use a media player library or command-line tool to play the video file (e.g. VLC, PyMediaPlayer)
    # For example, using VLC:
    os.system('vlc ' + video)
    pass