# Ubuntu 24.04 (noble) ships GLIBC >= 2.38, which sqlite3@6 prebuilds require.
# Nixpacks' older glibc causes: version `GLIBC_2.38' not found (node_sqlite3.node)
FROM node:22-noble-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3080

CMD ["npm", "start"]
