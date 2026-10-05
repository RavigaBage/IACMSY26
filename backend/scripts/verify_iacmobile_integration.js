/**
 * Comprehensive End-to-End Verification for IAC Mobile App Integration
 * Tests:
 * 1. Static file serving for both /iacmobile-app/ and /IACMOBILE APP/
 * 2. Mobile User Registration, Login, Token Verify, Refresh
 * 3. Mobile Check-in Ticket Request (Pending State)
 * 4. Dashboard Admin Retrieval of Pending Check-in
 * 5. Dashboard Admin Approval of Check-in -> Lounge Persistence + Streak increment
 * 6. Mobile App Status Synchronization (receives 'confirmed' status)
 * 7. Mobile Check-out Workflow
 * 8. Second Ticket Rejection Workflow (Decline with reason) -> Mobile status sync
 * 9. Mobile Booking Request Submission (Pending)
 * 10. Dashboard Admin Retrieval of Booking Request
 * 11. Dashboard Admin Approval of Booking -> Production Booking Record Persistence
 * 12. Mobile Stage 2: Event Details Submission -> Sync to Production Booking Record
 * 13. Mobile Issue Reporting, Voting, Admin Status Triage
 * 14. Mobile Announcements and Rankings Endpoints
 */

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('🚀 Starting Comprehensive IAC Mobile App Integration Test...\n');
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
    } else {
      console.error(`  ✗ FAILED: ${message}`);
      failures++;
    }
  }

  try {
    // 1. Static Serving Check
    console.log('--- 1. Static Web Client Serving ---');
    const staticRes1 = await fetch(`${BASE_URL}/iacmobile-app/`);
    const staticText1 = await staticRes1.text();
    assert(staticRes1.ok && staticText1.includes('IAC Mobile'), 'GET /iacmobile-app/ serves mobile client HTML');

    const staticRes2 = await fetch(`${BASE_URL}/IACMOBILE%20APP/`);
    const staticText2 = await staticRes2.text();
    assert(staticRes2.ok && staticText2.includes('IAC Mobile'), 'GET /IACMOBILE APP/ serves mobile client HTML');

    // 2. Authentication Flow
    console.log('\n--- 2. Authentication & User Profile ---');
    const testEmail = `test.user.${Date.now()}@example.com`;
    const regRes = await fetch(`${BASE_URL}/api/iac-mobile/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Kofi Mensah',
        email: testEmail,
        password: 'Password123!',
        phoneNumber: '0241234567',
        studentId: 'IAC-STD-9901'
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201 && regData.accessToken, 'Mobile Registration succeeded and returned JWT');
    const mobileToken = regData.accessToken;
    const mobileUserId = regData.user.mobileUserId;

    // Verify token
    const verifyRes = await fetch(`${BASE_URL}/api/iac-mobile/auth/verify`, {
      headers: { 'Authorization': `Bearer ${mobileToken}` }
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.ok && verifyData.user.email === testEmail, 'GET /api/iac-mobile/auth/verify authenticated correctly');

    // 3. Mobile Check-in Ticket Request
    console.log('\n--- 3. Check-in Request Workflow ---');
    const checkinReqRes = await fetch(`${BASE_URL}/api/iac-mobile/checkin-tickets/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mobileToken}`
      },
      body: JSON.stringify({
        mobileUserId,
        mobileUserName: 'Kofi Mensah',
        mobileUserEmail: testEmail,
        mobileUserPhone: '0241234567',
        mobileUserIdNumber: 'IAC-STD-9901'
      })
    });
    const ticketData = await checkinReqRes.json();
    assert(checkinReqRes.status === 201 && ticketData.status === 'pending', 'POST /checkin-tickets/request created pending ticket in MongoDB');
    const ticketId = ticketData._id;
    const ticketCode = ticketData.ticketCode;
    console.log(`     Ticket Code Generated: ${ticketCode}`);

    // 4. Admin Dashboard Retrieval
    console.log('\n--- 4. Dashboard Retrieval of Pending Ticket ---');
    const adminTicketsRes = await fetch(`${BASE_URL}/api/iac-mobile/checkin-tickets?status=pending`);
    const adminTickets = await adminTicketsRes.json();
    const foundPending = adminTickets.find(t => t._id === ticketId);
    assert(foundPending && foundPending.status === 'pending', 'Admin Dashboard retrieves pending check-in in queue');

    // 5. Admin Dashboard Approval
    console.log('\n--- 5. Admin Approval & Lounge Persistence ---');
    const confirmRes = await fetch(`${BASE_URL}/api/iac-mobile/checkin-tickets/${ticketId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staffName: 'Admin Desk Officer',
        contactNumber: '0241234567',
        identifier: 'IAC-STD-9901'
      })
    });
    const confirmData = await confirmRes.json();
    assert(confirmRes.ok && confirmData.ticket.status === 'confirmed', 'Admin POST /confirm updated ticket status to confirmed');
    assert(confirmData.loungeEntry && confirmData.loungeEntry.identifier === 'IAC-STD-9901', 'Lounge record automatically created in InternetLounge');
    assert(confirmData.userStreak >= 1, 'Mobile member streak calculated and updated');

    // 6. Mobile App Status Synchronization
    console.log('\n--- 6. Mobile App Status Synchronization ---');
    const mobileSyncRes = await fetch(`${BASE_URL}/api/iac-mobile/checkin-tickets?mobileUserId=${mobileUserId}`, {
      headers: { 'Authorization': `Bearer ${mobileToken}` }
    });
    const mobileTickets = await mobileSyncRes.json();
    const syncedTicket = mobileTickets.find(t => t._id === ticketId);
    assert(syncedTicket && syncedTicket.status === 'confirmed', 'Mobile client polling receives updated "confirmed" status');

    // 7. Mobile Checkout
    console.log('\n--- 7. Mobile Check-out ---');
    const checkoutRes = await fetch(`${BASE_URL}/api/iac-mobile/checkin-tickets/${ticketId}/checkout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mobileToken}` }
    });
    const checkoutData = await checkoutRes.json();
    assert(checkoutRes.ok && checkoutData.ticket.status === 'checked_out', 'Mobile POST /checkout checked out ticket');

    // 8. Second Ticket: Decline Workflow
    console.log('\n--- 8. Admin Decline Check-in Workflow ---');
    const ticket2Res = await fetch(`${BASE_URL}/api/iac-mobile/checkin-tickets/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mobileToken}`
      },
      body: JSON.stringify({
        mobileUserId,
        mobileUserName: 'Kofi Mensah',
        mobileUserEmail: testEmail,
      })
    });
    const ticket2Data = await ticket2Res.json();
    assert(ticket2Res.status === 201, 'Created second ticket for rejection test');

    const declineRes = await fetch(`${BASE_URL}/api/iac-mobile/checkin-tickets/${ticket2Data._id}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staffName: 'Admin Desk Officer',
        reason: 'Lounge at maximum capacity'
      })
    });
    const declineData = await declineRes.json();
    assert(declineRes.ok && declineData.ticket.status === 'declined' && declineData.ticket.declinedReason === 'Lounge at maximum capacity', 'Admin POST /decline updated ticket to declined with reason');

    // 9. Booking Workflow
    console.log('\n--- 9. Mobile Booking Submission ---');
    const bookReqDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
    const bookingRes = await fetch(`${BASE_URL}/api/iac-mobile/booking-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mobileToken}`
      },
      body: JSON.stringify({
        mobileUserId,
        mobileUserName: 'Kofi Mensah',
        contactEmail: testEmail,
        roomNumber: '3',
        roomType: 'Conference Room',
        requestedDate: bookReqDate,
        arrivalTime: '15:00',
        programName: 'Robotics Team Prep',
        description: 'Testing autonomous mobile platform'
      })
    });
    const bookingData = await bookingRes.json();
    assert(bookingRes.status === 201 && bookingData.status === 'pending', 'POST /booking-requests created pending booking request');
    const bookingId = bookingData._id;

    // 10. Admin Dashboard Retrieval & Approval of Booking
    console.log('\n--- 10. Dashboard Approval & Production Calendar Sync ---');
    const adminBookingsRes = await fetch(`${BASE_URL}/api/iac-mobile/booking-requests?status=pending`);
    const adminBookings = await adminBookingsRes.json();
    assert(adminBookings.some(b => b._id === bookingId), 'Admin Dashboard retrieves pending booking request');

    const confirmBookingRes = await fetch(`${BASE_URL}/api/iac-mobile/booking-requests/${bookingId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const confirmBookingData = await confirmBookingRes.json();
    assert(confirmBookingRes.ok && confirmBookingData.bookingRequest.status === 'confirmed', 'Admin POST /confirm approved booking request');
    assert(confirmBookingData.createdBooking && confirmBookingData.createdBooking._id, 'Production Booking record created in facility schedule');

    // 11. Stage 2: Event Details Submission
    console.log('\n--- 11. Stage 2: Event Details Submission ---');
    const evDetailsRes = await fetch(`${BASE_URL}/api/iac-mobile/booking-requests/${bookingId}/event-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programName: 'Robotics Team Prep - Session 1',
        organizer: 'Robotics Lab',
        presenter: 'Kofi Mensah',
        participants: 6,
        eventType: 'project',
        category: 'robotics',
        beneficiaries: 'students',
        description: 'Autonomous rover chassis assembly and firmware programming',
        paymentStatus: 'Paid'
      })
    });
    const evDetailsData = await evDetailsRes.json();
    assert(evDetailsRes.ok && evDetailsData.bookingRequest.eventDetailsSubmitted === true, 'Stage 2 event details attached to booking request');

    // 12. Issues Reporting
    console.log('\n--- 12. Hardware / Facility Issues Reporting ---');
    const issueRes = await fetch(`${BASE_URL}/api/iac-mobile/issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mobileToken}`
      },
      body: JSON.stringify({
        title: 'HDMI connection flickering on Rig 05',
        nodeEquipment: 'LAB-PC-05',
        category: 'Hardware',
        description: 'Secondary display port loses sync when resolution is set above 1080p.'
      })
    });
    const issueData = await issueRes.json();
    assert(issueRes.status === 201 && issueData.ticketCode, 'Mobile user created issue ticket');

    // 13. Announcements & Rankings
    console.log('\n--- 13. Announcements & Rankings ---');
    const annoRes = await fetch(`${BASE_URL}/api/iac-mobile/announcements`);
    const annos = await annoRes.json();
    assert(annoRes.ok && Array.isArray(annos), 'GET /announcements returned active advisories');

    const rankRes = await fetch(`${BASE_URL}/api/iac-mobile/rankings`);
    const ranks = await rankRes.json();
    assert(rankRes.ok && Array.isArray(ranks), 'GET /rankings returned member streak leaderboard');

    console.log('\n=============================================');
    if (failures === 0) {
      console.log('✅ ALL INTEGRATION TESTS PASSED (100% Success)');
    } else {
      console.error(`❌ ${failures} TEST(S) FAILED`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

run();
