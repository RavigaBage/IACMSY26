class CommandService {

    constructor(commandRepo, dispatcher) {
        this.commandRepo = commandRepo;
        this.dispatcher = dispatcher;
    }


    async restart(deviceIds) {
        return this.createCommand("SYSTEM_RESTART", deviceIds, {});
    }

    async shutdown(deviceIds) {
        return this.createCommand("SYSTEM_SHUTDOWN", deviceIds, {});
    }

    async logoff(deviceIds) {
        return this.createCommand("SYSTEM_LOGOFF", deviceIds, {});
    }

    async lock(deviceIds) {
        return this.createCommand("LOCK_WORKSTATION", deviceIds, {});
    }

    async system_update(deviceIds) {
        return this.createCommand("SYSTEM_UPDATE", deviceIds, {});
    }




    async update_Status(deviceIds) {
        const results = await Promise.all(
            deviceIds.map(async deviceId => {
                const dispatcherResult = await this.dispatcher.dispatchUpdate(deviceId);
                return {
                    deviceId:deviceId,
                    networkStatus: dispatcherResult.networkStatus,
                    agentStatus: dispatcherResult.agent
                };
            })
        );
        return results;
    }
    async createCommand(type, deviceIds, parameters) {

        const command = await this.commandRepo.create({
            commandType: type,
            payload: {
                operation: type,
                parameters
            },
            status: "PENDING"
        });
        if(command.status === "error") return 'error occurred';
        const createdCommand = command.commands;

        const KeyTarget = await this.commandRepo.createTargets(createdCommand._id, deviceIds);
        if(KeyTarget.status === "error") return 'error occurred target device creation failed';

        const dispatcherResult = await this.dispatcher.enqueue(createdCommand._id);
        if(dispatcherResult.status === "error") return 'error occurred displatcher failed';

        const runResult = await this.dispatcher.run();
        if(runResult.status === "error") return 'error occurred dispatcher run failed';


        return createdCommand;
    }
}

module.exports = CommandService;