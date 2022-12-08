#!/usr/bin/env python3
import os
import random
from datetime import date
import vlc
import time

# Set the directory where the video files are located
video_dir = "videos"

# Set the date ranges and corresponding directories for additional videos
date_ranges = {
    (date(2022, 12, 1), date(2022, 12, 31)): "videos/natale",
    (date(2022, 10, 1), date(2022, 10, 31)): "videos/estate",
}

# Create a VLC player
media_player = vlc.MediaListPlayer()

# Create Instance class object
player = vlc.Instance()

# Create a media list object
media_list = vlc.MediaList()

# Get a list of all video files in the directory
video_files = [f for f in os.listdir(video_dir) if f.endswith(".mp4") or f.endswith(".avi") or f.endswith(".mkv")]

# Shuffle the list of video files
random.shuffle(video_files)

# Add the files to the VLC player's queue
for f in video_files:
    media_list.add_media(os.path.join(video_dir, f))

# Get the current date
today = date.today()

# Check if the current date is within any of the specified date ranges
for date_range in date_ranges:
    start, end = date_range
    if start <= today <= end:
        # If the current date is within the date range, add the video files from the corresponding folder
        folder_path = date_ranges[date_range]
        files = [f for f in os.listdir(folder_path) if f.endswith(".mp4") or f.endswith(".avi") or f.endswith(".mkv")]
        for f in files:
            media_list.add_media(os.path.join(folder_path, f))

# setting media list to the media player
media_player.set_media_list(media_list)
            


# Play the video files
media_player.play()
while True:
    pass


