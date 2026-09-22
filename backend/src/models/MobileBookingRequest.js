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
      enum: ['pending', 'confirmed', 'rejected'],
      default: 'pending',
    },
    confirmedBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'booking', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MobileBookingRequest', mobileBookingRequestSchema);
