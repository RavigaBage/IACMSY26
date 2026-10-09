# Ghana-Korea IAC Management System

The Ghana-Korea Information Access Center (IAC) Management System provides a staff dashboard and member-facing web apps for lounge operations, attendance, reporting, bookings, and PC device monitoring.

## Applications

- **Dashboard:** React, TypeScript, Vite, and Tailwind CSS.
- **Backend:** Node.js, Express, Socket.IO, and MongoDB via Mongoose.
- **Member and attendance apps:** Static HTML, CSS, and JavaScript under `frontend/public/`.
- **PC agent:** Node.js Socket.IO client under `agent/`.

## Requirements

- Node.js 22 (22.12 or later recommended) and npm.
- MongoDB for persistent data. In-memory MongoDB is supported for local development only.
- Docker Compose for the container deployment.

## Local development

From the repository root:

```bash
npm ci
cp .env.example .env
```

The sample environment file is for local development. Keep `USE_MEMORY_DB=true` to use an ephemeral database, or set `USE_MEMORY_DB=false` and configure `MONGO_URL` for a local MongoDB server.

Run the backend and frontend in separate terminals:

```bash
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

The backend listens on `http://localhost:3000` by default. Vite serves the dashboard at `http://localhost:5173` and proxies API and Socket.IO requests to the backend. For development, the backend seeds a demo administrator (`admin@iac.com` / `Admin@1234`) and a demo mobile profile. These are development-only accounts and must not be used in production.

Run the available checks:

```bash
npm run build
npm run lint
(cd backend && node scripts/test_agent_integration.js)
(cd agent && npm test)
```

## Production deployment with Docker Compose

The Compose stack runs the application and Redis. **MongoDB is external** and must be a persistent, reachable, authenticated database; the app container does not include MongoDB. Do not use an in-memory database in production.

1. Copy `.env.example` to `.env` and replace every sample value. Keep `.env` private and out of version control.
2. Configure `MONGO_URL` with the MongoDB URI reachable from the container. `localhost` inside the container refers to the container itself, not the host machine.
3. Set unique, cryptographically random values of at least 32 characters for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_TICKET`, and `AGENT_TOKEN`. Generate them independently, for example:

   ```bash
   openssl rand -hex 32
   ```

4. Set `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and a unique `INITIAL_ADMIN_PASSWORD` of at least 16 characters. On first connection, the backend creates this administrator if the email is not already present. Production does not seed the development demo accounts.
5. Set `CORS_ORIGINS` to the comma-separated HTTPS origins allowed to access the API. Set `COOKIE_SECURE=true`. Terminate TLS at a trusted reverse proxy and do not expose the app publicly over plain HTTP.
6. Deploy:

   ```bash
   docker compose up -d --build
   docker compose logs -f app
   ```

The app container listens on port 5000. Put it behind an HTTPS reverse proxy, configure firewall rules, and ensure Socket.IO/WebSocket upgrades are forwarded. MongoDB and Redis data must be backed up independently; Compose persists uploaded files and Redis data in named volumes.

### Production environment variables

| Variable | Requirement |
|---|---|
| `MONGO_URL` | Persistent MongoDB URI reachable from the app container |
| `USE_MEMORY_DB` | Must be `false` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_TICKET` | Three distinct non-placeholder secrets, at least 32 characters each |
| `AGENT_TOKEN` | Shared agent connection token, at least 32 characters |
| `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` | Initial administrator credentials; password must be at least 16 characters |
| `CORS_ORIGINS` | Comma-separated HTTPS origins |
| `COOKIE_SECURE` | Must be `true` |
| `BACKEND_PORT` | Container port; Compose sets this to `5000` |

The backend refuses to start in production when required values are missing or invalid, when in-memory MongoDB is enabled, or when MongoDB cannot be reached. Socket.IO agent connections must present the configured `AGENT_TOKEN`.

## Installing PC agents

Configure each agent with:

- A server URL reachable from that PC (never `localhost` unless the backend runs on that same PC).
- A unique and stable `deviceId`.
- The shared production `AGENT_TOKEN`, set as the `AGENT_TOKEN` environment variable or in the machine's local `config.json`.
- Device-specific name, location, department, assigned user, serial number, and permissions as appropriate.

The Windows installer installs the service and preserves an existing machine-specific `config.json` on upgrades. After changing configuration, restart the `IAC-RMM-Agent` service. Check the agent's `logs/service.log` and `logs/service-error.log` for connection and registration results. A running Windows service alone does not prove that the backend is reachable or that the device registered.

The dashboard currently exposes the device's online status and basic identity information. Do not expose the shared agent token in screenshots, support logs, or source control.

## Operational notes

- The root `iacmobile-app/`, `frontend/public/iacmobile-app/`, `frontend/public/IACMOBILE APP/`, and attendance-form copies currently contain different content. They are retained rather than deleted or merged; verify behavior before consolidating them.
- Do not run `backend/seed.js` against production data; it clears lounge/event records and inserts development fixtures.
- A production deployment still needs environment-specific operational controls: HTTPS and firewall configuration, tested database backups and restore, monitoring/alerting, and a review of the public registration and administrative workflows before internet exposure.
