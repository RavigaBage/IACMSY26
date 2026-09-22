class CommandEventBus {

    constructor(io) {
        this.io = io;
    }

    emitToDashboard(event, payload) {
        this.io.emit("command:event", {
            event,
            payload,
            timestamp: new Date()
        });
    }

    emitToDevice(deviceId, event, payload) {
        this.io.to(`device:${deviceId}`)
            .emit(event, payload);
    }
}

module.exports = CommandEventBus;