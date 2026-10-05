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
                operatingSystem: "Linux (TestOS)",
                ipAddress: "192.168.1.50",
                location: agentConfig.location,
                department: agentConfig.department
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
    console.log("✓ Database device verified: active and registered");

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
