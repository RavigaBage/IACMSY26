const mongoose = require('mongoose');
const InternetLoungeSchema = new mongoose.Schema(
    {
        name:{
            type:String,
            required:[true,'Name is required'],
            trim:true,
            maxlength:[100,'Name cannot exceed 100 characters'],
        },
        identifier:{
            type:String,
            required:[true,'Identifier is required'],
            unique:true,
            sparse: true,
        },
        identifierType:{
            type:String,
            enum:['student_id','ghana_card','passport','driver_license','voter_id','nhis_card','other']
        },
        contactNumber:{
            type:String,
            required:[true,'Contact number is required'],
            trim:true,
            maxlength:[15,'Contact number cannot exceed 15 characters'],
        },
        gender:{
            type:String,
            enum:['male','female','other'],
        },
        timeIn:{
            type:String,
            required:[true,'Time in data is required'],
            default:Date.now,
        }, 
        timeOut:{
            type:String,
            default:Date.now,
        },
        Signature:{
            type:String,
            required:[true,'Signature is required'],
        },
        createdAt:{
            type:Date,
            default:Date.now,   
            index: true,
        },
    },{ timestamps: true }
);

module.exports = mongoose.models.InternetLounge || mongoose.model('InternetLounge', InternetLoungeSchema);