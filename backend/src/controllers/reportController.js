const Report = require('../models/Reports');
const EventProgram = require('../models/booking'); // your existing model
const InternetLounge = require('../models/InternetLounge');
const Device = require('../models/devices');
const { logAudit } = require('../middleware/AuditLogger');
const { buildMonthlyReportExcel } = require('../utils/excelGenerator');


const buildDateFilter = (from, to, field = 'createdAt') => ({
  [field]: {
    $gte: new Date(from),
    $lte: new Date(to),
  },
});


exports.generateLoungeReport = async (req, res, next) => {
  try {
    const { title, description, from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({ message: 'Date range (from, to) is required.' });
    }

    const dateFilter = buildDateFilter(from, to);

    const [
      totalVisitors,
      genderBreakdown,
      identifierTypeBreakdown,
      visitsByDay,
      recentVisitors,
    ] = await Promise.all([
      InternetLounge.countDocuments(dateFilter),

      InternetLounge.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$gender', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      InternetLounge.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$identifierType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      InternetLounge.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      InternetLounge.find(dateFilter)
        .sort({ createdAt: -1 })
        .limit(50)
        .select('name identifier identifierType contactNumber gender timeIn timeOut createdAt'),
    ]);

    const report = await Report.create({
      title: title || `Internet Lounge Report — ${from} to ${to}`,
      reportType: 'internet_lounge',
      description,
      dateRange: { from: new Date(from), to: new Date(to) },
      summary: {
        totalRecords: totalVisitors,
        totalVisitors,
      },
      chartData: {
        genderBreakdown,
        identifierTypeBreakdown,
        visitsByDay,
      },
      tableData: recentVisitors,
      status: 'completed',
      generatedBy: req.user._id,
    });

    await logAudit({
      action: 'GENERATE_REPORT',
      resourceType: 'Report',
      resourceId: report._id,
      req,
      details: { reportType: 'internet_lounge', from, to },
    });

    res.status(201).json({ message: 'Lounge report generated.', data: report });
  } catch (err) {
    next(err);
  }
};

exports.generateRoomsReport = async (req, res, next) => {
  try {
    const { title, description, from, to, roomType, roomNumber } = req.body;

    if (!from || !to) {
      return res.status(400).json({ message: 'Date range (from, to) is required.' });
    }

    const matchFilter = {
      ...buildDateFilter(from, to),
      isDeleted: false,
    };

    if (roomType) matchFilter.roomType = roomType;
    if (roomNumber) matchFilter.roomNumber = Number(roomNumber);

    const [
      totalEvents,
      totalParticipants,
      eventsByType,
      eventsByCategory,
      eventsByBeneficiary,
      roomUsage,
      statusBreakdown,
      eventsByDay,
      recentEvents,
    ] = await Promise.all([
      EventProgram.countDocuments(matchFilter),

      EventProgram.aggregate([
        { $match: matchFilter },
        { $group: { _id: null, total: { $sum: '$participants' } } },
      ]),

      EventProgram.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$eventType', count: { $sum: 1 }, participants: { $sum: '$participants' } } },
        { $sort: { count: -1 } },
      ]),

      EventProgram.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$category', count: { $sum: 1 }, participants: { $sum: '$participants' } } },
        { $sort: { count: -1 } },
      ]),

      EventProgram.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$beneficiaries', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      EventProgram.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: { roomType: '$roomType', roomNumber: '$roomNumber' },
            events: { $sum: 1 },
            participants: { $sum: '$participants' },
          },
        },
        { $sort: { '_id.roomNumber': 1 } },
      ]),

      EventProgram.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      EventProgram.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            events: { $sum: 1 },
            participants: { $sum: '$participants' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      EventProgram.find(matchFilter)
        .sort({ date: -1 })
        .limit(50)
        .select('name date organizer presenter programName participants eventType category beneficiaries roomNumber roomType status'),
    ]);

    const participantsTotal = totalParticipants[0]?.total || 0;

    const report = await Report.create({
      title: title || `Rooms Report — ${from} to ${to}`,
      reportType: roomType === 'seminar' ? 'seminar_rooms' : roomType === 'conference' ? 'conference_rooms' : 'seminar_rooms',
      description,
      dateRange: { from: new Date(from), to: new Date(to) },
      filters: { roomType, roomNumber },
      summary: {
        totalRecords: totalEvents,
        totalEvents,
        totalParticipants: participantsTotal,
      },
      chartData: {
        eventsByType,
        eventsByCategory,
        eventsByBeneficiary,
        roomUsage,
        statusBreakdown,
        eventsByDay,
      },
      tableData: recentEvents,
      status: 'completed',
      generatedBy: req.user._id,
    });

    await logAudit({
      action: 'GENERATE_REPORT',
      resourceType: 'Report',
      resourceId: report._id,
      req,
      details: { reportType: 'rooms', from, to, roomType, roomNumber },
    });

    res.status(201).json({ message: 'Rooms report generated.', data: report });
  } catch (err) {
    next(err);
  }
};

exports.generateTrainingReport = async (req, res, next) => {
  try {
    const { title, description, from, to, category } = req.body;

    if (!from || !to) {
      return res.status(400).json({ message: 'Date range (from, to) is required.' });
    }

    const matchFilter = {
      ...buildDateFilter(from, to),
      eventType: { $in: ['it training', 'workshop', 'teaching'] },
      isDeleted: false,
    };

    if (category) matchFilter.category = category;

    const [
      totalTrainings,
      totalParticipants,
      byCategory,
      byBeneficiary,
      byEventType,
      trainingsByDay,
      topOrganizers,
      recentTrainings,
    ] = await Promise.all([
      EventProgram.countDocuments(matchFilter),

      EventProgram.aggregate([
        { $match: matchFilter },
        { $group: { _id: null, total: { $sum: '$participants' } } },
      ]),

      EventProgram.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$category', count: { $sum: 1 }, participants: { $sum: '$participants' } } },
        { $sort: { count: -1 } },
      ]),

      EventProgram.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$beneficiaries', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      EventProgram.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$eventType', count: { $sum: 1 }, participants: { $sum: '$participants' } } },
        { $sort: { count: -1 } },
      ]),

      EventProgram.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            events: { $sum: 1 },
            participants: { $sum: '$participants' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      EventProgram.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$organizer', count: { $sum: 1 }, participants: { $sum: '$participants' } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      EventProgram.find(matchFilter)
        .sort({ date: -1 })
        .limit(50)
        .select('name date organizer presenter programName participants category eventType beneficiaries roomNumber roomType status'),
    ]);

    const participantsTotal = totalParticipants[0]?.total || 0;

    const report = await Report.create({
      title: title || `Training Rooms Report — ${from} to ${to}`,
      reportType: 'training_rooms',
      description,
      dateRange: { from: new Date(from), to: new Date(to) },
      filters: { category },
      summary: {
        totalRecords: totalTrainings,
        totalEvents: totalTrainings,
        totalParticipants: participantsTotal,
      },
      chartData: {
        byCategory,
        byBeneficiary,
        byEventType,
        trainingsByDay,
        topOrganizers,
      },
      tableData: recentTrainings,
      status: 'completed',
      generatedBy: req.user._id,
    });

    await logAudit({
      action: 'GENERATE_REPORT',
      resourceType: 'Report',
      resourceId: report._id,
      req,
      details: { reportType: 'training_rooms', from, to },
    });

    res.status(201).json({ message: 'Training report generated.', data: report });
  } catch (err) {
    next(err);
  }
};

exports.generateCenterReport = async (req, res, next) => {
  try {
    const { title, description, from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({ message: 'Date range (from, to) is required.' });
    }

    const eventFilter = { ...buildDateFilter(from, to), isDeleted: false };
    const loungeFilter = buildDateFilter(from, to);
    const deviceFilter = buildDateFilter(from, to);

    const [
      totalVisitors,
      totalEvents,
      totalParticipantsAgg,
      activeDevices,
      offlineDevices,
      eventsByRoomType,
      eventsByCategory,
      devicesByRisk,
      visitsByDay,
      eventsByDay,
    ] = await Promise.all([
      InternetLounge.countDocuments(loungeFilter),
      EventProgram.countDocuments(eventFilter),

      EventProgram.aggregate([
        { $match: eventFilter },
        { $group: { _id: null, total: { $sum: '$participants' } } },
      ]),

      Device.countDocuments({ 'status.remoteAgent': 'active' }),
      Device.countDocuments({ 'status.remoteAgent': 'offline' }),

      EventProgram.aggregate([
        { $match: eventFilter },
        { $group: { _id: '$roomType', count: { $sum: 1 }, participants: { $sum: '$participants' } } },
      ]),

      EventProgram.aggregate([
        { $match: eventFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      Device.aggregate([
        { $group: { _id: '$security.riskLevel', count: { $sum: 1 } } },
      ]),

      InternetLounge.aggregate([
        { $match: loungeFilter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            visitors: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      EventProgram.aggregate([
        { $match: eventFilter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            events: { $sum: 1 },
            participants: { $sum: '$participants' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const report = await Report.create({
      title: title || `Center Overview — ${from} to ${to}`,
      reportType: 'center_overview',
      description,
      dateRange: { from: new Date(from), to: new Date(to) },
      summary: {
        totalVisitors,
        totalEvents,
        totalParticipants: totalParticipantsAgg[0]?.total || 0,
        activeDevices,
      },
      chartData: {
        eventsByRoomType,
        eventsByCategory,
        devicesByRisk,
        visitsByDay,
        eventsByDay,
        deviceSummary: { active: activeDevices, offline: offlineDevices },
      },
      tableData: {},
      status: 'completed',
      generatedBy: req.user._id,
    });

    await logAudit({
      action: 'GENERATE_REPORT',
      resourceType: 'Report',
      resourceId: report._id,
      req,
      details: { reportType: 'center_overview', from, to },
    });

    res.status(201).json({ message: 'Center overview report generated.', data: report });
  } catch (err) {
    next(err);
  }
};



// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a start/end Date range from a "YYYY-MM-DD" string (or today).
 */
function buildDayRange(dateStr) {
  const base = dateStr ? new Date(dateStr) : new Date();

  // Start of month
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  // End of month
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };

}

// ─── Controller ──────────────────────────────────────────────────────────────

/**
 * GET /api/reports
 *
 * Query params:
 *   date        – YYYY-MM-DD  (defaults to today)
 *   status      – filter EventProgram by room status
 *   eventType   – filter EventProgram by event type
 *   category    – filter EventProgram by category
 *   roomNumber  – filter EventProgram by room (1-4)
 *   page        – pagination page (default 1)
 *   limit       – items per page (default 20)
 */
exports.getAllReports = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      reportType
    } = req.query;

    const filter = { isDeleted: false };
    if (reportType && reportType !== 'All') {
      filter.reportType = reportType;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate('generatedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Report.countDocuments(filter),
    ]);

    res.status(200).json({
      message: 'Reports fetched successfully.',
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
      data: reports,
    });
  } catch (err) {
    next(err);
  }
};

exports.getAllReportsExcel = async (req, res, next) => {
  try {
    const { date, month, year } = req.query;

    let base = new Date();
    if (year && month) {
      base = new Date(Number(year), Number(month) - 1, 1);
    } else if (date) {
      base = new Date(date);
    }

    const startOfMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const roomFilter = { isDeleted: false, date: { $gte: startOfMonth, $lte: endOfMonth } };
    const loungeFilter = { createdAt: { $gte: startOfMonth, $lte: endOfMonth } };

    const [eventPrograms, loungeLogs] = await Promise.all([
      EventProgram.find(roomFilter).sort({ date: -1 }).lean(),
      InternetLounge.find(loungeFilter).sort({ createdAt: -1 }).lean(),
    ]);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[base.getMonth()];
    const reportYear = base.getFullYear();

    const workbook = await buildMonthlyReportExcel({
      monthName,
      year: reportYear,
      loungeUsers: loungeLogs.length,
      eventPrograms,
      loungeLogs,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=IAC_Monthly_Report_${monthName}_${reportYear}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};

exports.getReportExcelById = async (req, res, next) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, isDeleted: false });
    if (!report) {
      return res.status(404).json({ message: 'Report not found.' });
    }

    let start = report.dateRange?.from ? new Date(report.dateRange.from) : new Date();
    let end = report.dateRange?.to ? new Date(report.dateRange.to) : new Date();

    const roomFilter = { isDeleted: false, date: { $gte: start, $lte: end } };
    const loungeFilter = { createdAt: { $gte: start, $lte: end } };

    const [eventPrograms, loungeLogs] = await Promise.all([
      EventProgram.find(roomFilter).sort({ date: -1 }).lean(),
      InternetLounge.find(loungeFilter).sort({ createdAt: -1 }).lean(),
    ]);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[start.getMonth()];
    const reportYear = start.getFullYear();

    const workbook = await buildMonthlyReportExcel({
      monthName,
      year: reportYear,
      loungeUsers: loungeLogs.length,
      eventPrograms,
      loungeLogs,
    });

    const safeTitle = (report.title || 'IAC_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${safeTitle}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/summary
 *
 * Lightweight summary for dashboard stats cards and charts.
 */
exports.getReportSummary = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const roomTodayFilter = { isDeleted: false, date: { $gte: todayStart, $lte: todayEnd } };
    const loungeTodayFilter = { createdAt: { $gte: todayStart, $lte: todayEnd } };

    const [
      currentLoungeCount,
      totalLoungeUsers,
      activeRoomsCount,
      totalRoomBookings,
      connectedDevicesCount,
      pendingReportsCount,
      recentEvents,
      loungeHourlyAgg,
      roomUsageBreakdown,
      eventTypeBreakdown,
    ] = await Promise.all([
      InternetLounge.countDocuments(loungeTodayFilter),
      InternetLounge.countDocuments(),
      EventProgram.countDocuments(roomTodayFilter),
      EventProgram.countDocuments({ isDeleted: false }),
      Device.countDocuments(),
      Report.countDocuments({ isDeleted: false }),

      EventProgram.find({ isDeleted: false })
        .sort({ date: -1, createdAt: -1 })
        .limit(6)
        .select('name programName organizer presenter roomNumber roomType participants eventType status date')
        .lean(),

      InternetLounge.aggregate([
        { $match: loungeTodayFilter },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      EventProgram.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$roomNumber',
            bookings: { $sum: 1 },
            totalParticipants: { $sum: '$participants' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      EventProgram.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    // Build 12-hour array for today's hourly traffic (8 AM to 7 PM)
    const hourlyMap = {};
    (loungeHourlyAgg || []).forEach(h => {
      hourlyMap[h._id] = h.count;
    });

    const hourlyTraffic = Array.from({ length: 12 }, (_, i) => {
      const hour = i + 8; // 8 AM to 7 PM
      const hourLabel = hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`;
      return {
        hour: hourLabel,
        visitors: hourlyMap[hour] || 0,
      };
    });

    res.status(200).json({
      message: 'Summary fetched successfully.',
      summary: {
        currentLoungeCount,
        totalLoungeUsers,
        activeRoomsCount,
        totalRoomBookings,
        connectedDevicesCount,
        pendingReportsCount,
        recentEvents: (recentEvents || []).map(e => ({
          id: e._id,
          name: e.programName || e.name,
          organizer: e.organizer,
          presenter: e.presenter,
          roomNumber: e.roomNumber,
          roomType: e.roomType,
          participants: e.participants,
          eventType: e.eventType,
          status: e.status || 'AVAILABLE',
          date: e.date ? new Date(e.date).toISOString().slice(0, 10) : 'N/A',
        })),
        systemMatrix: {
          hourlyTraffic,
          byRoom: roomUsageBreakdown.map(r => ({
            roomNumber: `Room ${r._id}`,
            bookings: r.bookings,
            totalParticipants: r.totalParticipants,
          })),
          byEventType: eventTypeBreakdown.map(e => ({
            eventType: e._id,
            count: e.count,
          })),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getReportById = async (req, res, next) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, isDeleted: false })
      .populate('generatedBy', 'name email');

    if (!report) {
      return res.status(404).json({ message: 'Report not found.' });
    }

    await logAudit({
      action: 'READ',
      resourceType: 'Report',
      resourceId: report._id,
      req,
      details: { reportType: report.reportType },
    });

    res.status(200).json({ message: 'Report fetched.', data: report });
  } catch (err) {
    next(err);
  }
};

exports.deleteReport = async (req, res, next) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, isDeleted: false });
    if (!report) {
      return res.status(404).json({ message: 'Report not found.' });
    }

    report.isDeleted = true;
    await report.save();

    await logAudit({
      action: 'DELETE',
      resourceType: 'Report',
      resourceId: report._id,
      req,
      details: { reportType: report.reportType, title: report.title },
    });

    res.status(200).json({ message: 'Report deleted.' });
  } catch (err) {
    next(err);
  }
};

const AuditLog = require('../models/AuditLog');

exports.getAuditLogs = async (req, res, next) => {
  try {
    const {
      action,
      resourceType,
      performedBy,
      from,
      to,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};
    if (action) filter.action = action;
    if (resourceType) filter.resourceType = resourceType;
    if (performedBy) filter.performedBy = performedBy;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('performedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AuditLog.countDocuments(filter),
    ]);

    res.status(200).json({
      message: 'Audit logs fetched.',
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: logs,
    });
  } catch (err) {
    next(err);
  }
};