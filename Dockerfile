# --- Build admin frontend + TypeScript ---
FROM alpine/openclaw AS builder

USER root
WORKDIR /build

COPY package.json package-lock.json ./
RUN NODE_ENV=development npm ci

COPY . .
RUN npx tsc -b && npx vite build

# --- Production: admin installed into openclaw image ---
FROM alpine/openclaw

USER root

# Install Caddy (Debian 12 bookworm, Aliyun mirror)
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y --no-install-recommends caddy && rm -rf /var/lib/apt/lists/*

# Install admin into /opt/openclaw-admin/
WORKDIR /opt/openclaw-admin

COPY package.json package-lock.json ./
RUN NODE_ENV=development npm ci

# Copy built frontend
COPY --from=builder /build/dist ./dist

# Copy server source (tsx runs TypeScript directly)
COPY server ./server
COPY tsconfig.json ./

# Copy entrypoint and Caddy config
COPY docker/entrypoint.sh ./docker/entrypoint.sh
COPY docker/Caddyfile ./docker/Caddyfile
RUN chmod +x ./docker/entrypoint.sh

# System dependencies required by Chromium / Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xvfb \
    fonts-noto-color-emoji \
    fonts-unifont \
    libfontconfig1 \
    libfreetype6 \
    xfonts-scalable \
    fonts-liberation \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-tlwg-loma-otf \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

# Pre-install Chromium via Playwright into a shared path
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN node /app/node_modules/playwright-core/cli.js install chromium \
    && chmod -R o+rx /opt/ms-playwright

# Ensure fontconfig cache is writable by any user
RUN mkdir -p /var/cache/fontconfig && chmod 777 /var/cache/fontconfig

# Restore original workdir for openclaw
WORKDIR /app

USER node
