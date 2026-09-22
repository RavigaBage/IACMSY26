
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
            const ack = await this.socketService.emitToDeviceWithAck(
                deviceId,
                "device:status",
                {},
                5000
            );
            return {
                status: "ok",
                agent: true,           
                networkStatus: ack.hasInternet
            };
        } catch (err) {
            return { status: "error", agent: false, networkStatus: false };
        }
    }

    async dispatch(commandId) {

        const time = () => new Date().toISOString();

        try {
            const command = await this.repo.getCommand(commandId);

            if (!command) {
                console.warn(`❌ [ERROR] Command not found: ${commandId}`);
                return;
            }

            const targets = await this.repo.getTargets(commandId);
            const keysTarget = Object.keys(targets).length;
            await this.repo.updateStatus(commandId, "SENT");
            console.log("Target ",targets);
            for (let i = 0; i < keysTarget; i++) {
                const target = targets[i];
                if(target.deviceId) {

                    const Room_ID = await this.repo.getRoomId(target.deviceId);
                    if(Room_ID){
                        const isOnline = this.socketService.isDeviceOnline(Room_ID.deviceId)
                        if (!isOnline) {
                            console.warn(`⚠️  [SKIP] device=${target.deviceId} is offline`);
                            await this.repo.markOffline(target.id, "SKIPPED");
                            continue;
                        }

                        this.socketService.emitToDevice(
                            Room_ID.deviceId,
                            "device:command",
                            {
                                commandId: command.id,
                                type: command.commandType,
                                payload: command.payload
                            }
                        );

                        await this.repo.markSent(target._id, "SENT");
                    }
                }else{
                    console.log(target);
                }

            }


        } catch (error) {
            await this.repo.updateStatus(commandId, "FAILED");
        }
    }

    registerDeviceListeners(socket) {
        const deviceId = socket.deviceId;

        socket.on("command:ack", async ({ commandId }) => {
            await this.repo.markTargetStatusByCommand(commandId, deviceId, "DELIVERED");
        });

        socket.on("command:complete", async ({ commandId, stdout }) => {
            await this.repo.markTargetStatusByCommand(commandId, deviceId, "COMPLETED", { stdout });
        });

        socket.on("command:failed", async ({ commandId, error }) => {
            await this.repo.markTargetStatusByCommand(commandId, deviceId, "FAILED", { error });
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