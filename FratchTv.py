#!/usr/bin/env python3
import os
import random
from datetime import date
import vlc
import time

# Set the extensions for video files
VIDEO_EXTENSIONS = [".mp4", ".avi", ".mkv", ".webm"]

# Set the directory where the video files are located
DEFAULT_VIDEO_DIR = "videos"

# Set the date ranges and corresponding directories for additional videos
DATE_RANGES = {
    (date(2022, 12, 1), date(2022, 12, 31)): "videos/natale",
    (date(2022, 6, 1), date(2022, 8, 31)): "videos/estate",
    (date(2022, 2, 14), date(2022, 2, 14)): "videos/sanvalentino",
}

# Set the hour ranges and corresponding directories for additional videos
HOUR_RANGES = {
    (6,18): "videos/giorno",
    (18,6): "videos/notte",
}

def get_video_files(directory):
    """Return a list of video files in the given directory."""
    return [f for f in os.listdir(directory) if f.endswith(tuple(VIDEO_EXTENSIONS))]

def get_media_list(directory):
    """Return a VLC media list for the video files in the given directory."""
    media_list = vlc.MediaList()
    for f in get_video_files(directory):
        media_list.add_media(os.path.join(directory, f))
    return media_list

def add_files_to_media_list(media_list, directory):
    """Add the video files in the given directory to the given media list."""
    for f in get_video_files(directory):
        media_list.add_media(os.path.join(directory, f))

def main():
    try:
        # Create a VLC player
        media_player = vlc.MediaListPlayer()

        # Create a media list object
        media_list = vlc.MediaList()

        # Get a list of video files in the default directory
        video_files = get_video_files(DEFAULT_VIDEO_DIR)

        # Shuffle the list of video files
        random.shuffle(video_files)

        # Add the shuffled video files to the media list
        for f in video_files:
            media_list.add_media(os.path.join(DEFAULT_VIDEO_DIR, f))

        # Get the current date and hour
        today = date.today()
        now = time.localtime().tm_hour

        # Check if the current date is within any of the specified date ranges
        for date_range in DATE_RANGES:
            start, end = date_range
            if start.month <= today.month <= end.month and start.day <= today.day <= end.day:
                # If the current date is within the date range, add the video files from the corresponding folder
                folder_path = DATE_RANGES[date_range]
                add_files_to_media_list(media_list, folder_path)

        # Check if the current hour is within any of the specified hour ranges
        for hour_range in HOUR_RANGES:
            start, end = hour_range
            if start <= now <= end:
                # If the current hour is within the date range, add the video files from the corresponding folder
                folder_path = HOUR_RANGES[hour_range]
                add_files_to_media_list(media_list, folder_path)

        # Set the media list to the media player
        media_player.set_media_list(media_list)

        # Play the video files
        media_player.play()
        while True:
            # Wait for the user to press a key to skip to the next video
            input("Press enter to skip to the next video in the playlist...\n")

            # Skip to the next video in the playlist
            media_player.next()
        
    except Exception as e:
        # Catch any exceptions that occur and print an error message
        print("An error occurred:", str(e))
    
if __name__ == "__main__":
    main()
