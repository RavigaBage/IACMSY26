const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { io: ClientIO } = require("socket.io-client");
const assert = require("assert");

const models = require("../src/models");
const SocketService = require("../src/services/socketService");
const { registerAgentService } = require("../src/services/RegisterDevice");
const { initServices } = require("../src/services");
const AgentCommandHandler = require("../../agent/AgentCommander");

async function runIntegrationTest() {
    console.log("==================================================");
    console.log("🧪 STARTING AGENT & BACKEND INTEGRATION TEST");
    console.log("==================================================");

    // 1. In-memory Mongo
    const mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    console.log("✓ Connected to In-Memory MongoDB");

    // 2. Setup Test Express & Socket.io server
    const app = express();
    app.use(express.json());
    const server = http.createServer(app);
    const io = new Server(server, { cors: { origin: "*" } });
    const socketService = new SocketService(io);
    const { commandService, dispatcher } = initServices(socketService);

    io.on("connection", (socket) => {
        socket.on("disconnect", async () => {
            if (socket.deviceId) socketService.unregisterDevice(socket.deviceId);
            if (socket.deviceMongoId) socketService.unregisterDevice(socket.deviceMongoId);
            const disQuery = [];
            if (socket.deviceId) disQuery.push({ deviceId: socket.deviceId });
            if (socket.deviceMongoId && mongoose.Types.ObjectId.isValid(socket.deviceMongoId)) {
                disQuery.push({ _id: socket.deviceMongoId });
            }
            if (disQuery.length > 0) {
                await models.devices.findOneAndUpdate(
                    { $or: disQuery },
                    { $set: { "status.remoteAgent": "offline", "security.lastSeen": new Date() } }
                );
            }
        });

        socket.on("agent:register", async (data) => {
            socket.deviceId = data.deviceId;
            socket.join(`device:${data.deviceId}`);
            const regResult = await registerAgentService(data);
            if (regResult?.data_?._id) {
                socket.deviceMongoId = regResult.data_._id.toString();
                socket.join(`device:${socket.deviceMongoId}`);
                socketService.registerDevice(socket.deviceMongoId, socket);
            }
            socketService.registerDevice(data.deviceId, socket);

            if (dispatcher) {
                dispatcher.registerDeviceListeners(socket);
            }

            socket.emit("agent:registered", {
                status: "success",
                deviceId: data.deviceId,
                id: socket.deviceMongoId
            });
        });
    });

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const serverUrl = `http://localhost:${port}`;
    console.log(`✓ Test Server running at ${serverUrl}`);

    // 3. Connect Client Agent
    const agentConfig = {
        serverUrl,
        deviceId: "TEST-LAB-PC-01",
        deviceName: "Test Workstation 01",
        department: "Computer Science",
        location: "Training Lab",
        simulateExecution: true,
        authToken: "test_token_123",
        permissions: {
            allowRemoteShutdown: true,
            allowRemoteRestart: true,
            allowRemoteLock: true,
            allowRemoteMonitoring: true,
            allowRemoteUpdate: true
        }
    };

    const clientSocket = ClientIO(serverUrl, {
        transports: ["websocket"],
        auth: { token: agentConfig.authToken, deviceId: agentConfig.deviceId }
    });

    const agentHandler = new AgentCommandHandler(clientSocket, agentConfig);
    agentHandler.register();

    let registeredAck = null;
    await new Promise((resolve) => {
        clientSocket.on("connect", () => {
            console.log("✓ Agent client connected to server");
            clientSocket.emit("agent:register", {
                deviceId: agentConfig.deviceId,
                deviceName: agentConfig.deviceName,
                hostname: "test-lab-pc-01",
                operatingSystem: "Linux (TestOS)",
                ipAddress: "192.168.1.50",
                macAddress: "00:11:22:33:44:55",
                location: agentConfig.location,
                department: agentConfig.department,
                assignedUser: "lab-admin",
                serialNumber: "SN-TEST-001",
                agentVersion: "1.2.3",
                remotePort: 8090,
                authenticationMode: "token",
                encryptionEnabled: false,
                permissions: { allowRemoteShutdown: false, allowRemoteRestart: true },
                adminNotes: "Initial registration",
            });
        });

        clientSocket.on("agent:registered", (ack) => {
            registeredAck = ack;
            agentHandler.setServerAssignedId(ack.id);
            console.log("✓ Agent received registration ack:", ack);
            resolve();
        });
    });

    assert(registeredAck, "Agent should receive registration ack");
    assert.strictEqual(registeredAck.deviceId, "TEST-LAB-PC-01");

    // 4. Verify Device in DB
    const dbDevice = await models.devices.findOne({ deviceId: "TEST-LAB-PC-01" });
    assert(dbDevice, "Device must exist in MongoDB");
    assert.strictEqual(dbDevice.status.remoteAgent, "active", "Device remoteAgent status must be 'active'");
    assert.strictEqual(dbDevice.operatingSystem, "Linux (TestOS)", "Registration should store operatingSystem even without the legacy platform field");
    console.log("✓ Database device verified: active and registered");

    const refreshResult = await registerAgentService({
        deviceId: agentConfig.deviceId,
        deviceName: "Configured Workstation",
        hostname: "test-lab-pc-01",
        ipAddress: "192.168.1.51",
        operatingSystem: "Windows 11",
        department: "Configured Department",
        location: "Configured Lab",
        assignedUser: "configured.user",
        serialNumber: "SN-CONFIGURED-002",
        agentVersion: "2.0.0",
        remotePort: 9090,
        authenticationMode: "certificate",
        encryptionEnabled: true,
        permissions: { allowRemoteShutdown: true, allowRemoteRestart: false },
        adminNotes: "Updated agent configuration",
    });
    assert.strictEqual(refreshResult.status, "success", "Re-registration should update the existing device");
    const refreshedDevice = await models.devices.findById(dbDevice._id);
    assert.strictEqual(refreshedDevice.deviceName, "Configured Workstation");
    assert.strictEqual(refreshedDevice.operatingSystem, "Windows 11");
    assert.strictEqual(refreshedDevice.department, "Configured Department");
    assert.strictEqual(refreshedDevice.location, "Configured Lab");
    assert.strictEqual(refreshedDevice.assignedUser, "configured.user");
    assert.strictEqual(refreshedDevice.serialNumber, "SN-CONFIGURED-002");
    assert.strictEqual(refreshedDevice.remotePort, 9090);
    assert.strictEqual(refreshedDevice.authenticationMode, "certificate");
    assert.strictEqual(refreshedDevice.encryptionEnabled, true);
    assert.strictEqual(refreshedDevice.permissions.allowRemoteShutdown, true);
    assert.strictEqual(refreshedDevice.permissions.allowRemoteRestart, false);
    assert.strictEqual(refreshedDevice.adminNotes, "Updated agent configuration");
    assert(refreshedDevice.security.ipHistory.includes("192.168.1.51"));
    console.log("✓ Re-registration refreshes configured device details");

    // 5. Test Status Ping (device-Status endpoint / dispatcher.dispatchUpdate)
    console.log("\n▶ Testing Administrator Ping (device:status)...");
    const pingResult = await dispatcher.dispatchUpdate(dbDevice._id.toString());
    assert.strictEqual(pingResult.status, "ok", "Ping status should be 'ok'");
    assert.strictEqual(pingResult.agent, true, "Ping agent should be true");
    console.log("✓ Administrator Ping succeeded:", pingResult);

    // 6. Test Remote Command: SYSTEM_RESTART
    console.log("\n▶ Testing Remote Command: SYSTEM_RESTART...");
    const cmdResult = await commandService.restart([dbDevice._id.toString()]);
    assert(cmdResult, "Command creation should return created command");
    const commandId = cmdResult._id.toString();
    console.log(`✓ Command created: ${commandId}, waiting for agent execution...`);

    // Give time for socket round-trip and simulated execution (800ms)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const updatedTarget = await models.deviceCommandTarget.findOne({ commandId });
    assert(updatedTarget, "Target record must exist");
    assert.strictEqual(updatedTarget.status, "COMPLETED", `Target status should be COMPLETED, got: ${updatedTarget.status}`);
    console.log("✓ Target status successfully reached COMPLETED!");

    const updatedCommand = await models.deviceCommand.findById(commandId);
    assert.strictEqual(updatedCommand.status, "COMPLETED", `Command status should be COMPLETED, got: ${updatedCommand.status}`);
    console.log("✓ Command status successfully reached COMPLETED!");

    // 7. Test Remote Command: REMOTE_CONTROL
    console.log("\n▶ Testing Remote Command: REMOTE_CONTROL...");
    const rcCommand = await commandService.createCommand("REMOTE_CONTROL", [dbDevice._id.toString()], {});
    assert(rcCommand, "REMOTE_CONTROL command should be created");
    const rcCommandId = rcCommand._id.toString();

    await new Promise((resolve) => setTimeout(resolve, 1500));
    const rcTarget = await models.deviceCommandTarget.findOne({ commandId: rcCommandId });
    assert(rcTarget, "REMOTE_CONTROL target must exist");
    assert.strictEqual(rcTarget.status, "COMPLETED", `REMOTE_CONTROL target status should be COMPLETED, got: ${rcTarget.status}`);
    console.log("✓ REMOTE_CONTROL successfully executed and reached COMPLETED!");

    // 8. Test Disconnect detection
    console.log("\n▶ Testing Disconnect Handling...");
    clientSocket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const disconnectedDevice = await models.devices.findById(dbDevice._id);
    assert.strictEqual(disconnectedDevice.status.remoteAgent, "offline", "Device should be marked offline on disconnect");
    console.log("✓ Device marked offline on disconnect verified!");

    // Cleanup
    server.close();
    await mongoose.disconnect();
    await mongoServer.stop();

    console.log("\n==================================================");
    console.log("🎉 ALL AGENT INTEGRATION TESTS PASSED!");
    console.log("==================================================");
}

runIntegrationTest().catch((err) => {
    console.error("❌ INTEGRATION TEST FAILED:", err);
    process.exit(1);
});
