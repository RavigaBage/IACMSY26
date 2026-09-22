const mongoose = require("mongoose");

const CommandTargetSchema = new mongoose.Schema(
{
    commandId: {
        type: String,
        ref: "Command",
        index: true
    },

    deviceId: {
        type: String,
        required:[true,'Name is required'],
    },

    status: {
        type: String,
        enum: [
            "PENDING",
            "SENT",
            "ACKNOWLEDGED",
            "RUNNING",
            "COMPLETED",
            "FAILED",
            "TIMED_OUT",
            "CANCELLED"
        ],
        default: "PENDING",
        index: true
    },

    attemptCount: {
        type: Number,
        default: 0
    },

    acknowledgedAt: Date,
    startedAt: Date,
    completedAt: Date,

    errorMessage: String
},
{ timestamps: true });

module.exports =
mongoose.models.CommandTarget ||
mongoose.model("CommandTarget", CommandTargetSchema);