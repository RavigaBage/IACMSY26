class SocketService {

    constructor(io) {
        this.io = io;
        this.connectedDevices = new Map();

    }

    registerDevice(deviceId, socket) {
        this.connectedDevices.set(deviceId, socket.id);
    }

    unregisterDevice(deviceId) {
        this.connectedDevices.delete(deviceId);
    }

    isDeviceOnline(deviceId) {
        
        console.log(deviceId);
        return this.connectedDevices.has(deviceId);
    }
    emitToDevice(deviceId, event, payload) {
        this.io.to(`device:${deviceId}`)
            .emit(event, payload);
    }
    emitToDeviceWithAck(deviceId, event, payload = {}, timeoutMs = 5000) {
        return new Promise((resolve, reject) => {
            this.io.to(`device:${deviceId}`)
                .timeout(timeoutMs)
                .emit(event, payload, (err, responses) => {
                    if (err) return reject(err); // timed out, agent unreachable
                    resolve(responses[0]); // single socket in the room
                });
        });
    }
}

module.exports = SocketService;
