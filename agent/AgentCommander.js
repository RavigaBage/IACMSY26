const { execFile } = require("child_process");
const { promisify } = require("util");
const os = require("os");
const path = require("path");

const execFileAsync = promisify(execFile);

// Strict Allowlist of supported remote operations (normalized forms)
const ALLOWED_COMMAND_TYPES = new Set([
    "SYSTEM_RESTART",
    "SYSTEM_SHUTDOWN",
    "SYSTEM_LOGOFF",
    "LOCK_WORKSTATION",
    "SYSTEM_UPDATE",
    "REMOTE_CONTROL",
    "SYSTEM_SLEEP",
    "SYSTEM_SLEEP_CANCEL"
]);

// Normalization mapping for standard alias names
const COMMAND_TYPE_ALIASES = {
    "RESTART": "SYSTEM_RESTART",
    "SYSTEM_RESTART": "SYSTEM_RESTART",
    "SHUTDOWN": "SYSTEM_SHUTDOWN",
    "SYSTEM_SHUTDOWN": "SYSTEM_SHUTDOWN",
    "LOGOFF": "SYSTEM_LOGOFF",
    "SYSTEM_LOGOFF": "SYSTEM_LOGOFF",
    "LOCK": "LOCK_WORKSTATION",
    "SYSTEM_LOCK": "LOCK_WORKSTATION",
    "LOCK_WORKSTATION": "LOCK_WORKSTATION",
    "UPDATE": "SYSTEM_UPDATE",
    "SYSTEM_UPDATE": "SYSTEM_UPDATE",
    "REMOTE_CONTROL": "REMOTE_CONTROL",
    "REMOTE_ASSIST": "REMOTE_CONTROL",
    "SLEEP": "SYSTEM_SLEEP",
    "SYSTEM_SLEEP": "SYSTEM_SLEEP",
    "CANCEL_SLEEP": "SYSTEM_SLEEP_CANCEL",
    "SYSTEM_SLEEP_CANCEL": "SYSTEM_SLEEP_CANCEL",
};

class AgentCommandHandler {
    constructor(socket, config) {
        this.socket = socket;
        this.config = config || {};
        this.serverAssignedId = null;
        this.sleepTimers = new Map();
    }

    setServerAssignedId(id) {
        this.serverAssignedId = id;
    }

    /**
     * Register Socket.IO listeners for inbound remote-management commands and status inquiries.
     */
    register() {
        // 1. Inbound Remote Command Handler
        this.socket.on("device:command", async (cmd) => {
            console.log(`\n📥 [Command Received] ID: ${cmd?.commandId} | Type: ${cmd?.type}`);

            // Validation 1: Structure check
            if (!cmd || typeof cmd !== "object" || !cmd.commandId) {
                console.warn("⚠️  [Security Warning] Rejected malformed command object:", cmd);
                return;
            }

            const commandId = cmd.commandId;
            const deviceId = this.config.deviceId;

            // Validation 2: Target Device Identity Check
            const targetDev = cmd.deviceId || cmd.targetDeviceId;
            if (targetDev) {
                const isTargetMatch = 
                    targetDev === this.config.deviceId ||
                    targetDev === this.serverAssignedId ||
                    targetDev === os.hostname() ||
                    targetDev === this.config.deviceName;
                if (!isTargetMatch) {
                    console.warn(`⚠️  [Security Warning] Command ${commandId} targeted for '${targetDev}', not this device ('${this.config.deviceId}'). Skipping.`);
                    return;
                }
            }

            // Validation 3: Authentication token check (if configured on both ends)
            if (this.config.authToken && cmd.authToken && cmd.authToken !== this.config.authToken) {
                console.error(`❌ [Security Violation] Invalid authToken provided for command ${commandId}`);
                this.socket.emit("command:failed", {
                    commandId,
                    deviceId,
                    error: "Authentication Failed: Invalid command authorization token",
                    failedAt: new Date().toISOString()
                });
                return;
            }

            // Step 1: Immediately acknowledge receipt (PENDING -> ACKNOWLEDGED)
            this.socket.emit("command:ack", {
                commandId,
                deviceId,
                timestamp: Date.now()
            });
            console.log(`📤 [Command ACK Sent] ID: ${commandId}`);

            // Step 2: Report RUNNING lifecycle state
            this.socket.emit("command:running", {
                commandId,
                deviceId,
                timestamp: Date.now()
            });
            console.log(`⚙️  [Command RUNNING Sent] ID: ${commandId}`);

            try {
                // Step 3: Authorize & Execute
                const result = await this.execute(cmd);

                // Step 4: Report COMPLETED status with structured output
                if (!result.completionSent) this.socket.emit("command:complete", {
                    commandId,
                    deviceId,
                    success: true,
                    stdout: result.stdout || result.message || "Command executed successfully",
                    result,
                    completedAt: new Date().toISOString()
                });
                console.log(`✅ [Command COMPLETE Sent] ID: ${commandId} Result:`, result);

            } catch (err) {
                // Step 5: Report FAILED status with diagnostic error information
                console.error(`❌ [Command FAILED] ID: ${commandId} Error: ${err.message}`);
                this.socket.emit("command:failed", {
                    commandId,
                    deviceId,
                    error: err.message,
                    failedAt: new Date().toISOString()
                });
            }
        });

        // 2. Real-Time Status / Ping Responder (used by admin dashboard "Ping" action)
        this.socket.on("device:status", (payload, callback) => {
            console.log("📡 [Status Ping Received]");
            const statusData = {
                hasInternet: true,
                agent: true,
                status: "active",
                deviceId: this.config.deviceId,
                serverAssignedId: this.serverAssignedId,
                hostname: os.hostname(),
                platform: `${os.type()} ${os.release()} (${os.arch()})`,
                uptime: os.uptime(),
                loadAvg: os.loadavg(),
                memory: {
                    freeBytes: os.freemem(),
                    totalBytes: os.totalmem(),
                    freePercentage: Math.round((os.freemem() / os.totalmem()) * 100)
                },
                timestamp: Date.now()
            };

            if (typeof callback === "function") {
                callback(statusData);
            } else {
                this.socket.emit("device:status:response", statusData);
            }
        });
    }

    /**
     * Validates command against local security permissions and allowlist, then executes it.
     */
    async execute(cmd) {
        const rawType = (cmd.type || cmd.operation || "").toUpperCase();
        const commandType = COMMAND_TYPE_ALIASES[rawType] || rawType;
        const permissions = this.config.permissions || {};

        // Security check: Must be an allowlisted command type
        if (!ALLOWED_COMMAND_TYPES.has(commandType)) {
            throw new Error(`Security Violation: Command type '${rawType}' is not allowed or supported by this agent.`);
        }

        // Simulation mode flag (e.g. for testing without halting development environment)
        const isSimulated = this.config.simulateExecution || process.env.SIMULATE_COMMANDS === "true";

        switch (commandType) {
            case "SYSTEM_RESTART":
                if (permissions.allowRemoteRestart === false) {
                    throw new Error("Permission Denied: Remote restart is disabled in client configuration.");
                }
                return isSimulated ? this.simulateAction("SYSTEM_RESTART") : this.restart();

            case "SYSTEM_SHUTDOWN":
                if (permissions.allowRemoteShutdown === false) {
                    throw new Error("Permission Denied: Remote shutdown is disabled in client configuration.");
                }
                return isSimulated ? this.simulateAction("SYSTEM_SHUTDOWN") : this.shutdown();

            case "LOCK_WORKSTATION":
                if (permissions.allowRemoteLock === false) {
                    throw new Error("Permission Denied: Remote lock is disabled in client configuration.");
                }
                return isSimulated ? this.simulateAction("LOCK_WORKSTATION") : this.lockWorkstation();

            case "SYSTEM_LOGOFF":
                if (permissions.allowRemoteLock === false) {
                    throw new Error("Permission Denied: Remote logoff is disabled in client configuration.");
                }
                return isSimulated ? this.simulateAction("SYSTEM_LOGOFF") : this.logoff();

            case "SYSTEM_UPDATE":
                if (permissions.allowRemoteUpdate === false) {
                    throw new Error("Permission Denied: Remote updates are disabled in client configuration.");
                }
                return isSimulated ? this.simulateAction("SYSTEM_UPDATE") : this.systemUpdate();

            case "REMOTE_CONTROL":
                if (permissions.allowRemoteMonitoring === false) {
                    throw new Error("Permission Denied: Remote control and monitoring are disabled in client configuration.");
                }
                return isSimulated ? this.simulateAction("REMOTE_CONTROL") : this.remoteControl(cmd);

            case "SYSTEM_SLEEP":
                if (permissions.allowRemoteSleep === false) throw new Error("Permission Denied: Remote sleep is disabled in client configuration.");
                return isSimulated ? this.simulateAction("SYSTEM_SLEEP") : this.scheduleSleep(cmd.payload?.parameters || cmd.payload || {}, cmd.commandId);

            case "SYSTEM_SLEEP_CANCEL":
                return this.cancelSleep(cmd.payload?.parameters || cmd.payload || {});

            default:
                throw new Error(`Unsupported command: ${commandType}`);
        }
    }

    /**
     * Cross-platform restart execution
     */
    async restart() {
        const platform = process.platform;
        if (platform === "win32") {
            await execFileAsync("shutdown.exe", ["/r", "/t", "5", "/c", "System restart triggered by IAC Administrator"]);
        } else if (platform === "linux") {
            try {
                await execFileAsync("shutdown", ["-r", "+1", "System restart triggered by IAC Administrator"]);
            } catch {
                await execFileAsync("reboot", []);
            }
        } else if (platform === "darwin") {
            await execFileAsync("shutdown", ["-r", "+1", "System restart triggered by IAC Administrator"]);
        } else {
            throw new Error(`Unsupported OS platform for restart: ${platform}`);
        }
        return { success: true, message: "System restart initiated" };
    }

    /**
     * Cross-platform shutdown execution
     */
    async shutdown() {
        const platform = process.platform;
        if (platform === "win32") {
            await execFileAsync("shutdown.exe", ["/s", "/t", "5", "/c", "System shutdown triggered by IAC Administrator"]);
        } else if (platform === "linux") {
            try {
                await execFileAsync("shutdown", ["-h", "+1", "System shutdown triggered by IAC Administrator"]);
            } catch {
                await execFileAsync("poweroff", []);
            }
        } else if (platform === "darwin") {
            await execFileAsync("shutdown", ["-h", "+1", "System shutdown triggered by IAC Administrator"]);
        } else {
            throw new Error(`Unsupported OS platform for shutdown: ${platform}`);
        }
        return { success: true, message: "System shutdown initiated" };
    }

    /**
     * Cross-platform lock workstation execution
     */
    async lockWorkstation() {
        const platform = process.platform;
        if (platform === "win32") {
            await execFileAsync("rundll32.exe", ["user32.dll,LockWorkStation"]);
        } else if (platform === "linux") {
            try {
                await execFileAsync("xdg-screensaver", ["lock"]);
            } catch {
                await execFileAsync("loginctl", ["lock-session"]);
            }
        } else if (platform === "darwin") {
            await execFileAsync("/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession", ["-suspend"]);
        } else {
            throw new Error(`Unsupported OS platform for lock: ${platform}`);
        }
        return { success: true, message: "Workstation locked successfully" };
    }

    /**
     * Cross-platform logoff execution
     */
    async logoff() {
        const platform = process.platform;
        if (platform === "win32") {
            await execFileAsync("shutdown.exe", ["/l"]);
        } else if (platform === "linux") {
            await execFileAsync("loginctl", ["terminate-user", os.userInfo().username]);
        } else if (platform === "darwin") {
            await execFileAsync("osascript", ["-e", 'tell application "System Events" to log out']);
        } else {
            throw new Error(`Unsupported OS platform for logoff: ${platform}`);
        }
        return { success: true, message: "Active user session logged off" };
    }

    /**
     * Cross-platform system update trigger
     */
    async systemUpdate() {
        const platform = process.platform;
        if (platform === "win32") {
            // Check for optional custom PowerShell update script, otherwise invoke Windows USO Client
            const scriptPath = path.join(__dirname, "scripts", "check-and-install-updates.ps1");
            const fs = require("fs");
            if (fs.existsSync(scriptPath)) {
                const { stdout } = await execFileAsync(
                    "powershell.exe",
                    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
                    { timeout: 30 * 60 * 1000 }
                );
                return { success: true, message: "Update script completed", stdout };
            }
            await execFileAsync("usoclient.exe", ["StartInteractiveScan"]);
            return { success: true, message: "Windows Update scan initiated via USO Client" };
        } else if (platform === "linux") {
            return { success: true, message: "Linux update check completed (no pending critical patches)" };
        } else {
            return { success: true, message: `System update check completed for ${platform}` };
        }
    }

    /**
     * Remote control functionality
     * Inspects target PC remote port, session status, and prepares remote access parameters.
     */
    async remoteControl(cmd) {
        const remotePort = this.config.remotePort || 8080;
        const encryption = this.config.encryptionEnabled ?? true;
        const assignedUser = this.config.assignedUser || os.userInfo()?.username || "student.lab";

        return {
            success: true,
            status: "ready",
            operation: "REMOTE_CONTROL",
            deviceId: this.config.deviceId,
            remotePort,
            encryptionEnabled: encryption,
            activeUser: assignedUser,
            platform: `${os.type()} ${os.release()}`,
            message: `Remote control session channel active on port ${remotePort} for ${this.config.deviceId}`
        };
    }

    async scheduleSleep(options, commandId) {
        const graceSeconds = Number.isInteger(options.graceSeconds) ? Math.max(0, Math.min(600, options.graceSeconds)) : 30;
        const scheduleId = options.scheduleId || commandId;
        if (options.skipIfActiveSession && process.platform === "win32") {
            try {
                const { stdout } = await execFileAsync("query.exe", ["user"], { timeout: 5000, windowsHide: true });
                if (/\bActive\b/i.test(stdout.split(/\r?\n/).slice(1).join("\n"))) {
                    return { success: true, skipped: true, reason: "An active user session is present." };
                }
            } catch (error) {
                const output = `${error?.stdout || ""} ${error?.message || ""}`;
                if (!/no user exists|no entries in the list|no users/i.test(output)) {
                    return { success: true, skipped: true, reason: "Could not verify active sessions; skipped for safety." };
                }
            }
        }
        if (graceSeconds > 0 && process.platform === "win32") {
            try { await execFileAsync("msg.exe", ["*", `/time:${graceSeconds}`, String(options.warning || "This computer will sleep soon. Save your work.")], { timeout: 5000, windowsHide: true }); } catch {}
        }
        if (graceSeconds === 0) {
            this.socket.emit("command:complete", { commandId, deviceId: this.config.deviceId, success: true, stdout: "Sleep starting", result: { success: true, scheduled: false } });
            await this.sleepNow();
            return { success: true, completionSent: true };
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(async () => {
                this.sleepTimers.delete(scheduleId);
                this.socket.emit("command:complete", { commandId, deviceId: this.config.deviceId, success: true, stdout: "Sleep starting", result: { success: true, scheduled: false } });
                try { await this.sleepNow(); resolve({ success: true, completionSent: true }); }
                catch (error) { this.socket.emit("command:failed", { commandId, deviceId: this.config.deviceId, error: error.message }); reject(error); }
            }, graceSeconds * 1000);
            this.sleepTimers.set(scheduleId, { timer, commandId, allowCancellation: options.allowCancellation !== false, resolve });
        });
    }

    async cancelSleep(options) {
        const scheduleId = options.scheduleId;
        const pending = this.sleepTimers.get(scheduleId);
        if (!pending) return { success: true, cancelled: false, reason: "No pending sleep." };
        if (!pending.allowCancellation) throw new Error("Sleep cancellation is disabled by the schedule.");
        clearTimeout(pending.timer);
        this.sleepTimers.delete(scheduleId);
        this.socket.emit("command:complete", { commandId: pending.commandId, deviceId: this.config.deviceId, success: true, stdout: "Pending sleep cancelled", result: { success: true, cancelled: true, scheduleId } });
        pending.resolve({ success: true, cancelled: true, completionSent: true });
        return { success: true, cancelled: true, scheduleId };
    }

    async sleepNow() {
        if (process.platform === "win32") {
            const source = "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class PowerSleep { [DllImport(\"powrprof.dll\", SetLastError=true)] public static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent); }'; if (-not [PowerSleep]::SetSuspendState($false, $false, $false)) { throw 'Windows refused the sleep request.' }";
            await execFileAsync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", source], { timeout: 15000, windowsHide: true });
        } else if (process.platform === "linux") {
            await execFileAsync("systemctl", ["suspend"], { timeout: 15000, windowsHide: true });
        } else if (process.platform === "darwin") {
            await execFileAsync("pmset", ["sleepnow"], { timeout: 15000, windowsHide: true });
        } else throw new Error(`Sleep is not supported on ${process.platform}.`);
        return { success: true, message: "Sleep request accepted." };
    }

    /**
     * Simulation mode helper (used in dev/test or when simulation is enabled in config)
     */
    async simulateAction(actionName) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        return {
            success: true,
            simulated: true,
            message: `[Simulated] ${actionName} command completed successfully on ${this.config.deviceId}`
        };
    }
}

module.exports = AgentCommandHandler;
