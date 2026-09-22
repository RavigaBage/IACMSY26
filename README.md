# 🇬🇭 🇰🇷 Ghana-Korea IAC — Information Access Center

> **Operations & Management Platform for Ghana-Korea IAC | Internet Lounge Management, Mobile Member Access Passes, QR Attendance Tracking, and Device Monitoring.**

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Key Features](#-key-features)
3. [System Architecture & Tech Stack](#-system-architecture--tech-stack)
4. [Quick Start — `setup.sh` (Recommended)](#-quick-start--setupsh-recommended)
5. [Manual Setup — Local Development](#-manual-setup--local-development)
6. [Environment Variables Reference](#-environment-variables-reference)
7. [API Endpoints Reference](#-api-endpoints-reference)
8. [Agents & Device Status Integration](#-agents--device-status-integration)
9. [Production Deployment](#-production-deployment)
10. [`setup.sh` Reference](#-setupsh-reference)

---

## 🌐 Project Overview

The **Ghana-Korea IAC Management System** is an end-to-end operational software suite designed for modern Internet Business Centers, Academic Tech Lounges, and Hub Workspaces.

It unifies **mobile member identity**, **frictionless check-ins via digital day passes or QR scanning**, **staff lounge management**, **network internet token generation**, and **real-time hardware device monitoring** into a single cohesive platform.

### Core Objectives
- **Frictionless Member Onboarding & Check-in** — Mobile users sign up with name, phone, and ID to generate verified digital access passes.
- **Instant Lounge Logging** — Passes or direct QR scans immediately record visitor entry into the central database.
- **Staff Admin Control** — Confirm pending tickets, log walk-ins, track sessions, enforce timeouts, and view capacity metrics.
- **Resilient Infrastructure** — Runs with MongoDB Atlas, a local MongoDB instance, or zero-config in-memory Mongo for instant deployment.

---

## ✨ Key Features

### 📱 1. IAC Mobile App (Member Access Pass)
- Secure JWT-based registration and login (name, email, phone, ID/Student ID)
- Dynamic day passes with QR codes and single-click check-in requests
- Auto-fill user credentials on lounge check-in and QR attendance forms
- Gamified loyalty system — streaks, visit counts, community leaderboard
- Responsive dark-mode PWA with touch-optimised bottom navigation

### 💻 2. Staff Admin Dashboard
- Live capacity tracker — active visitors, daily check-ins, peak hours
- Instant pending ticket confirmations (1-click)
- Manual walk-in entry form (Name, ID, Contact, Gender, Signature)
- Automated session timeout tracking with batch or individual controls
- Multi-filter search (name, ID, time) and CSV/PDF export

### 📱 3. Attendance QR Code Form
- Standalone contactless sign-in page launched via QR scan at the front desk
- Auto-prefills logged-in mobile member credentials
- Directly records entry in the lounge database and credits streak points

### 📊 4. Reports, Network & Device Monitoring
- Internet voucher / bandwidth token generation
- Real-time device status agents (PCs, routers, access points)
- Historical occupancy analytics and peak-hour breakdown

---

## 🏗️ System Architecture & Tech Stack

```
                              +-----------------------+
                              |   Mobile Member App   |
                              |  (HTML5 / JS / PWA)   |
                              +-----------+-----------+
                                          |
                                          v
+-----------------------+    +-----------+-----------+    +-----------------------+
|  Attendance QR Form   |--->|  Node.js / Express 5  |<---|    Admin Dashboard    |
| (Stand-alone Web App) |    |     Backend API        |    |  (React 18 + Vite 8) |
+-----------------------+    +-----------+-----------+    +-----------------------+
                                          |
                              +-----------+-----------+
                              |  MongoDB + Redis Cache |
                              |  (Local / Atlas / Mem) |
                              +-----------------------+
```

### Stack Breakdown

| Layer | Technology |
|---|---|
| Admin Dashboard | React 18, TypeScript, Vite 8, Tailwind CSS, Recharts, Lucide Icons |
| Mobile & Public Forms | Native HTML5, CSS3, ES6+ JavaScript |
| Backend API | Node.js, Express 5, Socket.io, Mongoose, JWT, bcryptjs |
| Database | MongoDB 7 / `mongodb-memory-server` fallback |
| Cache / Sessions | Redis 7 |
| Container Runtime | Docker + Docker Compose |

---

## 🚀 Quick Start — `setup.sh` (Recommended)

> **Prerequisites**: [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running, plus **Node.js v22+** and **Git Bash** (Windows) or any POSIX shell.

The included `setup.sh` script handles everything: pre-flight checks, environment setup, secret generation, issue auto-fixing, Docker build, and health monitoring — all in one command.

### 1. Clone the repository

```bash
git clone https://github.com/RavigaBage/IACMSY26.git
cd IACMSY26
```

### 2. Copy the environment file

```bash
cp .env.example .env
```

### 3. Run the setup script

```bash
# Recommended: fix all issues + build + launch the full stack
bash setup.sh --up
```

The script will automatically:
1. Verify Docker, Node.js, and npm are available
2. Detect placeholder JWT secrets and **replace them with cryptographically secure random values**
3. Correct the `PORT` value for Docker compatibility
4. Fix known Dockerfile issues (see [Known Issues Fixed](#known-issues-fixed))
5. Validate `docker-compose.yml` syntax
6. Build the Docker images (no cache)
7. Start MongoDB, Redis, and the application server
8. Wait for health checks to pass and print live status

### 4. Open the application

| Service | URL |
|---|---|
| Admin Dashboard | http://localhost:5000 |
| Mobile App | http://localhost:5000/IACMOBILE%20APP/index.html |
| Attendance QR Form | http://localhost:5000/attendanceForm/index.html |
| Backend API | http://localhost:5000/api |

> **Default admin credentials** (auto-seeded on first boot):
> - Email: `admin@iac.com`
> - Password: `Admin@1234`

### Useful script commands

```bash
bash setup.sh           # Safe read-only audit — checks everything, changes nothing
bash setup.sh --fix     # Auto-fix all detected issues (no Docker needed)
bash setup.sh --up      # Fix + build + launch full Docker stack
bash setup.sh --logs    # Tail live logs from running stack
bash setup.sh --down    # Stop containers (volumes preserved)
bash setup.sh --reset   # Stop + wipe ALL data volumes ⚠️
```

### Manual Docker commands (alternative)

> ⚠️ **Windows Git Bash Users**: The `docker` command might not be available in Git Bash by default (returning `command not found`). You should either:
> 1. Use **Command Prompt** or **PowerShell** to run the manual `docker compose` commands below.
> 2. Or simply use `bash setup.sh --up` in Git Bash, which automatically handles the Docker path for you.

If you prefer raw Docker commands after manually setting up `.env`:

```bash
# Build and start (foreground)
docker compose up --build

# Start in background
docker compose up -d --build

# View logs
docker compose logs -f app

# Stop (keep data)
docker compose down

# Stop + wipe volumes
docker compose down -v
```

---

## 🛠️ Manual Setup — Local Development

Use this method if you want hot-reload during development.

### Prerequisites

- **Node.js** `v22+` (check with `node -v`)
- **npm** `v10+` (check with `npm -v`)
- **MongoDB** Community Edition v7+ *(optional — the server falls back to in-memory DB automatically)*
- **Redis** v7+ *(optional — required for session caching features)*

### 1. Clone

```bash
git clone https://github.com/RavigaBage/IACMSY26.git
cd IACMSY26
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — at minimum set your JWT secrets. For local dev, leave `USE_MEMORY_DB=true` to skip needing a MongoDB installation.

### 3. Install all workspace dependencies

Run from the **project root** (installs both `backend` and `frontend` workspaces):

```bash
npm install
```

> ⚠️ **Windows users**: If the install stalls (due to `mongodb-memory-server` downloading a binary), run `npm install --ignore-scripts` and then `npm install` again — or just install each workspace separately:
> ```bash
> npm install --workspace=backend
> npm install --workspace=frontend
> ```

### 4. Start the backend

```bash
# Development with hot-reload
npm run dev --workspace=backend

# or from inside the backend folder
cd backend && npm run dev
```

Backend runs at **http://localhost:5000**

### 5. Start the frontend dev server

In a **new terminal tab**:

```bash
npm run dev --workspace=frontend

# or from inside the frontend folder
cd frontend && npm run dev
```

Frontend dev server runs at **http://localhost:5000** (Vite) with HMR and API proxied to `localhost:5000` backend.

> ⚠️ **Port note**: The `.env` `PORT` variable must be `5000` to match the Vite proxy target. Running `bash setup.sh --fix` will correct this automatically.

### 6. Access the app

| Service | URL |
|---|---|
| Admin Dashboard (dev) | http://localhost:3000 |
| Mobile App | http://localhost:5000/IACMOBILE%20APP/index.html |
| Attendance QR Form | http://localhost:5000/attendanceForm/index.html |
| Backend API | http://localhost:5000/api |

### Building for production manually

```bash
# Build the frontend
npm run build --workspace=frontend

# Start the backend (it serves the built frontend from frontend/dist)
npm start --workspace=backend
```

---

## 🔑 Environment Variables Reference

Copy `.env.example` to `.env` and edit as needed.

| Variable | Description | Default |
|---|---|---|
| `BACKEND_PORT` | Express server port | `5000` |
| `NODE_ENV` | Environment mode | `production` |
| `MONGO_URL` | MongoDB connection URI | `mongodb://localhost:27017/iac_lounge_db` |
| `USE_MEMORY_DB` | Use in-memory MongoDB fallback | `true` |
| `REDIS_URL` | Redis connection URI | *(auto-set in Docker)* |
| `JWT_SECRET` | **Required** — Access token signing key | — |
| `JWT_REFRESH_SECRET` | **Required** — Refresh token signing key | — |
| `JWT_TICKET` | **Required** — Ticket token signing key | — |
| `JWT_EXPIRES_IN` | Access token lifespan | `1d` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | `7d` |
| `GEMINI_API_KEY` | Google Gemini API key (optional AI features) | — |

---

## 📡 API Endpoints Reference

### 🔐 Mobile Auth (`/api/iac-mobile/auth`)
| Method | Route | Description |
|---|---|---|
| `POST` | `/register` | Register mobile member (`name`, `email`, `password`, `phoneNumber`, `studentId`) |
| `POST` | `/login` | Authenticate and return JWT tokens + profile |
| `GET` | `/verify` | Validate token and return current user |

### 🎫 Check-in Tickets (`/api/iac-mobile/checkin-tickets`)
| Method | Route | Description |
|---|---|---|
| `POST` | `/` | Create a pending check-in ticket (auto-fills phone & ID) |
| `GET` | `/` | List all tickets (admin) |
| `POST` | `/:id/confirm` | Confirm ticket → log to lounge DB → increment streak |

### 🛋️ Internet Lounge (`/api/lounge`)
| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Active visitors + daily summary |
| `POST` | `/` | Create walk-in entry |
| `PUT` | `/time-out/:id` | Set timeout for active visitor |

### 📱 Attendance QR (`/api/public/qrcodes`)
| Method | Route | Description |
|---|---|---|
| `POST` | `/active/submit` | Submit attendance directly from scanned QR form |

---

## 📡 Agents & Device Status Integration

- **Internet Voucher Generator** — Integrates with local router/captive portal endpoints to generate time-limited WiFi access tokens.
- **Status Agent** — Periodically checks connected hardware (PCs, routers, printers) via Socket.io and updates the Devices page in real time.

Agents connect to the backend via WebSocket (`socket.io`) using the `agent:register` event, identified by `deviceId`.

---

## 🛡️ Production Deployment

### Docker (recommended)

The included `docker-compose.yml` is production-ready with:
- Multi-stage build (lean final image — no dev deps, no source maps)
- MongoDB and Redis with health checks and persistent named volumes
- Non-root container user for security
- Automatic restart policies (`unless-stopped`)

```bash
docker compose up -d --build
```

### Manual / PM2

```bash
# Build frontend
npm run build --workspace=frontend

# Start backend with PM2
npm install -g pm2
pm2 start backend/server.js --name "iac-backend"
pm2 save
pm2 startup
```

### Reverse Proxy (Nginx example)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Security checklist for production

- [ ] Run `bash setup.sh --fix` to auto-generate secure JWT secrets before first deploy
- [ ] Set `USE_MEMORY_DB=false` and use a secured `MONGO_URL` (with authentication + TLS)
- [ ] Never commit `.env` to source control (already excluded in `.gitignore` and `.dockerignore`)
- [ ] Enable HTTPS via Let's Encrypt / Certbot on your reverse proxy
- [ ] Set `NODE_ENV=production` (default in Docker Compose)
- [ ] Rotate JWT secrets periodically — re-run `bash setup.sh --fix` to regenerate

---

## 🔧 `setup.sh` Reference

The `setup.sh` script (`bash setup.sh [flag]`) is a self-contained setup, audit, and deployment tool for the project.

### Flags

| Flag | Description |
|---|---|
| *(none)* | **Audit mode** — read-only pre-flight check, no files modified |
| `--fix` | **Fix mode** — auto-correct all detected issues; no Docker required |
| `--up` | **Deploy mode** — fix issues, build Docker images, start the stack |
| `--down` | Stop all containers; named volumes (data) are preserved |
| `--reset` | Stop containers **and delete all volumes** (database + uploads) ⚠️ |
| `--logs` | Tail live log output from the running stack (`Ctrl+C` to stop) |
| `--help` | Print usage summary |

### What the script checks & fixes

| Check | Auto-fix |
|---|---|
| `.env` missing → copies from `.env.example` | ✅ |
| Placeholder JWT secrets (`your_jwt_*`) → generates 64-byte hex secrets via `crypto` | ✅ |
| `PORT=3000` in `.env` → corrects to `5000` to match Vite proxy | ✅ |
| `--ignore-scripts` on backend Dockerfile install → removes it so `mongodb-memory-server` binary downloads correctly | ✅ |
| Duplicate `backend/package-lock.json` alongside root lockfile → backs up and removes it | ✅ |
| `@/` path alias used in source but missing from `vite.config.ts` → adds `resolve.alias` | ✅ |
| Docker daemon not running | ⚠️ Reports with instructions |
| `docker-compose.yml` YAML syntax error | ⚠️ Reports errors |
| Missing `.dockerignore` exclusions | ⚠️ Reports |
| TypeScript `noEmit` / `jsx` config | ⚠️ Reports |

### Safety features

- All file modifications are **backed up** with a timestamped `.bak` extension before changes are applied
- **Idempotent** — safe to run multiple times; already-fixed issues are silently skipped
- Uses `set -euo pipefail` — exits immediately on any unhandled error
- File patching uses **Node.js** (cross-platform; no `sed` quoting issues on Windows/Git Bash)
- `--reset` requires typing `yes` to confirm before destroying data

### Known Issues Fixed

The following issues were identified during code review and are automatically resolved by `bash setup.sh --fix`:

1. **`--ignore-scripts` blocked `mongodb-memory-server` binary** — The backend `npm ci` step in `Dockerfile` used `--ignore-scripts`, preventing the MongoMemoryServer binary download. If MongoDB is slow to start in Docker, the fallback would crash instead of recovering.
2. **Placeholder JWT secrets** — `.env.example` ships with `your_jwt_*` placeholders that would be injected directly into the container, making tokens trivially forgeable.
3. **`PORT=3000` vs Docker's `PORT=5000`** — The `.env` default `PORT=3000` would mismatch the Vite dev proxy target (`5000`) during local development.
4. **Duplicate `backend/package-lock.json`** — The Dockerfile only reads the root lockfile; the backend's own lockfile was silently ignored, risking version drift between local and container installs.

---

<div align="center">
  <b>Ghana-Korea IAC — Information Access Center 🇬🇭 🇰🇷</b><br/>
  Powered by Modern Web & Mobile Technologies
</div>
