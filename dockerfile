# Dockerfile
# Stage 1: Build
FROM node:18 AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Stage 2: Run
FROM node:18-slim

WORKDIR /app
COPY --from=build /app ./
RUN npm prune --production

EXPOSE 1997
CMD ["node", "index.js"]

