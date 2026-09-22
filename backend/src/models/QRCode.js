const mongoose = require('mongoose');

const QRCodeSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  label: { type: String },
  durationValue: { type: Number, required: true },
  durationUnit: { type: String, required: true, enum: ['hours', 'days', 'minutes'] },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['active', 'expired', 'deactivated'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Iac_users' },
  submissionCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.QRCode || mongoose.model('QRCode', QRCodeSchema);
