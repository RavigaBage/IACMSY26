const express = require('express');
const router = express.Router();
const qrCodeController = require('../../controllers/qrCodeController');

router.get('/active', qrCodeController.getActiveQRCode);
router.post('/generate', qrCodeController.generateQRCode);
router.get('/', qrCodeController.getQRCodes);
router.patch('/:id/deactivate', qrCodeController.deactivateQRCode);
router.patch('/:id/regenerate', qrCodeController.regenerateQRCode);
router.post('/:id/regenerate', qrCodeController.regenerateQRCode);
router.delete('/:id', qrCodeController.deleteQRCode);
router.get('/:token/submissions', qrCodeController.getQRSubmissions);

module.exports = router;
