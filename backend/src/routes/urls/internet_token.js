const express = require('express');
const router = express.Router();
const {signAccessTicket} =  require('../../utils/jwt');
const Ticket = require('../../models/internettoken');
const { restrictTo } = require("./../../middleware/auth");

function returnJson(state, message, data_val) {
  return {
    status: state,
    message,
    data: data_val,
  };
}



router.get(
  '/sign-ticket',
  restrictTo('user', 'admin'),
  async (req, res) => {
    try {
      const getAvailableToken = await Ticket.findOne({
        ticketStatus: true,
      }).sort({
        createdAt: -1,
      });

      if (!getAvailableToken) {
        return res.json(
          returnJson(
            'success',
            'No Available Token Found',
            null
          )
        );
      }

      return res.json(
        returnJson(
          'success',
          'Token is currently active',
          getAvailableToken
        )
      );
    } catch (error) {
      return res.status(500).json(
        returnJson(
          'error',
          'An Error occurred',
          error.message
        )
      );
    }
  }
);



function CalculateExpire(time,limiter){
    switch (limiter) {
        case 'm':
            return (Math.floor(time * 60))
            break;
        case 'h':
            return (Math.floor(time * 60 * 60))
            break;
    
        default:
            break;
    }
}
router.post(
  '/post-ticket',
  restrictTo('user', 'admin'),
  async (req, res) => {
    try {
      const requestData = req.body;
      const Datavar = Date.now();
      const Ticketname = `IAC-TICKET ${req.body.label}-.${Datavar}`
      const tokengenerated = signAccessTicket(req.user._id,req.body.Duration);
      const calculatedDurationExpire = Datavar + CalculateExpire(req.body.hr) + CalculateExpire(req.body.mm)
      const normalizeData = {
        name:Ticketname,
        tokenTicket:tokengenerated,
        tokenExpire:calculatedDurationExpire,
        tokenDuration:req.body.Duration,
        ticketStatus:true
      }

      const activeToken = await Ticket.findOne({
        ticketStatus: true,
      });

      if (activeToken) {
        return res.json(
          returnJson(
            'error',
            'Another token is already active',
            activeToken
          )
        );
      }

      const createdTicket = await Ticket.create(normalizeData);

      return res.json(
        returnJson(
          'success',
          'Token created successfully',
          createdTicket
        )
      );
    } catch (error) {
      return res.status(500).json(
        returnJson(
          'error',
          'An Error occurred',
          error.message
        )
      );
    }
  }
);


router.delete(
  '/retireticket/:id',
  restrictTo('user', 'admin'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const deletedRecord =
        await Ticket.findByIdAndDelete(id);

      if (!deletedRecord) {
        return res.status(404).json(
          returnJson(
            'error',
            'Id not Found',
            null
          )
        );
      }

      return res.json(
        returnJson(
          'success',
          'Delete request was successful',
          deletedRecord
        )
      );
    } catch (err) {
      return res.status(500).json({
        status: 'error',
        message: err.message,
      });
    }
  }
);

module.exports = router;