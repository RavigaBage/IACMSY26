# 🇬🇭 🇰🇷 Ghana-Korea IAC — Information Access Center

> **Operations & Management Platform for Ghana-Korea IAC | Internet Lounge Management, Mobile Member Access Passes, QR Attendance Tracking, and Device Monitoring.**

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Key Features](#-key-features)
3. [System Architecture & Tech Stack](#-system-architecture--tech-stack)
4. [Quick Start — Docker (Recommended)](#-quick-start--docker-recommended)
5. [Manual Setup — Local Development](#-manual-setup--local-development)
6. [Environment Variables Reference](#-environment-variables-reference)
7. [API Endpoints Reference](#-api-endpoints-reference)
8. [Agents & Device Status Integration](#-agents--device-status-integration)
9. [Production Deployment](#-production-deployment)

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

## 🐳 Quick Start — Docker (Recommended)

> **Prerequisites**: [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running. Nothing else needed.

### 1. Clone the repository

```bash
git clone https://github.com/RavigaBage/IACMSY26.git
cd IACMSY26
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your secrets (the only required changes are the JWT keys):

```env
JWT_SECRET=replace_with_a_long_random_string
JWT_REFRESH_SECRET=replace_with_another_long_random_string
JWT_TICKET=replace_with_another_long_random_string
```

All other values have sensible defaults for Docker.

### 3. Build and start

```bash
docker compose up --build
```

Docker will:
1. Install all frontend dependencies (pinned via `package-lock.json`)
2. Build the React production bundle
3. Install backend dependencies
4. Start MongoDB, Redis, and the application server

### 4. Open the application

| Service | URL |
|---|---|
| Admin Dashboard | http://localhost:5000 |
| Mobile App | http://localhost:5000/IACMOBILE%20APP/index.html |
| Attendance QR Form | http://localhost:5000/attendanceForm/index.html |
| Backend API | http://localhost:5000/api |

### Useful Docker commands

```bash
# Start in detached (background) mode
docker compose up -d --build

# View live logs
docker compose logs -f app

# Stop everything
docker compose down

# Stop and wipe all data volumes (full reset)
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

Frontend dev server runs at **http://localhost:3000** with HMR and API proxied to `localhost:5000`.

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

- [ ] Set `USE_MEMORY_DB=false` and use a secured `MONGO_URL` (with TLS)
- [ ] Replace all placeholder JWT secrets with long random strings
- [ ] Never commit `.env` to source control (already in `.gitignore`)
- [ ] Enable HTTPS via Let's Encrypt / Certbot on your reverse proxy
- [ ] Set `NODE_ENV=production`

---

<div align="center">
  <b>Ghana-Korea IAC — Information Access Center 🇬🇭 🇰🇷</b><br/>
  Powered by Modern Web & Mobile Technologies
</div>
