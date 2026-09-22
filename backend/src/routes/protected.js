const express = require('express');
const { protect, restrictTo } = require('../middleware/auth');

const loungeRouter = require('./urls/lounge');
const EventProgamRouter = require('./urls/EventPrograms');
const InitiateService_route  = require('./urls/deviceStatus');
const TicketRouter = require('./urls/internet_token');
const ReportRouter = require('./urls/reports');
const QRCodeRouter = require('./urls/qrcodes');

function createProtectedRoutes(commandService,dispatcher) {
    const router = express.Router();

    router.use(protect);

    router.get('/dashboard', (req, res) => {
        res.json({
            message: `Welcome ${req.user.name}!`,
            userId: req.user._id,
        });
    });

    router.use('/ticketing', TicketRouter);

    // inject commandService here
    router.use('/iac/devices', InitiateService_route(commandService));

    router.use('/users', loungeRouter);
    router.use('/bookings', EventProgamRouter);
    router.use('/reports', ReportRouter);
    router.use('/qrcodes', QRCodeRouter);

    router.get('/admin', restrictTo('admin'), (req, res) => {
        res.json({ message: 'Admin panel - only admins see this' });
    });

    return router;
}

module.exports = createProtectedRoutes;