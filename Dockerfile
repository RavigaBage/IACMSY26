# ============================================================
# Stage 1 — Build the React frontend
# ============================================================
FROM node:22 AS frontend-builder

WORKDIR /build

# Copy workspace manifests first (layer-cache friendly)
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install frontend dependencies
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --workspace=frontend && \
    npm install @rolldown/binding-linux-x64-gnu lightningcss-linux-x64-gnu --no-save

# Copy frontend source
COPY frontend/ ./frontend/

# Build production frontend
WORKDIR /build/frontend
RUN npm run build


# ============================================================
# Stage 2 — Production backend image
# ============================================================
FROM node:22 AS production

WORKDIR /app

# Create non-root user first
RUN groupadd -r appgroup && \
    useradd -r -g appgroup appuser

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install backend production dependencies
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --omit=dev --workspace=backend && \
    npm install mongodb-memory-server@^11.2.0 --no-save

# Copy backend source with correct ownership
COPY --chown=appuser:appgroup backend/ ./backend/

# Copy built frontend with correct ownership
COPY --chown=appuser:appgroup \
    --from=frontend-builder /build/frontend/dist ./frontend/dist

# Copy static assets with correct ownership
COPY --chown=appuser:appgroup attendanceForm/ ./attendanceForm/
COPY --chown=appuser:appgroup ["IACMOBILE APP/", "./IACMOBILE APP/"]

# Make uploads directory available to the application
RUN mkdir -p /app/backend/uploads && \
    chown appuser:appgroup /app/backend/uploads

USER appuser

EXPOSE 5000

CMD ["node", "backend/server.js"]
