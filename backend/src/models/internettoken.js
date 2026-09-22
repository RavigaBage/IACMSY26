const mongoose = require('mongoose');
const InternetTokenSchema = new mongoose.Schema(
    {
        name:{
            type:String,
            required:[true,'Name is required'],
            trim:true,
            maxlength:[100,'Name cannot exceed 100 characters'],
        },
        tokenTicket:{
            type:String,
            required:[true,'Name is required'],
        },
        tokenExpire:{
            type:String,
            required:[true,'token expired is required']
        },
        tokenDuration:{
            type:String,
            required:[true,'Duration is required']
        },
        ticketStatus:{
            type:Boolean,

            default:false
        },
        createdAt:{
            type:Date,
            default:Date.now,   
            index: true,
        },
    },{ timestamps: true }
);

module.exports = mongoose.models.InternetToken || mongoose.model('InternetToken', InternetTokenSchema);