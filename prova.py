# importing vlc module
import vlc

# importing time module
import time


# creating vlc media player object
media_player = vlc.MediaPlayer()

# media object
media = vlc.Media("videos/HeWasNeverThere.mp4")

# setting media to the media player
media_player.set_media(media)


# start playing video
media_player.play()

# wait so the video can be played for 5 seconds
# irrespective for length of video
time.sleep(5)
