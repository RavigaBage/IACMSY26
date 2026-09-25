const mongoose = require('mongoose');

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

    async getPendingCommands() {
        try {
            const filter = await this.db.deviceCommand.find({ status: "PENDING" }).sort({ createdAt: 1, created_at: 1 });
            return filter;
        } catch (error) {
            console.error("Error fetching pending commands:", error);
            throw error;
        }
    }

    async getDevice(deviceId) {
        try {
            let filter;
            if (mongoose.Types.ObjectId.isValid(deviceId)) {
                filter = await this.db.devices.findOne({
                    $or: [{ _id: deviceId }, { deviceId: deviceId }]
                });
            } else {
                filter = await this.db.devices.findOne({ deviceId: deviceId });
            }
            return filter;
        } catch (error) {
            console.error("Error fetching device:", error);
            throw error;
        }
    }

    async getTarget(targetId) {
        try {
            const filter = await this.db.deviceCommandTarget.findById(targetId);
            return filter;
        } catch (error) {
            console.error("Error fetching target:", error);
            throw error;
        }
    }

    async updateTargetStatus(targetId, status_, extraFields = {}) {
        try {
            const updateDoc = { status: status_, ...extraFields };
            if (status_ === "ACKNOWLEDGED") {
                updateDoc.acknowledgedAt = new Date();
            } else if (status_ === "RUNNING") {
                updateDoc.startedAt = new Date();
            } else if (status_ === "COMPLETED" || status_ === "FAILED" || status_ === "TIMED_OUT") {
                updateDoc.completedAt = new Date();
            }

            const updated = await this.db.deviceCommandTarget.findByIdAndUpdate(
                targetId,
                { $set: updateDoc },
                { new: true }
            );
            return updated;
        } catch (error) {
            console.error("Error updating target status:", error);
            throw error;
        }
    }

    async incrementAttempt(targetId) {
        try {
            const updated = await this.db.deviceCommandTarget.findByIdAndUpdate(
                targetId,
                { $inc: { attemptCount: 1 } },
                { new: true }
            );
            return updated;
        } catch (error) {
            console.error("Error incrementing target attempt count:", error);
            throw error;
        }
    }

    /**
     * Finds targets that are considered "stuck":
     * Targets in "SENT", "ACKNOWLEDGED", or "TIMED_OUT" state that were last updated
     * longer than thresholdSeconds (default 300s) ago and have attemptCount < 3
     * so they can be recovered by the retry loop.
     */
    async getStuckTargets(thresholdSeconds = 300) {
        try {
            const cutoff = new Date(Date.now() - thresholdSeconds * 1000);
            const stuck = await this.db.deviceCommandTarget.find({
                status: { $in: ["SENT", "ACKNOWLEDGED", "TIMED_OUT"] },
                attemptCount: { $lt: 3 },
                updatedAt: { $lt: cutoff }
            });
            return stuck;
        } catch (error) {
            console.error("Error fetching stuck targets:", error);
            throw error;
        }
    }

    async markSent(targetId, status_ = "SENT") {
        try {
            await this.db.deviceCommandTarget.findByIdAndUpdate(
                targetId,
                { status: status_ },
                { new: true }
            );
        } catch (error) {
            console.error("Error marking target sent:", error);
            throw error;
        }
    }

    async markAcknowledged(targetId) {
        return await this.db.deviceCommandTarget.findByIdAndUpdate(
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
        return await this.db.deviceCommandTarget.findByIdAndUpdate(
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
        return await this.db.deviceCommandTarget.findByIdAndUpdate(
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