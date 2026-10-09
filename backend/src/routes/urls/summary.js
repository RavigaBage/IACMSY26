const express = require('express');
const {protect, restrictTo } = require('./../../middleware/auth');
const LoungeData = require('./../../models/InternetLounge');
const router = express.Router();


router.get('/summary-patch', protect, restrictTo('user', 'admin'), async(req, res)=>{
    try {
        const year = new Date().getFullYear();
        const startOfYear = new Date(`${year}`);
        const endOfYear   = new Date(`${year+1}`);
        const filter = {}
        filter.createdAt = {
            $gte: new Date(year, 0, 1),
            $lt: new Date(year + 1, 0, 1)
        };
        const total_Lounge = await LoungeData.countDocuments(filter);
        //total rooms, total rooms in session ,total devices, most recent event, system matrix
        
        res.json({
            status:'success',
            message: 'Lounge - users and admins see this',
            totaLoungeUser: Math.ceil(total_Lounge),
        });

    } catch (err) {
        console.error('Failed to load lounge summary:', err.message);
        res.status(err.message?.includes('bufferCommands') ? 503 : 500).json({
            status:'error',
            message: err.message?.includes('bufferCommands')
                ? 'Database service is unavailable'
                : 'An error occurred while fetching lounge data',
            data:null,
           });
    }
});


module.exports = router;