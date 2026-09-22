const mongoose = require("mongoose");

const CommandResultSchema = new mongoose.Schema(
{
    commandTargetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CommandTarget",
        index: true
    },

    stdout: String,
    stderr: String,

    result: {
        type: Object,
        default: {}
    },

    exitCode: {
        type: Number,
        default: 0
    }

},
{ timestamps: true });

module.exports =
mongoose.models.CommandResult ||
mongoose.model("CommandResult", CommandResultSchema);