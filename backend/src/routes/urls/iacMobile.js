const express = require('express');
const router = express.Router();
const CheckinTicket = require('../../models/CheckinTicket');
const MobileUserProfile = require('../../models/MobileUserProfile');
const Issue = require('../../models/Issue');
const IssueVote = require('../../models/IssueVote');
const Announcement = require('../../models/Announcement');
const MobileBookingRequest = require('../../models/MobileBookingRequest');
const SmtpConfig = require('../../models/SmtpConfig');
const InternetLounge = require('../../models/InternetLounge');
const Booking = require('../../models/booking');
const { sendEmail, verifyAndSendTestEmail } = require('../../services/mailerService');
const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } = require('../../utils/jwt');

// Middleware to verify mobile JWT token
const verifyMobileToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No access token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    const profile = await MobileUserProfile.findById(decoded.id);
    if (!profile) {
      return res.status(401).json({ error: 'Mobile user does not exist' });
    }
    req.mobileUser = profile;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// -------------------------------------------------------------
// 0. MOBILE USER AUTHENTICATION & CERTIFICATION
// -------------------------------------------------------------

// REGISTER
router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, phoneNumber, studentId } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await MobileUserProfile.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const mobileUserId = 'mob_user_' + Math.floor(100000 + Math.random() * 900000);
    const profile = new MobileUserProfile({
      mobileUserId,
      name: name.trim(),
      email: normalizedEmail,
      phoneNumber: phoneNumber ? phoneNumber.trim() : '',
      studentId: studentId ? studentId.trim() : '',
      password,
    });

    await profile.save();

    const accessToken = signAccessToken(profile._id);
    const refreshToken = signRefreshToken(profile._id);

    profile.refreshToken = refreshToken;
    await profile.save({ validateBeforeSave: false });

    res.status(201).json({
      status: 'success',
      message: 'Mobile user registered successfully',
      accessToken,
      refreshToken,
      user: {
        id: profile._id,
        mobileUserId: profile.mobileUserId,
        name: profile.name,
        email: profile.email,
        phoneNumber: profile.phoneNumber,
        studentId: profile.studentId,
        streak: profile.streak,
        totalCheckins: profile.totalCheckins,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const profile = await MobileUserProfile.findOne({ email: normalizedEmail }).select('+password');
    if (!profile) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await profile.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const accessToken = signAccessToken(profile._id);
    const refreshToken = signRefreshToken(profile._id);

    profile.refreshToken = refreshToken;
    await profile.save({ validateBeforeSave: false });

    res.json({
      status: 'success',
      message: 'Logged in successfully',
      accessToken,
      refreshToken,
      user: {
        id: profile._id,
        mobileUserId: profile.mobileUserId,
        name: profile.name,
        email: profile.email,
        phoneNumber: profile.phoneNumber,
        studentId: profile.studentId,
        streak: profile.streak,
        totalCheckins: profile.totalCheckins,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VERIFY CURRENT TOKEN
router.get('/auth/verify', verifyMobileToken, async (req, res) => {
  const profile = req.mobileUser;
  res.json({
    status: 'success',
    user: {
      id: profile._id,
      mobileUserId: profile.mobileUserId,
      name: profile.name,
      email: profile.email,
      phoneNumber: profile.phoneNumber,
      studentId: profile.studentId,
      streak: profile.streak,
      totalCheckins: profile.totalCheckins,
    },
  });
});

// REFRESH TOKEN
router.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const profile = await MobileUserProfile.findById(decoded.id).select('+refreshToken');
    if (!profile || profile.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const newAccessToken = signAccessToken(profile._id);
    res.json({
      status: 'success',
      accessToken: newAccessToken,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// LOGOUT
router.post('/auth/logout', verifyMobileToken, async (req, res) => {
  try {
    const profile = req.mobileUser;
    profile.refreshToken = undefined;
    await profile.save({ validateBeforeSave: false });
    res.json({ status: 'success', message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper function to update/calculate streak accurately
async function calculateAndApplyStreak(mobileUserId, userName = '', userEmail = '') {
  let profile = await MobileUserProfile.findOne({ mobileUserId });
  if (!profile) {
    profile = new MobileUserProfile({
      mobileUserId,
      name: userName || 'Mobile Member',
      email: userEmail || `${mobileUserId}@example.com`,
      streak: 0,
      longestStreak: 0,
      totalCheckins: 0,
    });
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (!profile.lastCheckinDate) {
    profile.streak = 1;
    profile.longestStreak = Math.max(profile.longestStreak || 0, 1);
    profile.totalCheckins = (profile.totalCheckins || 0) + 1;
    profile.lastCheckinDate = now;
    await profile.save();
    return profile;
  }

  const lastDate = new Date(profile.lastCheckinDate);
  const lastStr = lastDate.toISOString().split('T')[0];

  if (todayStr === lastStr) {
    // Same day checkin
    if (profile.streak === 0) profile.streak = 1;
  } else {
    const utc1 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const utc2 = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
    const diffDays = Math.floor((utc1 - utc2) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      profile.streak = (profile.streak || 0) + 1;
    } else {
      profile.streak = 1;
    }
  }

  profile.totalCheckins = (profile.totalCheckins || 0) + 1;
  profile.longestStreak = Math.max(profile.longestStreak || 0, profile.streak);
  profile.lastCheckinDate = now;
  await profile.save();
  return profile;
}

// -------------------------------------------------------------
// 1. CHECK-IN TICKETS
// -------------------------------------------------------------

// Get all checkin tickets (Admin or mobile queue)
router.get('/checkin-tickets', async (req, res) => {
  try {
    const { status, mobileUserId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (mobileUserId) filter.mobileUserId = mobileUserId;
    const tickets = await CheckinTicket.find(filter).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check today's check-in status for a specific user
router.get('/checkin-tickets/today/:mobileUserId', async (req, res) => {
  try {
    const { mobileUserId } = req.params;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const ticket = await CheckinTicket.findOne({
      mobileUserId,
      $or: [
        { requestedAt: { $gte: todayStart, $lte: todayEnd } },
        { confirmedAt: { $gte: todayStart, $lte: todayEnd } }
      ]
    }).sort({ createdAt: -1 });

    if (!ticket) {
      return res.json({ checkedIn: false, ticket: null });
    }

    const isCheckedIn = (ticket.status === 'pending' || ticket.status === 'confirmed') && !ticket.checkedOutAt;
    res.json({
      checkedIn: isCheckedIn,
      status: ticket.status,
      ticket
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single checkin ticket by ID (For real-time polling)
router.get('/checkin-tickets/:id', async (req, res) => {
  try {
    const ticket = await CheckinTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create checkin ticket (Mobile user action) with Duplicate Prevention
router.post('/checkin-tickets', async (req, res) => {
  try {
    const { mobileUserId, mobileUserName, mobileUserEmail, mobileUserPhone, mobileUserIdNumber } = req.body;
    if (!mobileUserId) {
      return res.status(400).json({ error: 'mobileUserId is required' });
    }

    // Lookup user profile if phone or studentId missing from request body
    let userPhone = mobileUserPhone || '';
    let userIdNum = mobileUserIdNumber || '';
    const profile = await MobileUserProfile.findOne({ mobileUserId });
    if (profile) {
      if (!userPhone) userPhone = profile.phoneNumber || '';
      if (!userIdNum) userIdNum = profile.studentId || '';
    }

    // Duplicate Check-in Prevention Rule: Check if user already checked in today and has not checked out
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existingTodayTicket = await CheckinTicket.findOne({
      mobileUserId,
      status: { $in: ['pending', 'confirmed'] },
      checkedOutAt: { $exists: false },
      $or: [
        { requestedAt: { $gte: todayStart, $lte: todayEnd } },
        { confirmedAt: { $gte: todayStart, $lte: todayEnd } }
      ]
    });

    if (existingTodayTicket) {
      return res.status(400).json({
        error: 'You are already checked in for today.',
        ticket: existingTodayTicket,
        alreadyCheckedIn: true
      });
    }

    // Generate unique code like IAC-7892
    const code = 'IAC-' + Math.floor(1000 + Math.random() * 9000);

    const ticket = new CheckinTicket({
      mobileUserId,
      mobileUserName: mobileUserName || (profile ? profile.name : 'Mobile Visitor'),
      mobileUserEmail: mobileUserEmail || (profile ? profile.email : ''),
      mobileUserPhone: userPhone,
      mobileUserIdNumber: userIdNum,
      ticketCode: code,
      status: 'pending',
      requestedAt: new Date(),
    });

    await ticket.save();
    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm checkin ticket (Admin action)
router.post('/checkin-tickets/:id/confirm', async (req, res) => {
  try {
    const ticket = await CheckinTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.status === 'confirmed') {
      return res.status(400).json({ error: 'Ticket already confirmed' });
    }

    const { staffName, identifier, identifierType, contactNumber, gender } = req.body;

    const profile = await MobileUserProfile.findOne({ mobileUserId: ticket.mobileUserId });
    const finalPhone = contactNumber || ticket.mobileUserPhone || (profile ? profile.phoneNumber : '') || '0000000000';
    const finalId = identifier || ticket.mobileUserIdNumber || (profile ? profile.studentId : '') || `MOB-${ticket.ticketCode}`;

    // 1. Create record in existing InternetLounge collection
    const loungeEntry = new InternetLounge({
      name: ticket.mobileUserName || (profile ? profile.name : 'Mobile Visitor'),
      identifier: finalId,
      identifierType: identifierType || 'student_id',
      contactNumber: finalPhone,
      gender: gender || 'other',
      timeIn: new Date().toLocaleTimeString('en-US', { hour12: false }),
      timeOut: null,
      Signature: `Mobile Ticket Pass ${ticket.ticketCode}`,
    });

    await loungeEntry.save();

    // 2. Mark CheckinTicket as confirmed
    ticket.status = 'confirmed';
    ticket.confirmedAt = new Date();
    ticket.confirmedBy = staffName || 'Admin Staff';
    await ticket.save();

    // 3. Update MobileUserProfile streak & total checkins
    const updatedProfile = await calculateAndApplyStreak(ticket.mobileUserId, ticket.mobileUserName, ticket.mobileUserEmail);

    res.json({
      message: 'Check-in ticket confirmed and logged to Lounge system successfully',
      ticket,
      loungeEntry,
      userStreak: updatedProfile ? updatedProfile.streak : 1,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Decline checkin ticket (Admin action)
router.post('/checkin-tickets/:id/decline', async (req, res) => {
  try {
    const { staffName, reason } = req.body;
    const ticket = await CheckinTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    ticket.status = 'declined';
    ticket.declinedAt = new Date();
    ticket.declinedBy = staffName || 'Admin Staff';
    ticket.declinedReason = reason || 'Declined by administrator';
    await ticket.save();

    res.json({
      message: 'Check-in ticket declined',
      ticket,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Checkout user from active checkin ticket
router.post('/checkin-tickets/:id/checkout', async (req, res) => {
  try {
    const ticket = await CheckinTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    ticket.status = 'checked_out';
    ticket.checkedOutAt = new Date();
    await ticket.save();

    res.json({
      message: 'Checked out successfully',
      ticket,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 2. REPORTS & ISSUES
// -------------------------------------------------------------

// Get issues
router.get('/issues', async (req, res) => {
  try {
    const { mobileUserId } = req.query;
    const issues = await Issue.find().sort({ createdAt: -1 }).lean();

    // If mobileUserId is supplied, attach current user's vote
    if (mobileUserId) {
      const issueIds = issues.map((i) => i._id);
      const votes = await IssueVote.find({
        issueId: { $in: issueIds },
        mobileUserId,
      });

      const voteMap = {};
      votes.forEach((v) => {
        voteMap[v.issueId.toString()] = v.direction;
      });

      issues.forEach((i) => {
        i.userVote = voteMap[i._id.toString()] || null;
      });
    }

    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create issue
router.post('/issues', async (req, res) => {
  try {
    const { reporterId, reporterName, category, description } = req.body;
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const issue = new Issue({
      reporterId: reporterId || null,
      reporterName: reporterName || 'Anonymous',
      category: category || 'General',
      description,
      status: 'pending',
    });

    await issue.save();
    res.status(201).json(issue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin update issue status (seen / pending / resolved)
router.patch('/issues/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['seen', 'pending', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json(issue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vote on issue (up or down)
router.post('/issues/:id/vote', async (req, res) => {
  try {
    const { mobileUserId, direction } = req.body;
    if (!mobileUserId || !['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'mobileUserId and valid direction (up/down) required' });
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Rule: Once status is resolved, voting closes
    if (issue.status === 'resolved') {
      return res.status(400).json({ error: 'Voting is closed for resolved issues' });
    }

    // Find existing vote
    const existingVote = await IssueVote.findOne({
      issueId: issue._id,
      mobileUserId,
    });

    if (existingVote) {
      if (existingVote.direction === direction) {
        // Remove vote if tapped again
        await IssueVote.deleteOne({ _id: existingVote._id });
        if (direction === 'up') issue.upvotesCount = Math.max(0, issue.upvotesCount - 1);
        if (direction === 'down') issue.downvotesCount = Math.max(0, issue.downvotesCount - 1);
      } else {
        // Change vote
        if (existingVote.direction === 'up') {
          issue.upvotesCount = Math.max(0, issue.upvotesCount - 1);
          issue.downvotesCount += 1;
        } else {
          issue.downvotesCount = Math.max(0, issue.downvotesCount - 1);
          issue.upvotesCount += 1;
        }
        existingVote.direction = direction;
        await existingVote.save();
      }
    } else {
      // New vote
      const newVote = new IssueVote({
        issueId: issue._id,
        mobileUserId,
        direction,
      });
      await newVote.save();
      if (direction === 'up') issue.upvotesCount += 1;
      if (direction === 'down') issue.downvotesCount += 1;
    }

    await issue.save();
    res.json(issue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3. ANNOUNCEMENTS
// -------------------------------------------------------------

// Active announcements for mobile app slider
router.get('/announcements', async (req, res) => {
  try {
    const now = new Date();
    const query = {
      isActive: true,
      $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }],
      $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gte: now } }],
    };

    const list = await Announcement.find(query).sort({ sortOrder: 1, createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin list all announcements
router.get('/admin/announcements', async (req, res) => {
  try {
    const list = await Announcement.find().sort({ sortOrder: 1, createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin create announcement
router.post('/announcements', async (req, res) => {
  try {
    const { category, title, description, imageUrl, startsAt, endsAt, sortOrder, isActive } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const item = new Announcement({
      category: category || 'notice',
      title,
      description,
      imageUrl: imageUrl || null,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      sortOrder: sortOrder || 0,
      isActive: isActive !== undefined ? isActive : true,
    });

    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin update announcement
router.put('/announcements/:id', async (req, res) => {
  try {
    const item = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin delete announcement
router.delete('/announcements/:id', async (req, res) => {
  try {
    const item = await Announcement.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json({ message: 'Announcement deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 4. MOBILE BOOKING REQUESTS
// -------------------------------------------------------------

// List mobile booking requests
router.get('/booking-requests', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const requests = await MobileBookingRequest.find(filter).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit mobile booking request (Mobile user)
router.post('/booking-requests', async (req, res) => {
  try {
    const {
      mobileUserId,
      mobileUserName,
      contactEmail,
      roomNumber,
      roomType,
      requestedDate,
      arrivalTime,
      requestedSlot,
      programName,
      description,
    } = req.body;

    const timeOfArrival = arrivalTime || requestedSlot;
    if (!mobileUserId || !contactEmail || !requestedDate || !timeOfArrival) {
      return res.status(400).json({ error: 'Missing required booking fields (Date and Time of Arrival required)' });
    }

    const reqDate = new Date(requestedDate);
    if (isNaN(reqDate.getTime())) {
      return res.status(400).json({ error: 'Invalid booking date format' });
    }

    const startOfDay = new Date(reqDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reqDate);
    endOfDay.setHours(23, 59, 59, 999);

    const roomNumStr = String(roomNumber || '3');

    // Guard 1: Check for existing pending or confirmed mobile booking request for the same room, date, and arrival time/slot
    const mobileConflict = await MobileBookingRequest.findOne({
      roomNumber: roomNumStr,
      requestedDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        { arrivalTime: timeOfArrival },
        { requestedSlot: timeOfArrival }
      ]
    });

    if (mobileConflict) {
      return res.status(409).json({
        error: `Booking Conflict: Room ${roomNumStr} already has a ${mobileConflict.status} reservation on ${reqDate.toISOString().split('T')[0]} at ${timeOfArrival}. Please choose another time or room.`
      });
    }

    // Guard 2: Check for existing booking in the primary Booking system
    const dateFormatted = reqDate.toISOString().split('T')[0];
    const systemConflict = await Booking.findOne({
      $or: [
        { roomNumber: Number(roomNumStr) },
        { roomNumber: roomNumStr }
      ],
      date: dateFormatted,
      $or: [{ timeSlot: timeOfArrival }, { timeSlots: timeOfArrival }]
    });

    if (systemConflict) {
      return res.status(409).json({
        error: `Booking Conflict: Room ${roomNumStr} is already reserved in the facility schedule for ${dateFormatted} at ${timeOfArrival}.`
      });
    }

    const request = new MobileBookingRequest({
      mobileUserId,
      mobileUserName: mobileUserName || 'Mobile User',
      contactEmail,
      roomNumber: roomNumStr,
      roomType: roomType || 'conference',
      requestedDate: new Date(requestedDate),
      arrivalTime: timeOfArrival,
      requestedSlot: timeOfArrival,
      programName: programName || 'IAC Mobile Reservation',
      description: description || '',
      status: 'pending',
    });

    await request.save();
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm Mobile Booking Request (Admin Action)
router.post('/booking-requests/:id/confirm', async (req, res) => {
  try {
    const request = await MobileBookingRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Booking request not found' });
    }

    if (request.status === 'confirmed') {
      return res.status(400).json({ error: 'Booking request is already confirmed' });
    }

    const dateFormatted = new Date(request.requestedDate).toISOString().split('T')[0];
    const reqDate = new Date(request.requestedDate);
    const startOfDay = new Date(reqDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reqDate);
    endOfDay.setHours(23, 59, 59, 999);

    const timeVal = request.arrivalTime || request.requestedSlot;

    // Check if another request was already confirmed for this room and time
    const existingConfirmed = await MobileBookingRequest.findOne({
      _id: { $ne: request._id },
      roomNumber: String(request.roomNumber),
      requestedDate: { $gte: startOfDay, $lte: endOfDay },
      status: 'confirmed',
      $or: [
        { arrivalTime: timeVal },
        { requestedSlot: timeVal }
      ]
    });

    if (existingConfirmed) {
      return res.status(409).json({
        error: `Slot Conflict: Room ${request.roomNumber} already has a confirmed booking for ${dateFormatted} at ${timeVal}.`
      });
    }

    // Conflict check in existing production Booking model
    const conflict = await Booking.findOne({
      $or: [
        { roomNumber: Number(request.roomNumber) },
        { roomNumber: String(request.roomNumber) }
      ],
      date: dateFormatted,
      $or: [{ timeSlot: timeVal }, { timeSlots: timeVal }],
    });

    if (conflict) {
      return res.status(409).json({
        error: 'Slot conflict: Room is already booked in the primary system for this date and time slot.',
      });
    }

    // Call existing booking model creation path
   const createdBooking = new Booking({
  startDate: reqDate,
  endDate: reqDate,
  date:reqDate,

  name: request.programName || 'IAC Mobile Reservation',
  programName: request.programName || 'IAC Mobile Reservation',

  organizer: request.mobileUserName || 'Mobile App User',
  presenter: request.mobileUserName || 'Mobile App User',

  participants: 1,

  eventType: 'meetings',
  category: 'others',
  beneficiaries: 'others',

  description:
    request.description ||
    `Booked via Mobile App by ${request.mobileUserName}`,

  roomNumber: Number(request.roomNumber || 3),

  // Must exactly match the EventProgram enum
  roomType: 'Conference Room',

  // Must exactly match the effective EventProgram enum
  status: 'RESERVED',

  createdBy: request.mobileUserName || 'mobile',
});

    await createdBooking.save();

    // Mark request confirmed & link _id
    request.status = 'confirmed';
    request.confirmedBookingId = createdBooking._id;
    await request.save();

    // Send confirmation email
    const emailResult = await sendEmail({
      to: request.contactEmail,
      subject: 'Booking Confirmed - IAC Mobile System',
      html: `
        <div style="font-family: sans-serif; padding: 24px; color: #18181b; background-color: #f8fafc; border-radius: 12px;">
          <h2 style="color: #16a34a; margin-top: 0;">Reservation Confirmed 🎉</h2>
          <p>Hello <strong>${request.mobileUserName}</strong>,</p>
          <p>Your room booking request submitted via the IAC Mobile App has been reviewed and approved by staff.</p>
          <div style="background-color: #ffffff; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Program:</strong> ${request.programName}</p>
            <p style="margin: 4px 0;"><strong>Room Number:</strong> Room ${request.roomNumber}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${dateFormatted}</p>
            <p style="margin: 4px 0;"><strong>Time Slot:</strong> ${request.requestedSlot}</p>
          </div>
          <p>We look forward to hosting you at the Information Access Center!</p>
          <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">IAC Mobile System &bull; Automated Notification</p>
        </div>
      `,
    });

    res.json({
      message: 'Booking request confirmed and written to production booking system',
      bookingRequest: request,
      createdBooking,
      emailStatus: emailResult,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject Mobile Booking Request (Admin Action)
router.post('/booking-requests/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const request = await MobileBookingRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Booking request not found' });
    }

    request.status = 'rejected';
    await request.save();

    const dateFormatted = new Date(request.requestedDate).toISOString().split('T')[0];

    // Send rejection email
    const emailResult = await sendEmail({
      to: request.contactEmail,
      subject: 'Booking Request Update - IAC Mobile System',
      html: `
        <div style="font-family: sans-serif; padding: 24px; color: #18181b; background-color: #f8fafc; border-radius: 12px;">
          <h2 style="color: #dc2626; margin-top: 0;">Reservation Request Declined</h2>
          <p>Hello <strong>${request.mobileUserName}</strong>,</p>
          <p>Unfortunately, your room reservation request for <strong>Room ${request.roomNumber}</strong> on <strong>${dateFormatted} (${request.requestedSlot})</strong> could not be approved at this time.</p>
          ${
            reason
              ? `<div style="background-color: #fee2e2; color: #991b1b; padding: 12px; border-radius: 8px; margin: 16px 0;"><strong>Reason:</strong> ${reason}</div>`
              : ''
          }
          <p>Please feel free to submit a request for an alternative date or slot in the app.</p>
          <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">IAC Mobile System &bull; Automated Notification</p>
        </div>
      `,
    });

    res.json({
      message: 'Booking request rejected and user notified via email',
      bookingRequest: request,
      emailStatus: emailResult,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. SMTP SETTINGS & EMAIL TEST
// -------------------------------------------------------------

// Get SMTP config
router.get('/smtp-config', async (req, res) => {
  try {
    let config = await SmtpConfig.findOne().sort({ createdAt: -1 });
    if (!config) {
      config = new SmtpConfig({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        fromEmail: '',
        fromName: 'IAC Mobile System',
      });
      await config.save();
    }

    res.json({
      _id: config._id,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      pass: config.pass ? '••••••••' : '',
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      isConfigured: Boolean(config.user && config.pass),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update SMTP config
router.post('/smtp-config', async (req, res) => {
  try {
    const { host, port, secure, user, pass, fromEmail, fromName } = req.body;

    let config = await SmtpConfig.findOne().sort({ createdAt: -1 });
    if (!config) {
      config = new SmtpConfig({});
    }

    if (host !== undefined) config.host = host;
    if (port !== undefined) config.port = Number(port);
    if (secure !== undefined) config.secure = Boolean(secure);
    if (user !== undefined) config.user = user;
    // Only update pass if provided and not masked
    if (pass !== undefined && pass !== '••••••••') {
      config.pass = pass;
    }
    if (fromEmail !== undefined) config.fromEmail = fromEmail;
    if (fromName !== undefined) config.fromName = fromName;

    await config.save();

    res.json({
      message: 'SMTP Configuration saved successfully',
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        pass: config.pass ? '••••••••' : '',
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        isConfigured: Boolean(config.user && config.pass),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test SMTP config
router.post('/smtp-config/test', async (req, res) => {
  try {
    const { testEmail } = req.body;
    if (!testEmail) {
      return res.status(400).json({ error: 'Test email address is required' });
    }

    await verifyAndSendTestEmail(testEmail);
    res.json({ message: `Test email sent successfully to ${testEmail}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Mobile User Profile / Streak with accuracy verification
router.get('/user-profile/:mobileUserId', async (req, res) => {
  try {
    let profile = await MobileUserProfile.findOne({ mobileUserId: req.params.mobileUserId });
    if (!profile) {
      profile = new MobileUserProfile({
        mobileUserId: req.params.mobileUserId,
        streak: 0,
        longestStreak: 0,
        totalCheckins: 0,
      });
      await profile.save();
    } else {
      // Check if user missed consecutive days
      if (profile.lastCheckinDate) {
        const now = new Date();
        const lastDate = new Date(profile.lastCheckinDate);
        const utc1 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const utc2 = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
        const diffDays = Math.floor((utc1 - utc2) / (1000 * 60 * 60 * 24));
        if (diffDays > 1 && profile.streak > 0) {
          profile.streak = 0;
          await profile.save();
        }
      }
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rankings / Leaderboard Endpoint (Req 5)
router.get('/rankings', async (req, res) => {
  try {
    const profiles = await MobileUserProfile.find().lean();
    const now = new Date();

    const list = profiles.map((p) => {
      let activeStreak = p.streak || 0;
      if (p.lastCheckinDate) {
        const lastDate = new Date(p.lastCheckinDate);
        const utc1 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const utc2 = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
        const diffDays = Math.floor((utc1 - utc2) / (1000 * 60 * 60 * 24));
        if (diffDays > 1) activeStreak = 0;
      }
      return {
        mobileUserId: p.mobileUserId,
        name: p.name || 'Mobile Member',
        email: p.email || '',
        streak: activeStreak,
        longestStreak: p.longestStreak || activeStreak,
        totalCheckins: p.totalCheckins || 0,
        lastCheckinDate: p.lastCheckinDate,
      };
    });

    list.sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      if (b.totalCheckins !== a.totalCheckins) return b.totalCheckins - a.totalCheckins;
      return b.longestStreak - a.longestStreak;
    });

    list.forEach((item, index) => {
      item.rank = index + 1;
    });

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alias for /rankings
router.get('/leaderboard', async (req, res) => {
  req.url = '/rankings';
  return router.handle(req, res);
});

// Booking & Check-in History Portal Endpoint (Req 3)
router.get('/history/:mobileUserId', async (req, res) => {
  try {
    const { mobileUserId } = req.params;
    const tickets = await CheckinTicket.find({ mobileUserId }).lean();
    const bookings = await MobileBookingRequest.find({ mobileUserId }).lean();

    const history = [];

    tickets.forEach((t) => {
      let statusDisplay = 'Pending';
      if (t.status === 'confirmed') statusDisplay = 'Approved';
      else if (t.status === 'declined') statusDisplay = 'Declined';
      else if (t.status === 'checked_out') statusDisplay = 'Checked Out';
      else if (t.status === 'expired') statusDisplay = 'Expired';

      history.push({
        id: t._id,
        type: 'checkin',
        title: 'Day Pass Check-In',
        ticketCode: t.ticketCode,
        date: t.requestedAt || t.createdAt,
        checkinTime: t.confirmedAt
          ? new Date(t.confirmedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date(t.requestedAt || t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        checkoutTime: t.checkedOutAt
          ? new Date(t.checkedOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : null,
        status: t.status,
        statusDisplay,
        details: 'Adjei Business Hub · Internet Lounge Access Pass',
      });
    });

    bookings.forEach((b) => {
      let statusDisplay = 'Pending';
      if (b.status === 'confirmed') statusDisplay = 'Approved';
      else if (b.status === 'rejected') statusDisplay = 'Declined';

      history.push({
        id: b._id,
        type: 'booking',
        title: b.programName || 'Room Reservation',
        ticketCode: `BOOK-${b._id.toString().slice(-6).toUpperCase()}`,
        date: b.requestedDate || b.createdAt,
        checkinTime: b.requestedSlot,
        checkoutTime: null,
        status: b.status,
        statusDisplay,
        details: `Room ${b.roomNumber} (${b.roomType})`,
      });
    });

    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;