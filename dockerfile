# Stage 1: dipendenze
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Stage 2: run
FROM node:22-slim
WORKDIR /app
COPY --from=build /app ./

ENV NODE_ENV=production \
    VIDEOS_DIR=/videos \
    TZ=Europe/Rome
VOLUME ["/videos"]

EXPOSE 1997
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 1997) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "index.js"]