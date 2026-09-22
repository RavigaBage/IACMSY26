const CommandRepository = require('./commandRepository');
const CommandDispatcher = require('./commandDispatch');
const CommandService = require('./commandservices');
const {
    deviceProgress,
    deviceCommand,
    deviceLogs,
    deviceCommandTarget,
    deviceCommandResult,
    deviceCommandQueue,
    devices
} = require('../models');

const commandRepo = new CommandRepository({
    deviceProgress,
    deviceCommand,
    deviceLogs,
    deviceCommandTarget,
    deviceCommandResult,
    deviceCommandQueue,
    devices
});

const services = {
    commandRepo,
    dispatcher: null,
    commandService: null
};

function initServices(socketService) {
    services.dispatcher = new CommandDispatcher(commandRepo, socketService);
    services.commandService = new CommandService(commandRepo, services.dispatcher);
    return services;
}

module.exports = { services, initServices };