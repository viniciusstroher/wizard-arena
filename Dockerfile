# Debian 13 (trixie) has GLIBC >= 2.38, which sqlite3@6 prebuilds require.
# (There is no official node:*-noble image; bookworm is only GLIBC 2.36.)
FROM node:22-trixie-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

COPY . .
RUN npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3080

CMD ["npm", "start"]
