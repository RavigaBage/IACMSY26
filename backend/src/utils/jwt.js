const jwt = require('jsonwebtoken')

const signAccessToken = (userId) =>{
    return jwt.sign(
        {id:userId},
        process.env.JWT_SECRET,
        {expiresIn:process.env.JWT_EXPIRES_IN}
    );
};
const signAccessTicket = (userId,duration)=>{
    return jwt.sign(
        {id:userId},
        process.env.JWT_TICKET,
        {expiresIn:duration}
    )
}
const signRefreshToken = (userId) =>{
    return jwt.sign(
        {id:userId},
        process.env.JWT_REFRESH_SECRET,
        {expiresIn:process.env.JWT_REFRESH_EXPIRES_IN}
    );
};

const verifyAccessToken = (token)=>{
    return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token)=>{
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = {signAccessToken,signRefreshToken,verifyAccessToken,verifyRefreshToken,signAccessTicket};