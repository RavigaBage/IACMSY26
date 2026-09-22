const express = require('express');
const { restrictTo } = require('../../middleware/auth');
const {
  generateLoungeReport,
  generateRoomsReport,
  generateTrainingReport,
  generateCenterReport,
  getAllReports,
  getReportById,
  deleteReport,
  getAuditLogs,
  getReportSummary,
  getAllReportsExcel,
  getReportExcelById,
} = require('../../controllers/reportController');

const { generateMonthlyReport } = require('../../controllers/monthlyReportController');

const router = express.Router();

// Summary is available to all authenticated users for the Home dashboard
router.get('/summary', getReportSummary);

router.use(restrictTo('admin'));

// Report generation
router.post('/generate/lounge', generateLoungeReport);
router.post('/generate/rooms', generateRoomsReport);
router.post('/generate/training', generateTrainingReport);
router.post('/generate/center', generateCenterReport);
router.post('/generate/monthly', generateMonthlyReport);

router.get('/', getAllReports);
router.get('/export', getAllReportsExcel);
router.get('/audit-logs', getAuditLogs);
router.get('/:id/excel', getReportExcelById);
router.get('/:id', getReportById);
router.delete('/:id', deleteReport);

module.exports = router;