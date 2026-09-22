class CommandRepository {

    constructor(db) {
        this.db = db;
    }


    async create({ commandType, payload, status = "PENDING" }) {
        try{
            const commands = await this.db.deviceCommand.create({
                commandType,
                payload,
                status
            });
            return {status:"sucess",commands:commands};
        }catch(error){
            return {status:"error",message:error};
        }
s
    }

 

    async createTargets(commandId, deviceIds) {
        try{
            const safeDeviceIds = Array.isArray(deviceIds)
            ? deviceIds
            : [deviceIds];
            const values = safeDeviceIds.map(deviceId => ({
                commandId,
                deviceId,
                status: "PENDING"
            }));
            console.log('VALUES :', deviceIds,values);
            const result = await this.db.deviceCommandTarget.insertMany(values);


            return result;
        }catch(error){
            console.error("Error creating command targets:", error);
            throw error;
        }

    }

    async getRoomId(target_id){
        const filter = await this.db.devices.findOne({
            _id: target_id
        });
        console.log('target_ids',target_id,'filter',filter);
        return filter;
    }


    async getCommand(commandId) {

        const filter = await this.db.deviceCommand.findById(commandId);

        return filter;
    }

  
    async getTargets(commandId) {
        try{
            const filter = await this.db.deviceCommandTarget.find({commandId:commandId});
            return filter;
        }catch(error){
            console.error("Error creating command targets:", error);
            throw error;
        }

    }


    async getQueuedCommands() {
        try{
            const filter = await this.db.deviceCommand.find({ status: "QUEUED" }).sort({ created_at: 1 });
            console.log(filter,'queued commands');
            return filter;
        }catch(error){
            console.error("Error fetching queued commands:", error);
            throw error;
        }

    }


    async updateStatus(commandId, status_) {
      try {
        const response = await this.db.deviceCommand.findByIdAndUpdate(
              commandId,
              { status: status_ },
              { new: true }
          );
        return response;
      } catch (error) {
        console.error("Error updating command status:", error);
        throw error;
      }
    }

    async markSent(targetId,status_) {

        await this.db.deviceCommand.findByIdAndUpdate(
            targetId,
              { status: status_ },
              { new: true }
        );

        await this.db.deviceCommandTarget.findByIdAndUpdate(
            targetId,
            { status: 'SENT' },
            { new: true }
        );

    }

    async markAcknowledged(targetId) {

        return await CommandTarget.findByIdAndUpdate(
            targetId,
            {
                $set: {
                    status: "ACKNOWLEDGED",
                    acknowledgedAt: new Date()
                }
            },
            { new: true }
        );
    }

    async markCompleted(targetId) {

        return await CommandTarget.findByIdAndUpdate(
            targetId,
            {
                $set: {
                    status: "COMPLETED",
                    completedAt: new Date()
                }
            },
            { new: true }
        );
    }

    async markFailed(targetId, errorMessage) {

        return await CommandTarget.findByIdAndUpdate(
            targetId,
            {
                $set: {
                    status: "FAILED",
                    errorMessage
                }
            },
            { new: true }
        );
    }


    async markOffline(targetId, errorMessage) {

        return await this.db.deviceCommand.findByIdAndUpdate(
            targetId,
            {
                $set: {
                    status: "OFFLINE",
                    errorMessage
                }
            },
            { new: true }
        );
    }


    async saveResult(commandTargetId, result) {

        await this.db.deviceCommandResult.create({
            commandTargetId,
            stdout: result.stdout || null,
            stderr: result.stderr || null,
            resultJson: JSON.stringify(result.data || {}),
            exitCode: result.exitCode || 0
        });
    }
}

module.exports = CommandRepository;