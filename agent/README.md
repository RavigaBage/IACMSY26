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

---

## Target PC Hardware & OS Configuration for Sleep & Wake-on-LAN

For remote **Sleep** and **Wake-on-LAN** commands to operate successfully, the target PC's hardware (BIOS/UEFI), operating system, and network card must be configured as described below:

### 1. BIOS / UEFI Setup (Hardware Level)
1. Reboot the target PC and press `Del`, `F2`, or `F12` to enter BIOS/UEFI setup.
2. Locate the **Power Management** or **Advanced / ACPI** menu.
3. Enable **Wake-on-LAN (WoL)**, **Power On By PCI-E/PME**, or **Wake from Onboard LAN**.
4. **Disable ErP / EuP Ready** (or ErP S4+S5). When ErP is enabled, motherboard power to the Ethernet adapter is shut down during Sleep/Shutdown, preventing the NIC from receiving WoL packets.
5. Set ACPI Suspend State to **S3 (Suspend to RAM)**.
6. Save and exit (usually `F10`).

### 2. Windows Configuration
1. **Configure Network Adapter**:
   - Open **Device Manager** (`devmgmt.msc`).
   - Expand **Network adapters**, right-click the primary Ethernet adapter (e.g., Intel Ethernet / Realtek PCIe), and select **Properties**.
   - Go to the **Advanced** tab:
     - Set **Wake on Magic Packet** to **Enabled**.
     - Set **Shutdown Wake-On-Lan** to **Enabled** (if available).
     - Set **Energy Efficient Ethernet** / **Green Ethernet** to **Disabled** or default.
   - Go to the **Power Management** tab:
     - Check: **Allow this device to wake the computer**.
     - Check: **Only allow a magic packet to wake the computer** (prevents spurious wakes).
2. **Disable Fast Startup** (Critical for reliable WoL):
   - Open **Control Panel** -> **Power Options**.
   - Click **Choose what the power buttons do** on the left panel.
   - Click **Change settings that are currently unavailable**.
   - Uncheck **Turn on fast startup (recommended)**.
   - Click **Save changes**. *(Fast Startup puts Windows into a hybrid S4 state where standard network adapters often drop listening power).*
3. **Verify Armed Wake Devices**:
   - Open PowerShell or Command Prompt as Administrator and run:
     ```cmd
     powercfg /devicequery wake_armed
     ```
   - Ensure your Ethernet network adapter is listed in the output.

### 3. Linux Configuration
1. Install `ethtool` if not already present:
   ```bash
   sudo apt-get install ethtool  # Ubuntu/Debian
   ```
2. Check your current interface WoL status:
   ```bash
   sudo ethtool eth0 | grep Wake-on
   ```
3. Enable Magic Packet wake:
   ```bash
   sudo ethtool -s eth0 wol g
   ```
4. To persist across reboots with NetworkManager:
   ```bash
   nmcli connection modify "Wired connection 1" 802-3-ethernet.wake-on-lan magic
   ```

### 4. Network & Switch Configuration
- Use wired Ethernet cables for target lab PCs.
- Ensure the local lab router or network switch allows UDP broadcast packets on ports 7 and 9.
- If the IAC server is deployed in the cloud, other online agents running on the same local subnet will automatically act as a **WoL Relay** (`agent:wol:relay`), broadcasting the magic packet directly onto the local lab network segment!

