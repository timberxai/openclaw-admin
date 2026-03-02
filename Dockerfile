FROM openclaw:local AS builder

USER root
WORKDIR /build

# Install ALL dependencies (including devDeps for tsc/vite)
COPY package.json package-lock.json ./
RUN NODE_ENV=development npm ci

# Copy source and build frontend
COPY . .
RUN npx tsc -b && npx vite build

# --- Production ---
FROM openclaw:local

USER root
WORKDIR /app

# Install all deps (tsx is in devDependencies)
COPY package.json package-lock.json ./
RUN NODE_ENV=development npm ci

# Copy built frontend
COPY --from=builder /build/dist ./dist

# Copy server source (tsx runs TypeScript directly)
COPY server ./server
COPY tsconfig.json ./

ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
