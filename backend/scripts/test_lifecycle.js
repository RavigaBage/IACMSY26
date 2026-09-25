const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const assert = require('assert');

const models = require('../src/models');
const CommandRepository = require('../src/services/commandRepository');
const CommandLifecycleEngine = require('../src/services/CommandLifecycle');

async function runTests() {
    console.log("==================================================");
    console.log("🧪 STARTING STANDALONE COMMAND LIFECYCLE ENGINE TEST");
    console.log("==================================================");

    // 1. Setup in-memory MongoDB
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log("✓ Connected to MongoMemoryServer at:", uri);

    const repo = new CommandRepository(models);

    // Mock eventBus and socketService to record events
    const dashboardEvents = [];
    const socketEmits = [];

    const mockEventBus = {
        emitToDashboard: (event, payload) => {
            dashboardEvents.push({ event, payload });
        }
    };

    const mockSocketService = {
        emitToDevice: (deviceId, event, payload) => {
            socketEmits.push({ deviceId, event, payload });
        }
    };

    const engine = new CommandLifecycleEngine(repo, mockSocketService, mockEventBus);

    // ==========================================
    // TEST 1: PENDING -> QUEUED -> SENT (Active Device)
    // ==========================================
    console.log("\n▶ Running Test 1: Active Device Workflow (PENDING -> QUEUED -> SENT)...");

    const activeDevice = await models.devices.create({
        deviceName: "Active Lab PC",
        deviceId: "LAB-PC-ACTIVE",
        status: {
            networkValidation: "validated",
            remoteAgent: "active",
            authentication: "verified"
        }
    });

    const activeCommand = await models.deviceCommand.create({
        commandType: "SYSTEM_RESTART",
        payload: { force: true },
        status: "PENDING",
        timeoutSeconds: 60
    });

    const activeTarget = await models.deviceCommandTarget.create({
        commandId: activeCommand._id.toString(),
        deviceId: activeDevice.deviceId,
        status: "PENDING",
        attemptCount: 0
    });

    console.log("  Seeded Command:", activeCommand._id, "Target:", activeTarget._id, "Device:", activeDevice.deviceId);

    // Call .queuePending()
    await engine.queuePending();

    const queuedCmd = await models.deviceCommand.findById(activeCommand._id);
    assert.strictEqual(queuedCmd.status, "QUEUED", "Command should transition from PENDING to QUEUED");
    console.log("  ✓ queuePending(): Command status is QUEUED");

    const createdEvent = dashboardEvents.find(e => e.event === "COMMAND_CREATED" && e.payload.commandId.toString() === activeCommand._id.toString());
    assert(createdEvent, "COMMAND_CREATED event should be emitted to dashboard");
    console.log("  ✓ queuePending(): Emitted COMMAND_CREATED dashboard event");

    // Call .dispatchQueued()
    await engine.dispatchQueued();

    const sentCmd = await models.deviceCommand.findById(activeCommand._id);
    assert.strictEqual(sentCmd.status, "SENT", "Command should transition from QUEUED to SENT");
    console.log("  ✓ dispatchQueued(): Command status is SENT");

    const sentTarget = await models.deviceCommandTarget.findById(activeTarget._id);
    assert.strictEqual(sentTarget.status, "SENT", "Target should transition from PENDING to SENT");
    console.log("  ✓ dispatchQueued(): Target status is SENT");

    const sentSocketCall = socketEmits.find(s => s.deviceId === "LAB-PC-ACTIVE" && s.event === "device:command");
    assert(sentSocketCall, "Socket emitToDevice should be called for device LAB-PC-ACTIVE");
    assert.strictEqual(sentSocketCall.payload.type, "SYSTEM_RESTART");
    console.log("  ✓ dispatchQueued(): socketService.emitToDevice called with device:command on LAB-PC-ACTIVE");

    const sentDashboardEvent = dashboardEvents.find(e => e.event === "COMMAND_SENT" && e.payload.commandId.toString() === activeCommand._id.toString());
    assert(sentDashboardEvent, "COMMAND_SENT event should be emitted to dashboard");
    assert.strictEqual(sentDashboardEvent.payload.deviceId, "LAB-PC-ACTIVE");
    console.log("  ✓ dispatchQueued(): Emitted COMMAND_SENT dashboard event with deviceId LAB-PC-ACTIVE");

    // ==========================================
    // TEST 2: Offline Device Path (status.remoteAgent: "offline")
    // ==========================================
    console.log("\n▶ Running Test 2: Offline Device Path (status.remoteAgent: 'offline')...");

    const offlineDevice = await models.devices.create({
        deviceName: "Offline Lab PC",
        deviceId: "LAB-PC-OFFLINE",
        status: {
            networkValidation: "validated",
            remoteAgent: "offline",
            authentication: "verified"
        }
    });

    const offlineCommand = await models.deviceCommand.create({
        commandType: "SYSTEM_SHUTDOWN",
        payload: {},
        status: "QUEUED",
        timeoutSeconds: 60
    });

    const offlineTarget = await models.deviceCommandTarget.create({
        commandId: offlineCommand._id.toString(),
        deviceId: offlineDevice.deviceId,
        status: "PENDING",
        attemptCount: 0
    });

    console.log("  Seeded Offline Command:", offlineCommand._id, "Target:", offlineTarget._id, "Device:", offlineDevice.deviceId);

    await engine.dispatchQueued();

    const failedTarget = await models.deviceCommandTarget.findById(offlineTarget._id);
    assert.strictEqual(failedTarget.status, "FAILED", "Target on offline device should be marked FAILED");
    assert.strictEqual(failedTarget.errorMessage, "Device offline", "Target errorMessage should be 'Device offline'");
    console.log("  ✓ dispatchQueued() on offline device: Target status is FAILED with errorMessage 'Device offline'");

    const failedEvent = dashboardEvents.find(e => e.event === "COMMAND_FAILED" && e.payload.reason === "Device offline" && e.payload.commandId.toString() === offlineCommand._id.toString());
    assert(failedEvent, "COMMAND_FAILED event should be emitted for offline device");
    console.log("  ✓ dispatchQueued() on offline device: Emitted COMMAND_FAILED dashboard event with reason 'Device offline'");

    // ==========================================
    // TEST 3: retryTarget() with attemptCount >= 3
    // ==========================================
    console.log("\n▶ Running Test 3: retryTarget() with attemptCount >= 3...");

    const maxRetryCommand = await models.deviceCommand.create({
        commandType: "SYSTEM_LOCK",
        payload: {},
        status: "SENT",
        timeoutSeconds: 60
    });

    const maxRetryTarget = await models.deviceCommandTarget.create({
        commandId: maxRetryCommand._id.toString(),
        deviceId: activeDevice.deviceId,
        status: "TIMED_OUT",
        attemptCount: 3
    });

    console.log("  Seeded Target with attemptCount: 3 ->", maxRetryTarget._id);

    await engine.retryTarget(maxRetryTarget._id);

    const maxRetryResult = await models.deviceCommandTarget.findById(maxRetryTarget._id);
    assert.strictEqual(maxRetryResult.status, "FAILED", "Target with >= 3 attempts should be marked FAILED");
    assert.strictEqual(maxRetryResult.errorMessage, "Max retries exceeded");
    console.log("  ✓ retryTarget(): Target status transitioned to FAILED (Max retries exceeded)");

    const maxRetriesEvent = dashboardEvents.find(e => e.event === "COMMAND_FAILED" && e.payload.reason === "Max retries exceeded" && e.payload.targetId.toString() === maxRetryTarget._id.toString());
    assert(maxRetriesEvent, "COMMAND_FAILED event should be emitted with reason 'Max retries exceeded'");
    console.log("  ✓ retryTarget(): Emitted COMMAND_FAILED dashboard event with reason 'Max retries exceeded'");

    // Cleanup
    engine.clearTimeouts();
    await mongoose.disconnect();
    await mongoServer.stop();

    console.log("\n==================================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");
}

runTests().catch(err => {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
});
