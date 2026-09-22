const deviceProgress = require('./deviceCommandProgress');
const deviceCommand = require('./devicesCommands');
const deviceLogs = require('./AuditLog');
const deviceCommandTarget = require('./deviceCommandTarget');
const deviceCommandResult = require('./deviceCommandResult');
const deivceCommandQueue = require('./deviceCommandQue');
const devices = require('./devices');
module.exports = {
    deviceProgress,
    deviceCommand,
    deviceLogs,
    deviceCommandTarget,
    deviceCommandResult,
    deivceCommandQueue,
    devices
};