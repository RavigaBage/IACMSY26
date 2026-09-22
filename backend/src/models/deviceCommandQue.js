const mongoose = require("mongoose");

const CommandQueueSchema = new mongoose.Schema(
{
    commandId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Command",
        index: true
    },

    status: {
        type: String,
        enum: ["WAITING", "PROCESSING", "DONE"],
        default: "WAITING"
    },

    scheduledAt: {
        type: Date,
        default: Date.now
    }

},
{ timestamps: true });

module.exports =
mongoose.models.CommandQueue ||
mongoose.model("CommandQueue", CommandQueueSchema);