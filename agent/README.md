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
  - `SYSTEM_SLEEP` / `SLEEP` (with a warning/grace period and active-session check)
  - `SYSTEM_SLEEP_CANCEL` / `CANCEL_SLEEP`
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

For a repeatable install, `npm ci` is also supported when using the included `package-lock.json`.

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
    "allowRemoteSleep": true,
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
| `SIMULATE_COMMANDS` | Set to `"true"` to simulate remote commands without changing PC power state | `false` |

---

## Running the Agent

### Check the agent and server connection

Run these from the agent folder after configuring `config.json`:

```powershell
npm test
npm run test:connection
```

The self-test checks device identity, network details, the command allowlist, simulated sleep, and the local sleep permission. The connection check performs the Socket.IO handshake (including backend token authentication) but does not register a device or run a command.

### Start directly

```bash
npm start
```

### Install in the background on Windows

1. Install Node.js 18 or later for all users on the laboratory PC.
2. Copy/extract the `agent` folder to the PC. Do not copy a `node_modules` folder or `.device_id`; the installer creates a unique identity for each PC.
3. Open PowerShell as Administrator, change to the extracted agent folder, then run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Install-Agent.ps1 -ServerUrl "https://rdm.example.edu" -Location "Training Lab"
```

Use the backend URL that is reachable from the lab PC. The installer securely prompts for the backend `AGENT_TOKEN`, stores the agent under `C:\ProgramData\IACMSY26\Agent`, installs its Node dependency, and creates/starts a hidden-at-startup Scheduled Task running as `SYSTEM`. The task runs without an administrator logged in and writes output to `C:\ProgramData\IACMSY26\Agent\logs\agent.log`.

For a safe first connection test, add `-SimulationMode` to the install command. This connects and registers the PC but simulates remote commands. After confirming the device appears online, rerun the installer without `-SimulationMode` to enable actual commands. Sleep may be skipped if an active session is present, according to the dashboard safety setting.

To test the installation, run from the extracted agent folder in PowerShell:

```powershell
.\Test-Agent.ps1
```

The test runs the local self-check and verifies that the backend accepts the configured Socket.IO connection and token. It does not issue shutdown, restart, or sleep commands. Review the log at `C:\ProgramData\IACMSY26\Agent\logs\agent.log` if the task does not stay running.

To stop and remove the task, run these commands in PowerShell as Administrator:

```powershell
Stop-ScheduledTask -TaskName "IACMSY26-Agent" -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName "IACMSY26-Agent" -Confirm:$false
```

The agent files, local token, and logs remain under ProgramData so they can be reviewed or removed separately by an administrator.

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
