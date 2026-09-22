const mongoose = require("mongoose");

const CommandProgressSchema = new mongoose.Schema(
{
    commandTargetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CommandTarget",
        index: true
    },

    percentage: {
        type: Number,
        default: 0
    },

    message: String
},
{ timestamps: true });

module.exports =
mongoose.models.CommandProgress ||
mongoose.model("CommandProgress", CommandProgressSchema);