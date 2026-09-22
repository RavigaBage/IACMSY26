const mongoose = require('mongoose');

const issueVoteSchema = new mongoose.Schema(
  {
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      required: true,
    },
    mobileUserId: { type: String, required: true },
    direction: { type: String, enum: ['up', 'down'], required: true },
  },
  { timestamps: true }
);

issueVoteSchema.index({ issueId: 1, mobileUserId: 1 }, { unique: true });

module.exports = mongoose.model('IssueVote', issueVoteSchema);
