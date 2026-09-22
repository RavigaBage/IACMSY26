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
        if (err.message && err.message.includes('bufferCommands')) {
            console.warn('[AI Studio] Using mock lounge data');
            return res.json({
                status: 'success',
                message: 'Lounge data (mock)',
                data: [
                    { _id: 'mock1', name: 'Alice Smith', identifier: 'GH-123456789-0', identifierType: 'ghana_card', contactNumber: '0501234567', gender: 'female', timeIn: new Date(Date.now() - 3600000).toISOString(), timeOut: '', Signature: 'ASmith' }
                ],
                page: 1, limit: 20, total: 1, totalPages: 1
            });
        }
         res.status(500).json({
            status:'error',
            message: err.message || 'An error occurred while fetching lounge data',
            data:null,
           });
    }
});


module.exports = router;