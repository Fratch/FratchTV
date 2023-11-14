# Dockerfile
FROM node:14

# Install ffmpeg for video format support
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 1997

CMD [ "npm", "start" ]
