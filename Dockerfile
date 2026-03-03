# --- Build admin frontend + TypeScript ---
FROM openclaw:local AS builder

USER root
WORKDIR /build

COPY package.json package-lock.json ./
RUN NODE_ENV=development npm ci

COPY . .
RUN npx tsc -b && npx vite build

# --- Production: admin installed into openclaw image ---
FROM openclaw:local

USER root

# Install admin into /opt/openclaw-admin/
WORKDIR /opt/openclaw-admin

COPY package.json package-lock.json ./
RUN NODE_ENV=development npm ci

# Copy built frontend
COPY --from=builder /build/dist ./dist

# Copy server source (tsx runs TypeScript directly)
COPY server ./server
COPY tsconfig.json ./

# Copy entrypoint script
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

# Restore original workdir for openclaw
WORKDIR /app

USER node
