# ---- build -----------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime ---------------------------------------------------------------
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATABASE_URL=/data/library.db
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*

# Litestream streams every SQLite change to object storage. See litestream.yml.
ARG LITESTREAM_VERSION=0.3.13
RUN ARCH=$(dpkg --print-architecture) \
 && curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-${ARCH}.deb" -o /tmp/litestream.deb \
 && dpkg -i /tmp/litestream.deb && rm /tmp/litestream.deb

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY drizzle ./drizzle
COPY litestream.yml /etc/litestream.yml
COPY scripts/start.sh ./scripts/start.sh
RUN chmod +x ./scripts/start.sh && mkdir -p /data

EXPOSE 3000
CMD ["./scripts/start.sh"]
