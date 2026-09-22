const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema(
  {
    reporterId: { type: String, default: null },
    reporterName: { type: String, default: 'Anonymous' },
    category: {
      type: String,
      enum: ['Equipment', 'Facility', 'Software', 'Cleanliness', 'General'],
      default: 'General',
    },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['seen', 'pending', 'resolved'],
      default: 'pending',
    },
    upvotesCount: { type: Number, default: 0 },
    downvotesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Issue', issueSchema);
