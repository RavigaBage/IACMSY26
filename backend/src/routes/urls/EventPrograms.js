const express = require('express');
const {protect, restrictTo } = require('./../../middleware/auth');
const BookingData = require('./../../models/booking');
const router = express.Router();


router.get('/event-program', restrictTo('user', 'admin'), async(req, res)=>{
    try {
        const {date, id_type, page,year,month,day} = req.query;
        const startOfYear = new Date(`${year}`);
        const endOfYear   = new Date(`${year+1}`);

        
        const limit =  20;

        const skip = (page - 1) * limit;
        const filter = {}

        if (id_type && id_type !== 'all') {
        filter.user_id_type = id_type;
        }

        if (year && month && day) {
            filter.createdAt = {
                $gte: new Date(year, month - 1, day),
                $lt: new Date(year, month - 1, day + 1)
            };
        } else if (year && month) {
            filter.createdAt = {
                $gte: new Date(year, month - 1, 1),
                $lt: new Date(year, month, 1)
            };
        } else if (year) {
            filter.createdAt = {
                $gte: new Date(year, 0, 1),
                $lt: new Date(year + 1, 0, 1)
            };
        }
        const data = await BookingData.find(filter).skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
        const total = await BookingData.countDocuments(filter);
        
        res.json({
            status:'success',
            message: 'Booking - users and admins see this',
            data,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        });

    } catch (err) {
         res.json({
            status:'error',
            message: err.message || 'An error occurred while fetching Booking data',
            data:null,
           });
    } finally {
        
    }
});
router.patch('/event-program/:id', restrictTo('user', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const updatedRecord = await BookingData.findByIdAndUpdate(
      id,
      req.body,
      {
        returnDocument: 'after',
        runValidators: true
      }
    );

    if (!updatedRecord) {
      return res.status(404).json({
        status: 'error',
        message: 'Record not found'
      });
    }

    res.json({
      status: 'success',
      data: updatedRecord
    });

  } catch (err) {
    const isClientError = err.name === 'ValidationError' || err.name === 'CastError';
    res.status(isClientError ? 400 : 500).json({
      status: 'error',
      message: err.message || 'An error occurred while updating the booking.'
    });
  }
});
router.delete('/event-program/:id', restrictTo('user', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const deletedRecord = await BookingData.findByIdAndDelete(id);

    if (!deletedRecord) {
      return res.status(404).json({
        status: 'error',
        message: 'Record not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Record deleted successfully'
    });

  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'An error occurred while deleting the booking.'
    });
  }
});
function EventSpan(start, end) {
    const d1 = new Date(start);
    const d2 = new Date(end);

    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());

    // Inclusive number of days
    return Math.abs((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;
}

function IncrementDate(date, num) {
    const incrementDate = new Date(date);
    incrementDate.setDate(incrementDate.getDate() + num);
    return incrementDate;
}

router.post(
    '/submit-event-program',
    protect,
    restrictTo('user', 'admin'),
    async (req, res) => {
        try {
            const {
                date,
                endDate,
                organizer,
                presenter,
                programName,
                participants,
                eventType,
                category,
                beneficiaries,
                description,
                roomType,
                roomNumber,
                paymentStatus,
                rate,
                amountDue,
                status
            } = req.body;

            // Validate all required fields
            const missing = [];
            if (!date) missing.push('date (start date)');
            if (!endDate) missing.push('endDate');
            if (!organizer || !String(organizer).trim()) missing.push('organizer');
            if (!presenter || !String(presenter).trim()) missing.push('presenter');
            if (!programName || !String(programName).trim()) missing.push('programName');
            if (!description || !String(description).trim()) missing.push('description');
            if (!roomType) missing.push('roomType');

            if (missing.length > 0) {
                return res.status(400).json({
                    status: "error",
                    message: `Booking validation failed: Required field(s) missing or empty (${missing.join(', ')}).`,
                    data: null,
                });
            }

            if (new Date(endDate) < new Date(date)) {
                return res.status(400).json({
                    status: "error",
                    message: "Booking validation failed: End date cannot be earlier than start date.",
                    data: null,
                });
            }

            const normalizeDataSchema = {
                name: String(presenter).trim(),
                date: new Date(date),
                startDate: new Date(date),
                endDate: new Date(endDate),
                organizer: String(organizer).trim(),
                presenter: String(presenter).trim(),
                programName: String(programName).trim(),
                participants: Number(participants) >= 1 ? Number(participants) : 1,
                eventType: eventType || "workshop",
                category: category || "programming",
                beneficiaries: beneficiaries || "students",
                description: String(description).trim(),
                roomType: roomType || "Conference Room",
                roomNumber: roomNumber ? Number(roomNumber) : 1,
                paymentStatus: paymentStatus || "Unpaid",
                rate: typeof rate === 'number' ? rate : 0,
                amountDue: typeof amountDue === 'number' ? amountDue : (typeof rate === 'number' ? rate : 0),
                status: status || "Booked",
            };

            const totalSpan = EventSpan(
                normalizeDataSchema.startDate,
                normalizeDataSchema.endDate
            );

            if (isNaN(totalSpan) || totalSpan < 1) {
                return res.status(400).json({
                    status: "error",
                    message: "Booking validation failed: Invalid date range.",
                    data: null,
                });
            }

            const originalStartDate = normalizeDataSchema.startDate;
            const bookings = [];

            for (let i = 0; i < totalSpan; i++) {
                const bookingDate = IncrementDate(originalStartDate, i);

                bookings.push({
                    ...normalizeDataSchema,
                    startDate: bookingDate,
                    date: bookingDate
                });
            }

            const data = await BookingData.insertMany(bookings);

            res.status(201).json({
                status: "success",
                message: `${data.length} booking(s) created successfully.`,
                data,
            });

        } catch (err) {
            const isClientError = err.name === 'ValidationError' || err.name === 'CastError' || err.statusCode === 400;
            res.status(isClientError ? 400 : 500).json({
                status: "error",
                message:
                    err.message ||
                    "An error occurred while creating booking data.",
                data: null,
            });
        }
    }
);

module.exports = router