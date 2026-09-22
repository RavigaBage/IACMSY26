const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
    {
        name: {
            type:String,
            required: [true,'Name is required'],
            trim:true,
            maxlength:[50,'Name cannot exceed 50 characters'],
        },
        email: {
            type:String,
            required: [true,'email is required'],
            trim:true,
            lowercase:true,
            unique:true,
        },
        password: {
            type:String,
            required: [true,'Password id required'],
            select:false,
            minlength:[8,'password must be at least 8 characters long'],
        },
        refreshToken: {
            type:String,
            select:false,
        },
        role: {
            type:String,
            enum:['user','admin'],
            default:'user'
        },
    },
    {timestamps:true}
);

UserSchema.pre('save', async function(){
    if(!this.isModified('password')) return;

    this.password = await bcrypt.hash(this.password, 12);
})


UserSchema.methods.comparePassword = async function(userPassword){
    return await bcrypt.compare(userPassword, this.password);
}
module.exports = mongoose.model('Iac_users',UserSchema,'Iac_users');
