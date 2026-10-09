# IACMSY26 Laboratory PC Remote Management Client Agent

This lightweight agent runs on target laboratory PCs to enable secure remote management, monitoring, and command execution through the **IACMSY26 Remote Management System**.

---

## Capabilities

- **Automatic Device Registration**: Registers the PC identity, hardware specs, network IP, MAC address, and OS platform with the IACMSY26 server on boot.
- **Persistent Connection & Auto-Reconnect**: Maintains a resilient WebSocket/Socket.IO connection with exponential backoff on network interruptions.
- **Heartbeat & Online Detection**: Periodically reports device health, uptime, and online status to the administrator dashboard.
- **Safe Command Execution Lifecycle**:
  - Immediately acknowledges received commands (`command:ack` -> `ACKNOWLEDGED`).
  - Reports when the operation starts execution (`command:running` -> `RUNNING`).
  - Reports final status and output on completion (`command:complete` -> `COMPLETED`) or failure (`command:failed` -> `FAILED`).
- **Strict Security & Allowlisting**: Arbitrary remote shell execution is prohibited. Only supported, allowlisted operations are permitted:
  - `SYSTEM_RESTART` / `RESTART`
  - `SYSTEM_SHUTDOWN` / `SHUTDOWN`
  - `SYSTEM_LOGOFF` / `LOGOFF`
  - `LOCK_WORKSTATION` / `LOCK`
  - `SYSTEM_UPDATE` / `UPDATE`
  - `REMOTE_CONTROL` / `REMOTE_ASSIST`
  - `device:status` (real-time ping and diagnostics)
- **Local Permission Controls**: Local configuration can disable specific remote actions (e.g., disable remote shutdown while allowing restarts).
- **Automated Self-Test**: Verify agent configuration, networking, and security allowlist locally using `npm test`.

---

## Installation & Setup

### 1. Requirements

- Node.js (v18 or higher recommended)
- Network access to the IACMSY26 server URL (default port 3000)

### 2. Install Dependencies

In the `agent/` directory:

```bash
cd agent
npm install
```

### 3. Configure the Agent

Edit `config.json` or configure environment variables. Each installed PC must have a unique, stable `deviceId`, and its `serverUrl` must point to a backend address reachable from that PC:

```json
{
  "serverUrl": "https://iac.example.com",
  "deviceId": "LAB-PC-01",
  "deviceName": "Laboratory Workstation 01",
  "department": "Computer Science",
  "location": "Training Lab",
  "permissions": {
    "allowRemoteShutdown": true,
    "allowRemoteRestart": true,
    "allowRemoteLock": true,
    "allowRemoteMonitoring": true,
    "allowRemoteUpdate": true
  }
}
```

Do not use `localhost` unless the backend runs on the same PC as the agent. Production agents must use the same `AGENT_TOKEN` configured on the backend. Prefer setting it in the Windows service environment; alternatively, add `authToken` to that machine's local `config.json`. Never commit production tokens.

#### Environment Variables Override

| Variable | Description | Default |
|---|---|---|
| `SERVER_URL` / `IAC_SERVER_URL` | IACMSY26 Backend URL reachable from this PC | `http://localhost:3000` (development only) |
| `DEVICE_ID` | Unique identifier for this PC | Hostname |
| `DEVICE_NAME` | Human-friendly label | Hostname |
| `LOCATION` | Room or lab name | `Training Lab` |
| `DEPARTMENT` | Department name | `Engineering Lab` |
| `ASSIGNED_USER` | User responsible for this PC | Current OS user |
| `SERIAL_NUMBER` | Device serial number | Hostname-based value |
| `AGENT_TOKEN` | Shared token required by the production backend | None |
| `SIMULATE_COMMANDS` | Set to `"true"` to simulate without actual reboot | `false` |

---

## Running the Agent

### Start directly

```bash
npm start
```

### Run as a background service on Windows

Use Windows Task Scheduler or NSSM (Non-Sucking Service Manager):

```cmd
nssm.exe install "IACMSY26-Agent" "node.exe" "C:\path\to\agent\index.js"
nssm.exe start "IACMSY26-Agent"
```

### Run as a systemd service on Linux

Create `/etc/systemd/system/iac-agent.service`:

```ini
[Unit]
Description=IACMSY26 Laboratory PC Remote Management Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/iac-agent
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now iac-agent
```
