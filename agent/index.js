const { io } = require("socket.io-client");
const fs = require("fs");
const os = require("os");
const path = require("path");
const AgentCommandHandler = require("./AgentCommander");

// 1. Load Configuration with Environment Variable Overrides
let baseConfig = {};
try {
    const configPath = path.join(__dirname, "config.json");
    if (fs.existsSync(configPath)) {
        baseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
} catch (err) {
    console.warn("⚠️  Could not read config.json, using defaults:", err.message);
}

// Ensure a stable unique device identifier across sessions
function getStableDeviceId(configuredId) {
    if (process.env.DEVICE_ID && process.env.DEVICE_ID.trim()) {
        return process.env.DEVICE_ID.trim();
    }
    if (configuredId && configuredId !== "auto" && configuredId.trim()) {
        return configuredId.trim();
    }

    const deviceIdFile = path.join(__dirname, ".device_id");
    try {
        if (fs.existsSync(deviceIdFile)) {
            const saved = fs.readFileSync(deviceIdFile, "utf-8").trim();
            if (saved) return saved;
        }
    } catch {}

    const generatedId = `LAB-${os.hostname().toUpperCase()}`;
    try {
        fs.writeFileSync(deviceIdFile, generatedId, "utf-8");
    } catch {}
    return generatedId;
}

const resolvedDeviceId = getStableDeviceId(baseConfig.deviceId);
const resolvedDeviceName = process.env.DEVICE_NAME || 
    (baseConfig.deviceName && baseConfig.deviceName !== "auto" && baseConfig.deviceName.trim() 
        ? baseConfig.deviceName.trim() 
        : os.hostname());

const resolvedAssignedUser = process.env.ASSIGNED_USER || 
    (baseConfig.assignedUser && baseConfig.assignedUser !== "auto" && baseConfig.assignedUser.trim() 
        ? baseConfig.assignedUser.trim() 
        : (os.userInfo()?.username || "lab.user"));

const resolvedSerialNumber = process.env.SERIAL_NUMBER || 
    (baseConfig.serialNumber && baseConfig.serialNumber !== "auto" && baseConfig.serialNumber.trim() 
        ? baseConfig.serialNumber.trim() 
        : `SN-${os.hostname().toUpperCase()}`);

const config = {
    serverUrl: process.env.SERVER_URL || process.env.IAC_SERVER_URL || baseConfig.serverUrl || "http://localhost:3000",
    deviceId: resolvedDeviceId,
    deviceName: resolvedDeviceName,
    agentVersion: baseConfig.agentVersion || "1.0.0",
    department: process.env.DEPARTMENT || baseConfig.department || "Engineering Lab",
    location: process.env.LOCATION || baseConfig.location || "Training Lab",
    assignedUser: resolvedAssignedUser,
    serialNumber: resolvedSerialNumber,
    remotePort: baseConfig.remotePort ?? 8080,
    authenticationMode: baseConfig.authenticationMode || "token",
    authToken: process.env.AGENT_TOKEN || baseConfig.authToken || "",
    encryptionEnabled: baseConfig.encryptionEnabled ?? true,
    reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL || baseConfig.reconnectInterval || 3000, 10),
    heartbeatInterval: parseInt(baseConfig.heartbeatInterval || 30000, 10),
    simulateExecution: baseConfig.simulateExecution || process.env.SIMULATE_COMMANDS === "true",
    permissions: {
        allowRemoteShutdown: baseConfig.permissions?.allowRemoteShutdown ?? true,
        allowRemoteRestart: baseConfig.permissions?.allowRemoteRestart ?? true,
        allowRemoteLock: baseConfig.permissions?.allowRemoteLock ?? true,
        allowRemoteMonitoring: baseConfig.permissions?.allowRemoteMonitoring ?? true,
        allowRemoteUpdate: baseConfig.permissions?.allowRemoteUpdate ?? true,
        allowFileTransfer: baseConfig.permissions?.allowFileTransfer ?? false,
    },
};

console.log("=================================================");
console.log("🚀 Starting IACMSY26 Laboratory PC Client Agent");
console.log("=================================================");
console.log(`📡 Target Server : ${config.serverUrl}`);
console.log(`🖥️  Device ID     : ${config.deviceId}`);
console.log(`🏷️  Device Name   : ${config.deviceName}`);
console.log(`📍 Location      : ${config.location} (${config.department})`);
console.log(`⚡ Simulation Mode: ${config.simulateExecution ? "ON (Safe Test)" : "OFF (Live System Actions)"}`);
console.log("-------------------------------------------------");

// Self-Test / Dry-Run CLI mode support
if (process.argv.includes("--test") || process.argv.includes("--dry-run")) {
    console.log("🧪 Running Agent Self-Diagnostic Test...");
    const ip = getPrimaryIpAddress();
    const mac = getPrimaryMacAddress();
    const osType = getOperatingSystem();
    console.log(`  ✓ Primary IP  : ${ip}`);
    console.log(`  ✓ MAC Address : ${mac || "N/A"}`);
    console.log(`  ✓ OS Platform : ${osType}`);
    const mockSocket = { on: () => {}, emit: () => {} };
    const mockHandler = new AgentCommandHandler(mockSocket, config);
    mockHandler.register();
    console.log("  ✓ Command handler registered with allowlisted commands");
    console.log("🎉 Self-diagnostic test PASSED successfully!");
    process.exit(0);
}

// 2. Hardware and Network Introspection
function getPrimaryIpAddress() {
    const ifaces = os.networkInterfaces();
    for (const iface of Object.values(ifaces)) {
        if (!iface) continue;
        for (const entry of iface) {
            if (entry.family === "IPv4" && !entry.internal) {
                return entry.address;
            }
        }
    }
    return "127.0.0.1";
}

function getPrimaryMacAddress() {
    const ifaces = os.networkInterfaces();
    for (const iface of Object.values(ifaces)) {
        if (!iface) continue;
        for (const entry of iface) {
            if (entry.mac && entry.mac !== "00:00:00:00:00:00" && !entry.internal) {
                return entry.mac;
            }
        }
    }
    return null;
}

function getOperatingSystem() {
    const platform = process.platform;
    const release = os.release();
    const type = os.type();

    if (platform === "win32") return `Windows (${release})`;
    if (platform === "darwin") return `macOS (${release})`;
    if (platform === "linux") return `${type} (${release})`;
    return `${platform} (${release})`;
}

// 3. Build Registration Payload matching IACMSY26 Backend Device Schema
function buildRegistrationPayload(socketId) {
    const primaryIp = getPrimaryIpAddress();
    return {
        deviceId: config.deviceId,
        socketId: socketId,
        deviceName: config.deviceName,
        hostname: os.hostname(),
        ipAddress: primaryIp,
        macAddress: getPrimaryMacAddress(),
        operatingSystem: getOperatingSystem(),
        platform: getOperatingSystem(),
        department: config.department,
        location: config.location,
        assignedUser: config.assignedUser,
        serialNumber: config.serialNumber,
        agentVersion: config.agentVersion,
        remotePort: config.remotePort,
        authenticationMode: config.authenticationMode,
        encryptionEnabled: config.encryptionEnabled,
        permissions: config.permissions,
        adminNotes: `Client Agent v${config.agentVersion} connected from ${primaryIp}`,
        status: {
            networkValidation: "validated",
            remoteAgent: "active",
            authentication: "verified",
        },
        security: {
            lastSeen: new Date().toISOString(),
            ipHistory: [primaryIp],
            flagged: false,
            riskLevel: "low",
        },
    };
}

// 4. Socket.IO Connection Setup
const socket = io(config.serverUrl, {
    reconnection: true,
    reconnectionDelay: config.reconnectInterval,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
    transports: ["websocket", "polling"],
    auth: {
        token: config.authToken,
        deviceId: config.deviceId,
    },
});

// 5. Initialize Command Handler
console.log("🧠 [Engine] Initializing Agent Command Handler...");
const handler = new AgentCommandHandler(socket, config);
handler.register();

let heartbeatTimer = null;

// 6. Connection Lifecycle & Registration
socket.on("connect", () => {
    console.log(`\n🟢 [Connected] Established Socket session with server (Socket ID: ${socket.id})`);
    console.log(`📡 [Registration] Registering device '${config.deviceId}' with IACMSY26 backend...`);

    const registrationData = buildRegistrationPayload(socket.id);
    socket.emit("agent:register", registrationData);

    // Start periodic heartbeat every heartbeatInterval ms
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (socket.connected) {
            socket.emit("device:heartbeat", {
                deviceId: config.deviceId,
                timestamp: Date.now(),
                uptime: os.uptime(),
            });
        }
    }, config.heartbeatInterval);
});

socket.on("agent:registered", (ack) => {
    if (ack?.status !== "success") {
        console.error(`❌ [Registration Failed] ${ack?.message || "Server did not confirm device registration"}`);
        return;
    }

    console.log("✅ [Registered] Server acknowledged registration:", ack);
    if (ack?.id) {
        handler.setServerAssignedId(ack.id);
        console.log(`🔑 [Device Session] Assigned Database Record ID: ${ack.id}`);
    }
});

socket.on("disconnect", (reason) => {
    console.log(`🔴 [Disconnected] Server connection lost (${reason}). Will attempt automatic reconnect...`);
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
});

socket.on("connect_error", (err) => {
    console.warn(`⚠️  [Connection Error] Cannot reach server at ${config.serverUrl}: ${err.message}`);
});

console.log("🎯 [Ready] Agent boot sequence complete. Listening for authorized remote management operations.");

// 7. Clean Shutdown Handling
function handleShutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Shutting down agent gracefully...`);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (socket && socket.connected) {
        socket.disconnect();
    }
    process.exit(0);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
