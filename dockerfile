FROM python:3.8-slim-buster

RUN apt-get update && apt-get install -y vlc-bin vlc-plugin-base vlc-plugin-video-output python3-vlc

COPY FratchTv.py /app/FratchTv.py
COPY videos /app/videos

WORKDIR /app

CMD ["python3", "FratchTv.py"]