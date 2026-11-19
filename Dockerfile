# One image that serves both the API and the built React app on port 4000.
#   docker build -t homeroom .
#   docker run -p 4000:4000 --env-file server/.env -e NODE_ENV=production homeroom
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=4000 FFMPEG_PATH=/usr/bin/ffmpeg
COPY --from=build /app /app
EXPOSE 4000
CMD ["node", "server/src/index.js"]
