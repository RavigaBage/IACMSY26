const mongoose = require("mongoose");

const CommandSchema = new mongoose.Schema(
{
    commandUuid: {
        type: String,
        default: () => require("uuid").v4(),
        index: true
    },

    commandType: {
        type: String,
        required: true,
        index: true
    },

    payload: {
        type: Object,
        default: {}
    },

    status: {
        type: String,
        enum: [
            "PENDING",
            "QUEUED",
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

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false
    },

    priority: {
        type: Number,
        default: 5
    },

    scheduleAt: {
        type: Date,
        default: null
    },

    timeoutSeconds: {
        type: Number,
        default: 300
    }

},
{ timestamps: true });

module.exports =
mongoose.models.Command ||
mongoose.model("Command", CommandSchema);