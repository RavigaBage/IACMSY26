const mongoose = require("mongoose");

const PowerScheduleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  enabled: { type: Boolean, default: true, index: true },
  time: { type: String, required: true, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
  days: { type: [Number], required: true, validate: v => v.length > 0 && v.every(d => Number.isInteger(d) && d >= 0 && d <= 6) },
  timezone: { type: String, required: true, default: "UTC" },
  targetType: { type: String, enum: ["all", "selected"], required: true },
  deviceIds: { type: [String], default: [] },
  graceSeconds: { type: Number, min: 0, max: 600, default: 60 },
  skipIfActiveSession: { type: Boolean, default: true },
  allowCancellation: { type: Boolean, default: true },
  lastRunKey: { type: String, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Iac_users" }
}, { timestamps: true });

module.exports = mongoose.models.PowerSchedule || mongoose.model("PowerSchedule", PowerScheduleSchema);
