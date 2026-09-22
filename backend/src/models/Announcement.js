const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['pinned', 'event', 'class', 'notice'],
      required: true,
      default: 'notice',
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, default: null },
    startsAt: { type: Date },
    endsAt: { type: Date },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Announcement', announcementSchema);
