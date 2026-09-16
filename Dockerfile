# ============================================================
# Stage 1 — Build the React frontend
# ============================================================
FROM node:22-alpine AS frontend-builder

WORKDIR /build

# Copy workspace manifests first (layer-cache friendly)
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install ALL workspace deps from the lockfile
# --ignore-scripts skips mongodb-memory-server binary download (not needed at build time)
# Increased timeouts to prevent EIDLETIMEOUT during large frontend installs
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --ignore-scripts --workspace=frontend

# Copy frontend source
COPY frontend/ ./frontend/

# Build the production bundle
WORKDIR /build/frontend
RUN npm run build

# ============================================================
# Stage 2 — Production backend image
# ============================================================
FROM node:22-alpine AS production

WORKDIR /app

# Install only backend workspace deps
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Increased timeouts to prevent EIDLETIMEOUT
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --omit=dev --workspace=backend && \
    npm install mongodb-memory-server@^11.2.0 --no-save

# Copy backend source
COPY backend/ ./backend/

# Copy the built frontend dist from stage 1
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

# Copy optional static assets the backend serves
COPY attendanceForm/ ./attendanceForm/
COPY ["IACMOBILE APP/", "./IACMOBILE APP/"]

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000

CMD ["node", "backend/server.js"]
