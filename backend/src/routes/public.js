const express = require('express');
const router = express.Router();
const qrCodeController = require('../controllers/qrCodeController');

router.get('/qrcodes/validate/:token', qrCodeController.validateQRToken);
router.post('/qrcodes/:token/submit', qrCodeController.submitAttendance);

module.exports = router;
