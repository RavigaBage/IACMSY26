class CommandLifecycleEngine {

    constructor(repo, socketService, eventBus) {
        this.repo = repo;
        this.socketService = socketService;
        this.eventBus = eventBus;

        this.timeoutMap = new Map();
    }

    // =========================
    // ▶ START ENGINE LOOP
    // =========================

    async start() {
        console.log("[LifecycleEngine] running...");

        setInterval(() => this.tick(), 2000);
    }

    // =========================
    // 🔄 MAIN ENGINE LOOP
    // =========================

    async tick() {
        await this.queuePending();
        await this.dispatchQueued();
        await this.recoverStuck();
    }

    // =========================
    // 📦 PENDING → QUEUED
    // =========================

    async queuePending() {

        const commands = await this.repo.getPendingCommands?.() || [];

        for (const cmd of commands) {

            await this.repo.updateStatus(cmd._id, "QUEUED");

            // 📡 REAL-TIME EVENT
            this.eventBus.emitToDashboard("COMMAND_CREATED", {
                commandId: cmd._id,
                type: cmd.commandType
            });
        }
    }

    // =========================
    // 🚚 DISPATCH QUEUED COMMANDS
    // =========================

    async dispatchQueued() {

        const commands = await this.repo.getQueuedCommands();

        for (const command of commands) {

            const targets = await this.repo.getTargets(command._id);

            for (const target of targets) {

                const device = await this.repo.getDevice(target.deviceId);

                // ❌ DEVICE OFFLINE
                if (!device || device.agentStatus !== "online") {

                    await this.repo.markFailed(
                        target._id,
                        "Device offline"
                    );

                    this.eventBus.emitToDashboard("COMMAND_FAILED", {
                        commandId: command._id,
                        deviceId: device?._id,
                        reason: "Device offline"
                    });

                    continue;
                }

                // 🚀 SEND TO DEVICE
                this.socketService.emitToDevice(
                    device._id,
                    "device:command",
                    {
                        commandId: command._id,
                        targetId: target._id,
                        type: command.commandType,
                        payload: command.payload
                    }
                );

                await this.repo.markSent(target._id);

                await this.repo.updateStatus(command._id, "SENT");

                // 📡 DASHBOARD EVENT
                this.eventBus.emitToDashboard("COMMAND_SENT", {
                    commandId: command._id,
                    deviceId: device._id
                });

                // ⏱ REGISTER TIMEOUT
                this.registerTimeout(
                    target._id,
                    command.timeoutSeconds
                );
            }
        }
    }

    // =========================
    // ⏱ TIMEOUT HANDLER
    // =========================

    registerTimeout(targetId, timeoutSeconds) {

        const timeout = setTimeout(async () => {

            const target = await this.repo.getTarget(targetId);

            if (!target || target.status === "COMPLETED") return;

            await this.repo.updateTargetStatus(
                targetId,
                "TIMED_OUT"
            );

            this.eventBus.emitToDashboard("COMMAND_FAILED", {
                commandId: target.commandId,
                targetId,
                reason: "Timeout"
            });

            await this.retryTarget(targetId);

        }, timeoutSeconds * 1000);

        this.timeoutMap.set(targetId, timeout);
    }

    // =========================
    // 🔁 RETRY LOGIC
    // =========================

    async retryTarget(targetId) {

        const target = await this.repo.getTarget(targetId);

        if (!target) return;

        if (target.attemptCount >= 3) {

            await this.repo.updateTargetStatus(
                targetId,
                "FAILED"
            );

            this.eventBus.emitToDashboard("COMMAND_FAILED", {
                commandId: target.commandId,
                targetId,
                reason: "Max retries exceeded"
            });

            return;
        }

        await this.repo.incrementAttempt(targetId);

        const command = await this.repo.getCommand(target.commandId);
        const device = await this.repo.getDevice(target.deviceId);

        if (!device || device.agentStatus !== "online") {
            return;
        }

        // 🔁 RESEND COMMAND
        this.socketService.emitToDevice(
            device._id,
            "device:command",
            {
                commandId: command._id,
                targetId,
                type: command.commandType,
                payload: command.payload
            }
        );

        await this.repo.updateTargetStatus(targetId, "SENT");

        this.eventBus.emitToDashboard("COMMAND_SENT", {
            commandId: command._id,
            deviceId: device._id,
            retry: true
        });

        this.registerTimeout(
            targetId,
            command.timeoutSeconds
        );
    }

    // =========================
    // 🧹 RECOVERY LOOP
    // =========================

    async recoverStuck() {

        const stuck = await this.repo.getStuckTargets?.() || [];

        for (const target of stuck) {

            await this.retryTarget(target._id);
        }
    }
}

module.exports = CommandLifecycleEngine;