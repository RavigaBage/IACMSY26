const mongoose = require('mongoose');

const mobileBookingRequestSchema = new mongoose.Schema(
  {
    mobileUserId: { type: String, required: true },
    mobileUserName: { type: String, default: 'Mobile User' },
    contactEmail: { type: String, required: true },
    roomNumber: { type: String, default: '3' },
    roomType: { type: String, default: 'conference' },
    requestedDate: { type: Date, required: true },
    arrivalTime: { type: String, default: '' },
    requestedSlot: { type: String, required: true },
    programName: { type: String, default: 'IAC Mobile Reservation' },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },
    confirmedBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'booking', default: null },
    eventDetailsSubmitted: { type: Boolean, default: false },
    eventDetailsSubmittedAt: { type: Date, default: null },
    eventDetails: {
      organizer: { type: String, default: '' },
      presenter: { type: String, default: '' },
      programName: { type: String, default: '' },
      eventType: { type: String, default: 'meetings' },
      category: { type: String, default: 'others' },
      participants: { type: Number, default: 1 },
      beneficiaries: { type: String, default: 'others' },
      description: { type: String, default: '' },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      roomType: { type: String, default: '' },
      paymentStatus: { type: String, default: 'Unpaid' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MobileBookingRequest', mobileBookingRequestSchema);
