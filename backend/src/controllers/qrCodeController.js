const QRCode = require('../models/QRCode');
const InternetLounge = require('../models/InternetLounge');
const crypto = require('crypto');

exports.getActiveQRCode = async (req, res, next) => {
  try {
    const now = new Date();
    const activeQR = await QRCode.findOne({
      status: 'active',
      expiresAt: { $gt: now }
    }).sort({ createdAt: -1 }).populate('createdBy', 'name email');

    if (!activeQR) {
      return res.status(200).json({ success: true, data: null });
    }

    res.status(200).json({
      success: true,
      data: {
        ...activeQR.toObject(),
        computedStatus: 'Active'
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.generateQRCode = async (req, res, next) => {
  try {
    const { label, durationValue, durationUnit } = req.body;
    
    // Deactivate previous active QR codes so only the newly generated code is active
    await QRCode.updateMany(
      { status: 'active' },
      { $set: { status: 'deactivated' } }
    );

    // Generate token
    const token = crypto.randomBytes(16).toString('hex');
    
    // Calculate expiresAt
    const now = new Date();
    let expiresAt = new Date(now);
    if (durationUnit === 'minutes') {
      expiresAt.setMinutes(expiresAt.getMinutes() + Number(durationValue));
    } else if (durationUnit === 'hours') {
      expiresAt.setHours(expiresAt.getHours() + Number(durationValue));
    } else if (durationUnit === 'days') {
      expiresAt.setDate(expiresAt.getDate() + Number(durationValue));
    }

    const qrCode = await QRCode.create({
      token,
      label,
      durationValue,
      durationUnit,
      expiresAt,
      createdBy: req.user?._id,
      status: 'active'
    });

    const populatedQR = await QRCode.findById(qrCode._id).populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      data: {
        ...populatedQR.toObject(),
        computedStatus: 'Active'
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getQRCodes = async (req, res, next) => {
  try {
    const qrcodes = await QRCode.find().populate('createdBy', 'name email').sort({ createdAt: -1 });
    
    // Compute live status
    const now = new Date();
    const computedList = qrcodes.map(qr => {
      let isExpired = qr.expiresAt < now || qr.status === 'deactivated';
      return {
        ...qr.toObject(),
        computedStatus: isExpired ? 'Expired' : 'Active'
      };
    });

    res.status(200).json({ success: true, data: computedList });
  } catch (err) {
    next(err);
  }
};

exports.deactivateQRCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const qrCode = await QRCode.findByIdAndUpdate(id, { status: 'deactivated', expiresAt: new Date() }, { new: true });
    if (!qrCode) return res.status(404).json({ error: 'QR Code not found' });
    res.status(200).json({ success: true, data: qrCode });
  } catch (err) {
    next(err);
  }
};

exports.regenerateQRCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { durationValue, durationUnit } = req.body;

    const existingQR = await QRCode.findById(id);
    if (!existingQR) return res.status(404).json({ error: 'QR Code not found' });

    const newToken = crypto.randomBytes(16).toString('hex');
    const durVal = durationValue ? Number(durationValue) : existingQR.durationValue;
    const durUnit = durationUnit || existingQR.durationUnit;

    const now = new Date();
    let expiresAt = new Date(now);
    if (durUnit === 'minutes') {
      expiresAt.setMinutes(expiresAt.getMinutes() + Number(durVal));
    } else if (durUnit === 'hours') {
      expiresAt.setHours(expiresAt.getHours() + Number(durVal));
    } else if (durUnit === 'days') {
      expiresAt.setDate(expiresAt.getDate() + Number(durVal));
    }

    existingQR.token = newToken;
    existingQR.expiresAt = expiresAt;
    existingQR.durationValue = durVal;
    existingQR.durationUnit = durUnit;
    existingQR.status = 'active';

    await existingQR.save();

    const updatedQR = await QRCode.findById(id).populate('createdBy', 'name email');
    const computedStatus = updatedQR.expiresAt < new Date() || updatedQR.status === 'deactivated' ? 'Expired' : 'Active';

    res.status(200).json({ success: true, data: { ...updatedQR.toObject(), computedStatus } });
  } catch (err) {
    next(err);
  }
};

exports.deleteQRCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const qrCode = await QRCode.findByIdAndDelete(id);
    if (!qrCode) return res.status(404).json({ error: 'QR Code not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

exports.validateQRToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (token === 'active' || token === 'general') {
      const activeQR = await QRCode.findOne({ status: 'active' }).sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        data: { label: activeQR?.label || 'General Lounge Attendance', token: activeQR?.token || 'active' }
      });
    }

    const qrCode = await QRCode.findOne({ token });
    if (!qrCode) {
      return res.status(200).json({
        success: true,
        data: { label: 'General Lounge Attendance', token }
      });
    }
    
    const isExpired = qrCode.expiresAt < new Date() || qrCode.status === 'deactivated';
    if (isExpired) {
      return res.status(400).json({ error: 'This QR code has expired. Please ask a staff member for a new one.' });
    }
    
    res.status(200).json({ success: true, data: { label: qrCode.label, token: qrCode.token } });
  } catch (err) {
    next(err);
  }
};

exports.submitAttendance = async (req, res, next) => {
  try {
    const { token } = req.params;
    let qrCode = null;
    if (token && token !== 'active' && token !== 'general') {
      qrCode = await QRCode.findOne({ token });
    } else {
      qrCode = await QRCode.findOne({ status: 'active' }).sort({ createdAt: -1 });
    }

    const { fullName, idNumber, idType, gender, contact, timeIn, timeOut } = req.body;

    const formattedTimeIn = timeIn
      ? (typeof timeIn === 'string' && timeIn.includes('T') ? timeIn.split('T')[1] : timeIn)
      : new Date().toLocaleTimeString('en-US', { hour12: false });

    const formattedTimeOut = timeOut
      ? (typeof timeOut === 'string' && timeOut.includes('T') ? timeOut.split('T')[1] : timeOut)
      : '';

    const newLounge = await InternetLounge.create({
      name: fullName || 'Anonymous Visitor',
      identifier: idNumber || `ID-${Date.now().toString().slice(-6)}`,
      identifierType: idType || 'student_id',
      gender: gender || 'other',
      contactNumber: contact || 'N/A',
      timeIn: formattedTimeIn,
      timeOut: formattedTimeOut,
      Signature: fullName || 'QR Attendance Sign-in',
      qrToken: qrCode ? qrCode.token : (token || 'GENERAL')
    });

    if (qrCode) {
      qrCode.submissionCount = (qrCode.submissionCount || 0) + 1;
      await qrCode.save();
    }

    res.status(201).json({ success: true, data: newLounge, message: 'Attendance submitted to Lounge successfully' });
  } catch (err) {
    next(err);
  }
};

exports.getQRSubmissions = async (req, res, next) => {
  try {
    const { token } = req.params;
    const submissions = await InternetLounge.find({ qrToken: token }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: submissions });
  } catch (err) {
    next(err);
  }
};
