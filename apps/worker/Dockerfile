# Unread worker: Temporal worker (or poller) + Kokoro + EmbeddingGemma + ffmpeg.
# Build from the repo root: docker build -f apps/worker/Dockerfile .
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm install --frozen-lockfile --filter "@unread/worker..."

ENV NODE_ENV=production \
    MODEL_CACHE_DIR=/app/.models \
    FFMPEG_PATH=ffmpeg
# Bake the ONNX models into the image (PG_URL is only needed to satisfy config parsing).
RUN PG_URL=postgres://build:build@localhost:5432/build pnpm --filter @unread/worker warm-models

CMD ["pnpm", "--filter", "@unread/worker", "start"]
