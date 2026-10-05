
class CommandDispatcher {
    
    constructor(repo, socketService) {
        this.repo = repo;
        this.socketService = socketService;
    }

    async enqueue(commandId) {
        return await this.repo.updateStatus(commandId, "QUEUED");
    }

    async run() {
        try {
            const commands = await this.repo.getQueuedCommands();
            for (const command of commands) {
                await this.dispatch(command._id);
            }

            return commands;
        } catch (error) {
            console.error("Error running dispatcher:", error);
            return { status: "error", message: "Error running dispatcher" };
        }
    }
    async dispatchUpdate(deviceId) {
        try {
            const device = await this.repo.getDevice(deviceId);
            const targetKey = device?.deviceId || deviceId;
            let ack = null;
            try {
                ack = await this.socketService.emitToDeviceWithAck(
                    targetKey,
                    "device:status",
                    {},
                    5000
                );
            } catch (firstErr) {
                if (device?._id && device._id.toString() !== targetKey) {
                    ack = await this.socketService.emitToDeviceWithAck(
                        device._id.toString(),
                        "device:status",
                        {},
                        5000
                    );
                } else {
                    throw firstErr;
                }
            }

            if (ack) {
                try {
                    const { devices } = require("../models");
                    const mongoose = require("mongoose");
                    const query = mongoose.Types.ObjectId.isValid(deviceId)
                        ? { $or: [{ _id: deviceId }, { deviceId: deviceId }] }
                        : { deviceId: deviceId };
                    await devices.findOneAndUpdate(
                        query,
                        { $set: { "status.remoteAgent": "active", "security.lastSeen": new Date() } }
                    );
                } catch (dbErr) {
                    console.warn("Could not update device status on ping:", dbErr.message);
                }
            }

            return {
                status: "ok",
                agent: true,           
                networkStatus: ack ? (ack.hasInternet !== false) : true
            };
        } catch (err) {
            try {
                const { devices } = require("../models");
                const mongoose = require("mongoose");
                const query = mongoose.Types.ObjectId.isValid(deviceId)
                    ? { $or: [{ _id: deviceId }, { deviceId: deviceId }] }
                    : { deviceId: deviceId };
                await devices.findOneAndUpdate(
                    query,
                    { $set: { "status.remoteAgent": "offline" } }
                );
            } catch (dbErr) {}
            return { status: "error", agent: false, networkStatus: false };
        }
    }

    async dispatch(commandId) {
        try {
            const command = await this.repo.getCommand(commandId);

            if (!command) {
                console.warn(`❌ [ERROR] Command not found: ${commandId}`);
                return;
            }

            const targets = await this.repo.getTargets(commandId);
            const keysTarget = Object.keys(targets).length;
            await this.repo.updateStatus(commandId, "SENT");
            console.log("Targets for command", commandId, targets);

            for (let i = 0; i < keysTarget; i++) {
                const target = targets[i];
                if (target.deviceId) {
                    const Room_ID = await this.repo.getRoomId(target.deviceId);
                    if (Room_ID) {
                        const devKey = Room_ID.deviceId || Room_ID._id?.toString();
                        const isOnline = this.socketService.isDeviceOnline(Room_ID.deviceId) ||
                                         this.socketService.isDeviceOnline(Room_ID._id?.toString()) ||
                                         this.socketService.isDeviceOnline(target.deviceId);

                        if (!isOnline) {
                            console.warn(`⚠️  [SKIP] device=${target.deviceId} (${devKey}) is offline`);
                            await this.repo.markOffline(target._id, "Device is offline");
                            continue;
                        }

                        const targetRoom = (Room_ID.deviceId && this.socketService.isDeviceOnline(Room_ID.deviceId))
                            ? Room_ID.deviceId
                            : (Room_ID._id ? Room_ID._id.toString() : target.deviceId);

                        const cmdPayload = {
                            commandId: (command._id || command.id).toString(),
                            type: command.commandType,
                            payload: command.payload || {},
                            deviceId: Room_ID.deviceId || target.deviceId,
                            targetId: target._id?.toString()
                        };

                        this.socketService.emitToDevice(targetRoom, "device:command", cmdPayload);

                        await this.repo.markSent(target._id, "SENT");
                    } else {
                        console.warn("Device room not found for target:", target.deviceId);
                        await this.repo.markOffline(target._id, "Device record not found");
                    }
                } else {
                    console.log("Target missing deviceId:", target);
                }
            }

        } catch (error) {
            console.error("Error dispatching command:", error);
            await this.repo.updateStatus(commandId, "FAILED");
        }
    }

    registerDeviceListeners(socket) {
        const defaultDeviceId = socket.deviceId;

        socket.on("command:ack", async (data) => {
            const commandId = data?.commandId;
            const devId = data?.deviceId || socket.deviceId || defaultDeviceId;
            console.log(`[CommandDispatcher] ACK from ${devId} for command ${commandId}`);
            if (commandId) {
                await this.repo.markTargetStatusByCommand(commandId, devId, "ACKNOWLEDGED");
            }
        });

        socket.on("command:running", async (data) => {
            const commandId = data?.commandId;
            const devId = data?.deviceId || socket.deviceId || defaultDeviceId;
            console.log(`[CommandDispatcher] RUNNING on ${devId} for command ${commandId}`);
            if (commandId) {
                await this.repo.markTargetStatusByCommand(commandId, devId, "RUNNING");
            }
        });

        socket.on("command:complete", async (data) => {
            const { commandId, stdout, result } = data || {};
            const devId = data?.deviceId || socket.deviceId || defaultDeviceId;
            console.log(`[CommandDispatcher] COMPLETE on ${devId} for command ${commandId}`);
            if (commandId) {
                await this.repo.markTargetStatusByCommand(commandId, devId, "COMPLETED", {
                    stdout: stdout || (result ? JSON.stringify(result) : "Success"),
                    result: result || {}
                });
            }
        });

        socket.on("command:failed", async (data) => {
            const { commandId, error } = data || {};
            const devId = data?.deviceId || socket.deviceId || defaultDeviceId;
            console.log(`[CommandDispatcher] FAILED on ${devId} for command ${commandId}: ${error}`);
            if (commandId) {
                await this.repo.markTargetStatusByCommand(commandId, devId, "FAILED", { error });
            }
        });

        socket.on("device:heartbeat", async (data) => {
            try {
                const devId = data?.deviceId || socket.deviceId || defaultDeviceId;
                const { devices } = require("../models");
                const mongoose = require("mongoose");
                const query = mongoose.Types.ObjectId.isValid(devId)
                    ? { $or: [{ _id: devId }, { deviceId: devId }] }
                    : { deviceId: devId };
                await devices.findOneAndUpdate(
                    query,
                    { $set: { "status.remoteAgent": "active", "security.lastSeen": new Date() } }
                );
            } catch (err) {}
        });
    }

    async sweepStalledCommands(thresholdSeconds = 60) {
        const stalled = await this.repo.findTargetsByStatus("DELIVERED", { olderThanSeconds: thresholdSeconds });

        for (const target of stalled) {
            await this.repo.markTargetStatus(target.id, "TIMED_OUT");
        }
    }
}

module.exports = CommandDispatcher;