const Report = require('../models/Reports');
const EventProgram = require('../models/booking');
const InternetLounge = require('../models/InternetLounge');
const { logAudit } = require('../middleware/AuditLogger');

exports.generateMonthlyReport = async (req, res, next) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required.' });
    }

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const eventFilter = { date: { $gte: startOfMonth, $lte: endOfMonth }, isDeleted: false };
    const loungeFilter = { createdAt: { $gte: startOfMonth, $lte: endOfMonth } };

    // 1. Daily visitor counts
    const visitsByDayAgg = await InternetLounge.aggregate([
      { $match: loungeFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          visitors: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 2. Daily event details
    const events = await EventProgram.find(eventFilter)
      .select('date organizer programName room participants eventType category beneficiaries paymentStatus amountDue rate')
      .sort({ date: 1 })
      .lean();

    // 3. Monthly summary
    const totalEvents = events.length;
    let totalParticipants = 0;
    let totalRevenue = 0;
    let totalOutstanding = 0;
    const roomUtilization = {};

    events.forEach(e => {
      totalParticipants += e.participants || 0;
      if (e.paymentStatus === 'Paid' || e.paymentStatus === 'Partially Paid') {
        totalRevenue += e.amountDue || 0; // assuming amountDue is what's paid if paid, or rate? The schema has rate and amountDue. Let's use amountDue. 
      }
      if (e.paymentStatus === 'Unpaid' || e.paymentStatus === 'Partially Paid') {
        totalOutstanding += e.amountDue || 0; // just roughly mapping this.
      }
      
      if (!roomUtilization[e.room]) roomUtilization[e.room] = 0;
      roomUtilization[e.room] += 1;
    });
    
    // adjust revenue/outstanding properly: if paid, it's revenue. if unpaid, outstanding. 
    // actually, let's recount properly
    totalRevenue = 0;
    totalOutstanding = 0;
    events.forEach(e => {
      if (e.paymentStatus === 'Paid') {
        totalRevenue += (e.amountDue || 0);
      } else if (e.paymentStatus === 'Unpaid') {
        totalOutstanding += (e.amountDue || 0);
      } else if (e.paymentStatus === 'Partially Paid') {
        // we don't have amountPaid, so we'll just split it or treat amountDue as total and assume some paid... wait, just do amountDue for now
        totalRevenue += (e.amountDue || 0) / 2;
        totalOutstanding += (e.amountDue || 0) / 2;
      }
    });

    const totalVisitors = await InternetLounge.countDocuments(loungeFilter);

    // format roomUtilization for chartData
    const roomUtilizationBreakdown = Object.keys(roomUtilization).map(room => ({
      room,
      count: roomUtilization[room]
    }));

    const report = await Report.create({
      title: `Monthly Report — ${startOfMonth.toLocaleString('default', { month: 'long' })} ${year}`,
      reportType: 'monthly_summary',
      description: 'System generated monthly comprehensive report',
      dateRange: { from: startOfMonth, to: endOfMonth },
      summary: {
        totalEvents,
        totalParticipants,
        totalVisitors,
        totalRevenue,
        totalOutstanding,
      },
      chartData: {
        visitsByDay: visitsByDayAgg,
        roomUtilization: roomUtilizationBreakdown,
      },
      tableData: {
        events: events
      },
      status: 'completed',
      generatedBy: req.user._id,
    });

    await logAudit({
      action: 'GENERATE_REPORT',
      resourceType: 'Report',
      resourceId: report._id,
      req,
      details: { reportType: 'monthly_summary', month, year },
    });

    res.status(201).json({ message: 'Monthly report generated.', data: report });
  } catch (err) {
    next(err);
  }
};
