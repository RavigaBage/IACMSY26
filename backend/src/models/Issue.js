const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema(
  {
    ticketCode: { type: String, default: () => `#TKT-${Math.floor(8000 + Math.random() * 1999)}` },
    title: { type: String, default: 'General Facility Notice' },
    nodeEquipment: { type: String, default: '' },
    reporterId: { type: String, default: null },
    reporterName: { type: String, default: 'Anonymous' },
    category: {
      type: String,
      default: 'General',
    },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['seen', 'pending', 'resolved', 'in-progress'],
      default: 'pending',
    },
    affectedCount: { type: Number, default: 1 },
    upvotesCount: { type: Number, default: 0 },
    downvotesCount: { type: Number, default: 0 },
    assigneeName: { type: String, default: '' },
    assigneeRole: { type: String, default: '' },
    assigneeNote: { type: String, default: '' },
    evidenceUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Issue', issueSchema);
