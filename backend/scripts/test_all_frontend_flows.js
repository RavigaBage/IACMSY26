const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runAllTests() {
  console.log('===============================================================');
  console.log('🚀 TESTING EVERY FRONTEND COMPONENT CRUD FLOW AGAINST BACKEND');
  console.log('===============================================================');

  const report = [];

  function record(component, action, endpoint, method, payloadSent, status, response, error = null) {
    report.push({
      component,
      action,
      endpoint,
      method,
      payloadSent,
      status,
      response,
      error
    });
  }

  // 1. AUTH / LOGIN FLOW
  console.log('\n--- 1. Testing Login & Auth Flow (Login.tsx) ---');
  let token = null;
  try {
    const loginPayload = { identifier: 'admin@iac.com', password: 'Admin@1234' };
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload)
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, 'Login failed');
    token = data.access;
    assert(token, 'Access token missing in response');
    record('Login.tsx', 'Login', '/api/auth/login', 'POST', loginPayload, res.status, { status: data.status, user: data.user.email });
    console.log('  ✓ [Login.tsx] POST /api/auth/login -> 200 OK (Token received)');

    // Verify
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyRes.status, 200, 'Verify token failed');
    record('Login.tsx', 'Verify Session', '/api/auth/verify', 'GET', null, verifyRes.status, verifyData);
    console.log('  ✓ [Login.tsx] GET /api/auth/verify -> 200 OK');
  } catch (err) {
    record('Login.tsx', 'Login/Verify', '/api/auth/login', 'POST', null, 500, null, err.message);
    console.error('  ✗ [Login.tsx] Error:', err.message);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. LOUNGE FLOW (Lounge.tsx)
  console.log('\n--- 2. Testing Lounge Check-in CRUD (Lounge.tsx) ---');
  let createdLoungeId = null;
  try {
    // CREATE
    const createPayload = {
      full_name: 'Kwame Mensah',
      user_id: 'GHA-78901234-5',
      user_id_type: 'ghana_card',
      contact: '0241234567',
      gender: 'male',
      user_time_in: '2026-09-25T09:30',
      user_time_out: ''
    };
    const createRes = await fetch(`${BASE_URL}/api/users/submit-lounge-data`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(createPayload)
    });
    const createData = await createRes.json();
    assert.strictEqual(createRes.status, 200);
    createdLoungeId = createData.data._id;
    assert(createdLoungeId, 'Created lounge _id missing');
    record('Lounge.tsx', 'Create Check-in', '/api/users/submit-lounge-data', 'POST', createPayload, createRes.status, { id: createdLoungeId });
    console.log('  ✓ [Lounge.tsx] POST /api/users/submit-lounge-data -> Created ID:', createdLoungeId);

    // READ
    const readRes = await fetch(`${BASE_URL}/api/users/lounge-data?page=1&limit=20`, {
      headers: authHeaders
    });
    const readData = await readRes.json();
    assert.strictEqual(readRes.status, 200);
    record('Lounge.tsx', 'Read Check-ins', '/api/users/lounge-data', 'GET', null, readRes.status, { count: readData.data?.length });
    console.log('  ✓ [Lounge.tsx] GET /api/users/lounge-data -> Read', readData.data?.length, 'records');

    // UPDATE
    const updatePayload = {
      full_name: 'Kwame Mensah Updated',
      user_id: 'GHA-78901234-5',
      user_id_type: 'ghana_card',
      contact: '0249998877',
      gender: 'male',
      user_time_in: '2026-09-25T09:30',
      user_time_out: '2026-09-25T11:45'
    };
    const updateRes = await fetch(`${BASE_URL}/api/users/lounge-data/${createdLoungeId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify(updatePayload)
    });
    const updateData = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateData.data.name, 'Kwame Mensah Updated');
    record('Lounge.tsx', 'Update Check-in', `/api/users/lounge-data/${createdLoungeId}`, 'PATCH', updatePayload, updateRes.status, updateData.data);
    console.log('  ✓ [Lounge.tsx] PATCH /api/users/lounge-data/:id -> Updated Name:', updateData.data.name);

    // DELETE
    const deleteRes = await fetch(`${BASE_URL}/api/users/lounge/${createdLoungeId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    const deleteData = await deleteRes.json();
    assert.strictEqual(deleteRes.status, 200);
    record('Lounge.tsx', 'Delete Check-in', `/api/users/lounge/${createdLoungeId}`, 'DELETE', null, deleteRes.status, deleteData);
    console.log('  ✓ [Lounge.tsx] DELETE /api/users/lounge/:id -> Record deleted');
  } catch (err) {
    record('Lounge.tsx', 'Lounge CRUD', '/api/users/lounge', 'CRUD', null, 500, null, err.message);
    console.error('  ✗ [Lounge.tsx] Error:', err.message);
  }

  // 3. DEVICES FLOW (Devices.tsx)
  console.log('\n--- 3. Testing Devices Management CRUD & Commands (Devices.tsx) ---');
  let createdDeviceId = null;
  try {
    // CREATE
    const devicePayload = {
      deviceName: 'Lab-Station-Alpha',
      ipAddress: '10.0.0.55',
      operatingSystem: 'Windows 11 Pro',
      location: 'Room 1 (Conference Room)'
    };
    const createRes = await fetch(`${BASE_URL}/api/iac/devices/submit-devicStatus`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(devicePayload)
    });
    const createData = await createRes.json();
    assert.strictEqual(createRes.status, 200);
    createdDeviceId = createData.data._id;
    assert(createdDeviceId, 'Created device _id missing');
    record('Devices.tsx', 'Create Device', '/api/iac/devices/submit-devicStatus', 'POST', devicePayload, createRes.status, { id: createdDeviceId });
    console.log('  ✓ [Devices.tsx] POST /api/iac/devices/submit-devicStatus -> Device ID:', createdDeviceId);

    // READ
    const readRes = await fetch(`${BASE_URL}/api/iac/devices/devicStatus?page=1&limit=20`, {
      headers: authHeaders
    });
    const readData = await readRes.json();
    assert.strictEqual(readRes.status, 200);
    record('Devices.tsx', 'Read Devices', '/api/iac/devices/devicStatus', 'GET', null, readRes.status, { count: readData.data?.length });
    console.log('  ✓ [Devices.tsx] GET /api/iac/devices/devicStatus -> Read', readData.data?.length, 'devices');

    // UPDATE
    const updatePayload = {
      deviceName: 'Lab-Station-Alpha-Prime',
      operatingSystem: 'Ubuntu 24.04 LTS',
      location: 'Room 2 (Seminar Room)',
      ipAddress: '10.0.0.55'
    };
    const updateRes = await fetch(`${BASE_URL}/api/iac/devices/devicStatus/${createdDeviceId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify(updatePayload)
    });
    const updateData = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateData.data.deviceName, 'Lab-Station-Alpha-Prime');
    record('Devices.tsx', 'Update Device', `/api/iac/devices/devicStatus/${createdDeviceId}`, 'PATCH', updatePayload, updateRes.status, updateData.data);
    console.log('  ✓ [Devices.tsx] PATCH /api/iac/devices/devicStatus/:id -> Updated Device Name:', updateData.data.deviceName);

    // PING / STATUS COMMAND
    const pingPayload = { deviceIds: [createdDeviceId] };
    const pingRes = await fetch(`${BASE_URL}/api/iac/devices/device-Status`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(pingPayload)
    });
    const pingData = await pingRes.json();
    assert.strictEqual(pingRes.status, 200);
    record('Devices.tsx', 'Ping/Status Command', '/api/iac/devices/device-Status', 'POST', pingPayload, pingRes.status, pingData);
    console.log('  ✓ [Devices.tsx] POST /api/iac/devices/device-Status -> Dispatched status ping');

    // DELETE
    const deleteRes = await fetch(`${BASE_URL}/api/iac/devices/devicStatus/${createdDeviceId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    const deleteData = await deleteRes.json();
    assert.strictEqual(deleteRes.status, 200);
    record('Devices.tsx', 'Delete Device', `/api/iac/devices/devicStatus/${createdDeviceId}`, 'DELETE', null, deleteRes.status, deleteData);
    console.log('  ✓ [Devices.tsx] DELETE /api/iac/devices/devicStatus/:id -> Device soft-deleted');
  } catch (err) {
    record('Devices.tsx', 'Devices CRUD', '/api/iac/devices', 'CRUD', null, 500, null, err.message);
    console.error('  ✗ [Devices.tsx] Error:', err.message);
  }

  // 4. ROOMS / BOOKING FLOW (Rooms.tsx)
  console.log('\n--- 4. Testing Room Events & Bookings CRUD (Rooms.tsx) ---');
  let createdBookingId = null;
  try {
    // CREATE
    const bookingPayload = {
      date: '2026-10-20',
      endDate: '2026-10-20',
      roomType: 'conference',
      roomNumber: '1',
      organizer: 'Ghana Tech Hub',
      presenter: 'Kofi Mensah',
      programName: 'Intro to Cybersecurity',
      participants: 25,
      eventType: 'workshop',
      category: 'networking',
      beneficiaries: 'students',
      description: 'Hands-on network security',
      paymentStatus: 'Unpaid'
    };
    const createRes = await fetch(`${BASE_URL}/api/bookings/submit-event-program`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(bookingPayload)
    });
    const createData = await createRes.json();
    assert.strictEqual(createRes.status, 201);
    createdBookingId = createData.data[0]._id;
    assert(createdBookingId, 'Created booking _id missing');
    record('Rooms.tsx', 'Create Booking', '/api/bookings/submit-event-program', 'POST', bookingPayload, createRes.status, { id: createdBookingId });
    console.log('  ✓ [Rooms.tsx] POST /api/bookings/submit-event-program -> Booking ID:', createdBookingId);

    // READ
    const readRes = await fetch(`${BASE_URL}/api/bookings/event-program?limit=500`, {
      headers: authHeaders
    });
    const readData = await readRes.json();
    assert.strictEqual(readRes.status, 200);
    record('Rooms.tsx', 'Read Bookings', '/api/bookings/event-program', 'GET', null, readRes.status, { count: readData.data?.length });
    console.log('  ✓ [Rooms.tsx] GET /api/bookings/event-program -> Read', readData.data?.length, 'bookings');

    // UPDATE
    const updatePayload = {
      programName: 'Advanced Cybersecurity Masterclass',
      participants: 35,
      paymentStatus: 'Paid'
    };
    const updateRes = await fetch(`${BASE_URL}/api/bookings/event-program/${createdBookingId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify(updatePayload)
    });
    const updateData = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateData.data.paymentStatus, 'Paid');
    record('Rooms.tsx', 'Update Booking', `/api/bookings/event-program/${createdBookingId}`, 'PATCH', updatePayload, updateRes.status, updateData.data);
    console.log('  ✓ [Rooms.tsx] PATCH /api/bookings/event-program/:id -> Updated Payment:', updateData.data.paymentStatus);

    // DELETE
    const deleteRes = await fetch(`${BASE_URL}/api/bookings/event-program/${createdBookingId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    const deleteData = await deleteRes.json();
    assert.strictEqual(deleteRes.status, 200);
    record('Rooms.tsx', 'Delete Booking', `/api/bookings/event-program/${createdBookingId}`, 'DELETE', null, deleteRes.status, deleteData);
    console.log('  ✓ [Rooms.tsx] DELETE /api/bookings/event-program/:id -> Booking deleted');
  } catch (err) {
    record('Rooms.tsx', 'Rooms CRUD', '/api/bookings', 'CRUD', null, 500, null, err.message);
    console.error('  ✗ [Rooms.tsx] Error:', err.message);
  }

  // 5. ATTENDANCE QR (AttendanceQR.tsx) & PUBLIC ATTENDANCE FORM (AttendanceForm.tsx)
  console.log('\n--- 5. Testing Attendance QR & Public Attendance Form ---');
  let createdQRId = null;
  let qrToken = null;
  try {
    // CREATE QR
    const qrPayload = {
      label: 'Afternoon Coding Workshop',
      durationValue: '2',
      durationUnit: 'hours'
    };
    const createRes = await fetch(`${BASE_URL}/api/qrcodes/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(qrPayload)
    });
    const createData = await createRes.json();
    assert.strictEqual(createRes.status, 201);
    createdQRId = createData.data._id;
    qrToken = createData.data.token;
    assert(createdQRId && qrToken, 'QR data incomplete');
    record('AttendanceQR.tsx', 'Generate QR', '/api/qrcodes/generate', 'POST', qrPayload, createRes.status, { id: createdQRId, token: qrToken });
    console.log('  ✓ [AttendanceQR.tsx] POST /api/qrcodes/generate -> Token:', qrToken);

    // READ ACTIVE QR
    const activeRes = await fetch(`${BASE_URL}/api/qrcodes/active`, { headers: authHeaders });
    const activeData = await activeRes.json();
    assert.strictEqual(activeRes.status, 200);
    record('AttendanceQR.tsx', 'Get Active QR', '/api/qrcodes/active', 'GET', null, activeRes.status, { label: activeData.data?.label });
    console.log('  ✓ [AttendanceQR.tsx] GET /api/qrcodes/active -> Active Label:', activeData.data?.label);

    // VALIDATE PUBLIC TOKEN (AttendanceForm.tsx)
    const valRes = await fetch(`${BASE_URL}/api/public/qrcodes/validate/${qrToken}`);
    const valData = await valRes.json();
    assert.strictEqual(valRes.status, 200);
    assert(valData.success);
    record('AttendanceForm.tsx', 'Validate QR Token', `/api/public/qrcodes/validate/${qrToken}`, 'GET', null, valRes.status, valData.data);
    console.log('  ✓ [AttendanceForm.tsx] GET /api/public/qrcodes/validate/:token -> Validated:', valData.data.label);

    // SUBMIT ATTENDANCE (AttendanceForm.tsx)
    const attendancePayload = {
      fullName: 'Ama Serwaa',
      idNumber: 'STU-445566',
      idType: 'student_id',
      gender: 'female',
      contact: '0209876543',
      timeIn: '14:00',
      timeOut: ''
    };
    const submitRes = await fetch(`${BASE_URL}/api/public/qrcodes/${qrToken}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendancePayload)
    });
    const submitData = await submitRes.json();
    assert.strictEqual(submitRes.status, 201);
    record('AttendanceForm.tsx', 'Submit Attendance', `/api/public/qrcodes/${qrToken}/submit`, 'POST', attendancePayload, submitRes.status, submitData.data);
    console.log('  ✓ [AttendanceForm.tsx] POST /api/public/qrcodes/:token/submit -> Attendance created');

    // DEACTIVATE QR (AttendanceQR.tsx)
    const deactRes = await fetch(`${BASE_URL}/api/qrcodes/${createdQRId}/deactivate`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({})
    });
    const deactData = await deactRes.json();
    assert.strictEqual(deactRes.status, 200);
    record('AttendanceQR.tsx', 'Deactivate QR', `/api/qrcodes/${createdQRId}/deactivate`, 'PATCH', {}, deactRes.status, deactData.data);
    console.log('  ✓ [AttendanceQR.tsx] PATCH /api/qrcodes/:id/deactivate -> Status:', deactData.data.status);

    // REGENERATE QR (AttendanceQR.tsx)
    const regenPayload = { durationValue: '3', durationUnit: 'hours' };
    const regenRes = await fetch(`${BASE_URL}/api/qrcodes/${createdQRId}/regenerate`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify(regenPayload)
    });
    const regenData = await regenRes.json();
    assert.strictEqual(regenRes.status, 200);
    record('AttendanceQR.tsx', 'Regenerate QR', `/api/qrcodes/${createdQRId}/regenerate`, 'PATCH', regenPayload, regenRes.status, regenData.data);
    console.log('  ✓ [AttendanceQR.tsx] PATCH /api/qrcodes/:id/regenerate -> New Token:', regenData.data.token);

    // DELETE QR (AttendanceQR.tsx)
    const delQRRes = await fetch(`${BASE_URL}/api/qrcodes/${createdQRId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert.strictEqual(delQRRes.status, 200);
    record('AttendanceQR.tsx', 'Delete QR', `/api/qrcodes/${createdQRId}`, 'DELETE', null, delQRRes.status, { success: true });
    console.log('  ✓ [AttendanceQR.tsx] DELETE /api/qrcodes/:id -> QR deleted');
  } catch (err) {
    record('AttendanceQR.tsx', 'QR Operations', '/api/qrcodes', 'CRUD', null, 500, null, err.message);
    console.error('  ✗ [AttendanceQR/Form] Error:', err.message);
  }

  // 6. REPORTS FLOW (Reports.tsx)
  console.log('\n--- 6. Testing Reports Generation & Management (Reports.tsx) ---');
  let createdReportId = null;
  try {
    // GENERATE MONTHLY REPORT
    const genPayload = { month: 9, year: 2026, reportType: 'all' };
    const genRes = await fetch(`${BASE_URL}/api/reports/generate/monthly`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(genPayload)
    });
    const genData = await genRes.json();
    assert.strictEqual(genRes.status, 201);
    createdReportId = genData.data._id;
    assert(createdReportId, 'Report ID missing');
    record('Reports.tsx', 'Generate Report', '/api/reports/generate/monthly', 'POST', genPayload, genRes.status, { id: createdReportId, title: genData.data.title });
    console.log('  ✓ [Reports.tsx] POST /api/reports/generate/monthly -> Report ID:', createdReportId);

    // READ REPORTS
    const listRes = await fetch(`${BASE_URL}/api/reports`, { headers: authHeaders });
    const listData = await listRes.json();
    assert.strictEqual(listRes.status, 200);
    record('Reports.tsx', 'Read Reports', '/api/reports', 'GET', null, listRes.status, { count: listData.data?.length });
    console.log('  ✓ [Reports.tsx] GET /api/reports -> Found', listData.data?.length, 'reports');

    // SUMMARY (Home.tsx & Reports.tsx)
    const sumRes = await fetch(`${BASE_URL}/api/reports/summary`, { headers: authHeaders });
    const sumData = await sumRes.json();
    assert.strictEqual(sumRes.status, 200);
    record('Reports.tsx/Home.tsx', 'Get Summary', '/api/reports/summary', 'GET', null, sumRes.status, sumData.data);
    console.log('  ✓ [Reports.tsx/Home.tsx] GET /api/reports/summary -> Summary loaded');

    // DELETE REPORT
    const delRepRes = await fetch(`${BASE_URL}/api/reports/${createdReportId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    const delRepData = await delRepRes.json();
    assert.strictEqual(delRepRes.status, 200);
    record('Reports.tsx', 'Delete Report', `/api/reports/${createdReportId}`, 'DELETE', null, delRepRes.status, delRepData);
    console.log('  ✓ [Reports.tsx] DELETE /api/reports/:id -> Report deleted');
  } catch (err) {
    record('Reports.tsx', 'Reports Operations', '/api/reports', 'CRUD', null, 500, null, err.message);
    console.error('  ✗ [Reports.tsx] Error:', err.message);
  }

  // 7. IAC MOBILE MANAGEMENT & SIMULATOR FLOW (IacMobile.tsx)
  console.log('\n--- 7. Testing IAC Mobile Features (IacMobile.tsx) ---');
  try {
    // 7A: CHECK-IN TICKETS
    const simUserId = 'user-sim-' + Date.now();
    const ticketPayload = {
      mobileUserId: simUserId,
      mobileUserName: 'Mobile Student User',
      mobileUserEmail: 'student@example.com'
    };
    const ticketRes = await fetch(`${BASE_URL}/api/iac-mobile/checkin-tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketPayload)
    });
    const ticketData = await ticketRes.json();
    assert.strictEqual(ticketRes.status, 201);
    const ticketId = ticketData._id;
    record('IacMobile.tsx', 'Request Check-in Ticket', '/api/iac-mobile/checkin-tickets', 'POST', ticketPayload, ticketRes.status, { id: ticketId, code: ticketData.ticketCode });
    console.log('  ✓ [IacMobile.tsx] POST /api/iac-mobile/checkin-tickets -> Code:', ticketData.ticketCode);

    // CONFIRM TICKET
    const confirmTicketRes = await fetch(`${BASE_URL}/api/iac-mobile/checkin-tickets/${ticketId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffName: 'Admin Desk Staff' })
    });
    const confirmTicketData = await confirmTicketRes.json();
    assert.strictEqual(confirmTicketRes.status, 200);
    record('IacMobile.tsx', 'Confirm Check-in Ticket', `/api/iac-mobile/checkin-tickets/${ticketId}/confirm`, 'POST', { staffName: 'Admin Desk Staff' }, confirmTicketRes.status, confirmTicketData);
    console.log('  ✓ [IacMobile.tsx] POST /api/iac-mobile/checkin-tickets/:id/confirm -> Confirmed & added to Lounge');

    // 7B: BOOKING REQUESTS
    const bookingReqPayload = {
      mobileUserId: simUserId,
      mobileUserName: 'Mobile Student User',
      contactEmail: 'student@example.com',
      roomNumber: '3',
      requestedDate: new Date(Date.now() + 86400000 * 40).toISOString().split('T')[0],
      requestedSlot: '10:00 - 12:00',
      programName: 'Study Group Session'
    };
    const bookingReqRes = await fetch(`${BASE_URL}/api/iac-mobile/booking-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingReqPayload)
    });
    const bookingReqData = await bookingReqRes.json();
    assert.strictEqual(bookingReqRes.status, 201);
    const bookingReqId = bookingReqData._id;
    record('IacMobile.tsx', 'Submit Mobile Booking', '/api/iac-mobile/booking-requests', 'POST', bookingReqPayload, bookingReqRes.status, { id: bookingReqId });
    console.log('  ✓ [IacMobile.tsx] POST /api/iac-mobile/booking-requests -> Submitted Request ID:', bookingReqId);

    // CONFIRM BOOKING REQUEST
    const confirmBookingRes = await fetch(`${BASE_URL}/api/iac-mobile/booking-requests/${bookingReqId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const confirmBookingData = await confirmBookingRes.json();
    assert.strictEqual(confirmBookingRes.status, 200);
    record('IacMobile.tsx', 'Confirm Booking Request', `/api/iac-mobile/booking-requests/${bookingReqId}/confirm`, 'POST', null, confirmBookingRes.status, confirmBookingData);
    console.log('  ✓ [IacMobile.tsx] POST /api/iac-mobile/booking-requests/:id/confirm -> Confirmed');

    // 7C: ANNOUNCEMENTS (CRUD)
    const annoPayload = {
      title: 'Facility Maintenance Notice',
      description: 'The seminar room will undergo network upgrades this Saturday.',
      badgeText: 'NOTICE',
      badgeColor: 'amber'
    };
    const annoCreateRes = await fetch(`${BASE_URL}/api/iac-mobile/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annoPayload)
    });
    const annoCreateData = await annoCreateRes.json();
    assert.strictEqual(annoCreateRes.status, 201);
    const annoId = annoCreateData._id;
    record('IacMobile.tsx', 'Create Announcement', '/api/iac-mobile/announcements', 'POST', annoPayload, annoCreateRes.status, { id: annoId });
    console.log('  ✓ [IacMobile.tsx] POST /api/iac-mobile/announcements -> Announcement ID:', annoId);

    // UPDATE ANNOUNCEMENT
    const annoUpdatePayload = {
      title: 'Facility Maintenance Notice - Rescheduled',
      description: 'Upgrades have been rescheduled to Sunday 6 PM.',
      badgeText: 'UPDATE',
      badgeColor: 'blue'
    };
    const annoUpdateRes = await fetch(`${BASE_URL}/api/iac-mobile/announcements/${annoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annoUpdatePayload)
    });
    const annoUpdateData = await annoUpdateRes.json();
    assert.strictEqual(annoUpdateRes.status, 200);
    record('IacMobile.tsx', 'Update Announcement', `/api/iac-mobile/announcements/${annoId}`, 'PUT', annoUpdatePayload, annoUpdateRes.status, annoUpdateData);
    console.log('  ✓ [IacMobile.tsx] PUT /api/iac-mobile/announcements/:id -> Updated Announcement');

    // DELETE ANNOUNCEMENT
    const annoDelRes = await fetch(`${BASE_URL}/api/iac-mobile/announcements/${annoId}`, {
      method: 'DELETE'
    });
    assert.strictEqual(annoDelRes.status, 200);
    record('IacMobile.tsx', 'Delete Announcement', `/api/iac-mobile/announcements/${annoId}`, 'DELETE', null, annoDelRes.status, { success: true });
    console.log('  ✓ [IacMobile.tsx] DELETE /api/iac-mobile/announcements/:id -> Deleted Announcement');

    // 7D: ISSUES & COMMUNITY BOARD (CRUD)
    const issuePayload = {
      reporterId: 'user-sim-101',
      reporterName: 'Mobile Student User',
      category: 'hardware',
      description: 'Monitor on Station 4 has flickering display.'
    };
    const issueCreateRes = await fetch(`${BASE_URL}/api/iac-mobile/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issuePayload)
    });
    const issueCreateData = await issueCreateRes.json();
    assert.strictEqual(issueCreateRes.status, 201);
    const issueId = issueCreateData._id;
    record('IacMobile.tsx', 'Create Community Issue', '/api/iac-mobile/issues', 'POST', issuePayload, issueCreateRes.status, { id: issueId });
    console.log('  ✓ [IacMobile.tsx] POST /api/iac-mobile/issues -> Issue ID:', issueId);

    // VOTE ISSUE (must happen while issue is pending/unresolved)
    const votePayload = { mobileUserId: 'user-sim-102', direction: 'up' };
    const voteRes = await fetch(`${BASE_URL}/api/iac-mobile/issues/${issueId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(votePayload)
    });
    const voteData = await voteRes.json();
    assert.strictEqual(voteRes.status, 200);
    record('IacMobile.tsx', 'Upvote Issue', `/api/iac-mobile/issues/${issueId}/vote`, 'POST', votePayload, voteRes.status, voteData);
    console.log('  ✓ [IacMobile.tsx] POST /api/iac-mobile/issues/:id/vote -> Upvotes:', voteData.upvotesCount !== undefined ? voteData.upvotesCount : voteData.upvotes);

    // UPDATE ISSUE STATUS
    const issueStatusPayload = { status: 'resolved' };
    const issueStatusRes = await fetch(`${BASE_URL}/api/iac-mobile/issues/${issueId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issueStatusPayload)
    });
    const issueStatusData = await issueStatusRes.json();
    assert.strictEqual(issueStatusRes.status, 200);
    assert.strictEqual(issueStatusData.status, 'resolved');
    record('IacMobile.tsx', 'Update Issue Status', `/api/iac-mobile/issues/${issueId}/status`, 'PATCH', issueStatusPayload, issueStatusRes.status, issueStatusData);
    console.log('  ✓ [IacMobile.tsx] PATCH /api/iac-mobile/issues/:id/status -> Status:', issueStatusData.status);

    // 7E: SMTP CONFIGURATION
    const smtpPayload = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: 'iac.notifications@gmail.com',
      fromEmail: 'iac.notifications@gmail.com',
      fromName: 'IAC Operations System'
    };
    const smtpSaveRes = await fetch(`${BASE_URL}/api/iac-mobile/smtp-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(smtpPayload)
    });
    const smtpSaveData = await smtpSaveRes.json();
    assert.strictEqual(smtpSaveRes.status, 200);
    record('IacMobile.tsx', 'Save SMTP Config', '/api/iac-mobile/smtp-config', 'POST', smtpPayload, smtpSaveRes.status, smtpSaveData);
    console.log('  ✓ [IacMobile.tsx] POST /api/iac-mobile/smtp-config -> Saved');

    const smtpGetRes = await fetch(`${BASE_URL}/api/iac-mobile/smtp-config`);
    const smtpGetData = await smtpGetRes.json();
    assert.strictEqual(smtpGetRes.status, 200);
    assert.strictEqual(smtpGetData.host, 'smtp.gmail.com');
    record('IacMobile.tsx', 'Get SMTP Config', '/api/iac-mobile/smtp-config', 'GET', null, smtpGetRes.status, smtpGetData);
    console.log('  ✓ [IacMobile.tsx] GET /api/iac-mobile/smtp-config -> Config Verified');

  } catch (err) {
    record('IacMobile.tsx', 'Mobile Features', '/api/iac-mobile', 'CRUD', null, 500, null, err.message);
    console.error('  ✗ [IacMobile.tsx] Error:', err.message);
  }

  console.log('\n===============================================================');
  console.log('📊 FINAL TEST RESULTS MATRIX');
  console.log('===============================================================');
  let passCount = 0;
  let failCount = 0;
  for (const item of report) {
    if (item.error || item.status >= 400) {
      failCount++;
      console.log(`❌ [FAIL] ${item.component.padEnd(20)} | ${item.action.padEnd(25)} | ${item.method} ${item.endpoint} -> Status ${item.status} (Error: ${item.error})`);
    } else {
      passCount++;
      console.log(`✅ [PASS] ${item.component.padEnd(20)} | ${item.action.padEnd(25)} | ${item.method} ${item.endpoint} -> Status ${item.status}`);
    }
  }

  console.log('\n===============================================================');
  console.log(`Summary: ${passCount} Passed, ${failCount} Failed out of ${report.length} total operations.`);
  console.log('===============================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
