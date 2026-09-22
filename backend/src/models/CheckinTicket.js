const mongoose = require('mongoose');

const checkinTicketSchema = new mongoose.Schema(
  {
    mobileUserId: { type: String, required: true },
    mobileUserName: { type: String, default: 'Mobile Visitor' },
    mobileUserEmail: { type: String, default: '' },
    mobileUserPhone: { type: String, default: '' },
    mobileUserIdNumber: { type: String, default: '' },
    ticketCode: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'declined', 'checked_out', 'expired'],
      default: 'pending',
    },
    requestedAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date },
    confirmedBy: { type: String, default: '' },
    declinedAt: { type: Date },
    declinedBy: { type: String, default: '' },
    declinedReason: { type: String, default: '' },
    checkedOutAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CheckinTicket', checkinTicketSchema);
