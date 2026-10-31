# Stage 1: dipendenze
FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Stage 2: run
FROM node:22-slim
WORKDIR /app
COPY --from=build /app ./

ENV NODE_ENV=production \
    VIDEOS_DIR=/videos
VOLUME ["/videos"]

EXPOSE 1997
USER node
CMD ["node", "index.js"]