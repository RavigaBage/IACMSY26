/**
 * IAC Mobile Application Logic
 * Integrates with Backend: /api/iac-mobile/...
 * White & Yellow Theme Architecture
 */

// Global State
const APP_STATE = {
  activeTab: 'home',
  user: {
    id: localStorage.getItem('iac_mobile_user_id') || 'iac_usr_alex_vance',
    name: localStorage.getItem('iac_mobile_user_name') || 'Alex Vance',
    email: localStorage.getItem('iac_mobile_user_email') || 'alex.vance@mit.edu',
    phone: localStorage.getItem('iac_mobile_user_phone') || '+1 555-0192',
    idNum: localStorage.getItem('iac_mobile_user_id_num') || 'IAC-USR-88402',
    streak: parseInt(localStorage.getItem('iac_mobile_user_streak') || '7', 10),
  },
  activeTicket: null,
  activeTicketTimer: null,
  bookings: [],
  bookingFilter: 'upcoming',
  issues: [],
  issueFilter: 'all',
  currentCategory: 'Hardware',
  evidenceAttachment: null,
  campus: 'MAIN LOUNGE CAMPUS',
};

// Check Auth & Redirect to login if missing
function checkAuth() {
  const token = localStorage.getItem('iac_mobile_access_token');
  if (!token) {
    // If running in development or demo mode, auto-fill demo credentials
    localStorage.setItem('iac_mobile_access_token', 'demo_token_alex_vance');
    localStorage.setItem('iac_mobile_user_id', 'iac_usr_alex_vance');
    localStorage.setItem('iac_mobile_user_name', 'Alex Vance');
    localStorage.setItem('iac_mobile_user_email', 'alex.vance@mit.edu');
    localStorage.setItem('iac_mobile_user_id_num', 'IAC-USR-88402');
    localStorage.setItem('iac_mobile_user_streak', '7');
  }
}

// Authenticated fetch wrapper with safe JSON parsing
async function apiFetch(url, options = {}) {
  let token = localStorage.getItem('iac_mobile_access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  try {
    let res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      const refreshToken = localStorage.getItem('iac_mobile_refresh_token');
      if (refreshToken) {
        try {
          const refRes = await fetch('/api/iac-mobile/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          if (refRes.ok) {
            const data = await refRes.json();
            localStorage.setItem('iac_mobile_access_token', data.accessToken);
            headers['Authorization'] = `Bearer ${data.accessToken}`;
            res = await fetch(url, { ...options, headers });
          }
        } catch (e) {}
      }
    }

    // Safely wrap .json() so unexpected HTML or non-JSON never throws SyntaxError
    if (res && typeof res.json === 'function') {
      const originalJson = res.json.bind(res);
      res.json = async () => {
        try {
          return await originalJson();
        } catch (jsonErr) {
          console.warn(`[API] Non-JSON payload returned for ${url}`);
          return { status: 'error', error: 'Unexpected response format from server' };
        }
      };
    }
    return res;
  } catch (err) {
    console.warn('Network request failed, returning mock fallback if needed:', err);
    return {
      ok: false,
      status: 0,
      json: async () => ({ status: 'error', error: err.message || 'Network error' })
    };
  }
}

// -------------------------------------------------------------
// NAVIGATION & TABS
// -------------------------------------------------------------
const TAB_TITLES = {
  home: 'Home',
  checkin: 'Digital Pass & QR',
  bookings: 'Room & Station Bookings',
  issues: 'Hardware & Facility Help',
  profile: 'Profile'
};

function switchTab(tabId) {
  APP_STATE.activeTab = tabId;

  // Update title
  document.getElementById('screenTitle').textContent = TAB_TITLES[tabId] || 'IAC Mobile';

  // Toggle views
  document.querySelectorAll('.screen-view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) targetView.classList.add('active');

  // Toggle nav buttons
  document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
  const targetNav = document.getElementById(`tabNav${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  if (targetNav) targetNav.classList.add('active');

  // Scroll to top
  const contentArea = document.getElementById('contentArea');
  if (contentArea) contentArea.scrollTop = 0;

  // Refresh tab-specific data
  if (tabId === 'bookings') fetchBookings();
  if (tabId === 'issues') fetchIssues();
}

// -------------------------------------------------------------
// CHECK-IN & PASS MANAGEMENT
// -------------------------------------------------------------
async function fetchActiveCheckinTicket() {
  try {
    const res = await apiFetch(`/api/iac-mobile/checkin-tickets?mobileUserId=${APP_STATE.user.id}`);
    if (res.ok) {
      const tickets = await res.json();
      const active = tickets.find(t => t.status === 'confirmed' || t.status === 'pending');
      APP_STATE.activeTicket = active || null;
      renderCheckinUI();
    }
  } catch (e) {
    renderCheckinUI();
  }
}

function renderCheckinUI() {
  const isCheckedIn = !!APP_STATE.activeTicket;
  const navBadge = document.getElementById('navCheckinBadge');
  if (navBadge) navBadge.style.display = isCheckedIn ? 'block' : 'none';

  // Home card representation
  const homeCard = document.getElementById('homeAccessPassCard');
  const homeStatusPill = document.getElementById('homePassStatusPill');
  const homeStatusText = document.getElementById('homePassStatusText');
  const homeSessionCode = document.getElementById('homeSessionCode');
  const homePassTitle = document.getElementById('homePassTitle');
  const homePassSubtitle = document.getElementById('homePassSubtitle');
  const homePassBtnText = document.getElementById('homePassBtnText');
  const homeProgressWrap = document.getElementById('homeProgressWrap');

  if (isCheckedIn) {
    const t = APP_STATE.activeTicket;
    homeStatusPill.className = 'status-pill active-pill';
    homeStatusText.textContent = t.status === 'confirmed' ? 'ACTIVE CHECK-IN' : 'PENDING TRIAGE';
    homeSessionCode.textContent = `SESSION #${t.ticketCode || 'IAC-8894'}`;
    homePassTitle.textContent = 'Current Access Pass';
    homePassSubtitle.textContent = `Checked into Main Lounge at ${formatTime(t.requestedAt || new Date())}`;
    homePassBtnText.textContent = 'View Digital Pass & QR';
    homeProgressWrap.style.display = 'block';

    // Pass Screen Elements
    document.getElementById('passCodeLarge').textContent = t.ticketCode || 'IAC-8894';
    document.getElementById('passCheckedInAt').textContent = `Today, ${formatTime(t.requestedAt || new Date())}`;
    document.getElementById('ticketStatusBadge').textContent = 'ACTIVE TICKET';
    document.getElementById('btnToggleCheckin').textContent = 'Check Out of Lounge';
    document.getElementById('btnToggleCheckin').className = 'btn btn-danger-soft w-full';
  } else {
    homeStatusPill.className = 'status-pill';
    homeStatusText.textContent = 'NOT CHECKED IN';
    homeSessionCode.textContent = 'IAC ACCESS PORTAL';
    homePassTitle.textContent = 'Internet Lounge Pass';
    homePassSubtitle.textContent = 'High-speed workstation access & quiet focus labs.';
    homePassBtnText.textContent = 'Check In to Lounge';
    homeProgressWrap.style.display = 'none';

    // Pass Screen Elements
    document.getElementById('passCodeLarge').textContent = '○ INACTIVE';
    document.getElementById('passCheckedInAt').textContent = 'Not Checked In';
    document.getElementById('ticketStatusBadge').textContent = 'READY TO ENTER';
    document.getElementById('btnToggleCheckin').textContent = 'Check In to Lounge';
    document.getElementById('btnToggleCheckin').className = 'btn btn-yellow w-full';
  }
}

function handleHomePassClick() {
  if (APP_STATE.activeTicket) {
    switchTab('checkin');
  } else {
    toggleLoungeAccess();
  }
}

async function toggleLoungeAccess() {
  if (APP_STATE.activeTicket) {
    // Check out
    const ticketId = APP_STATE.activeTicket._id;
    try {
      await apiFetch(`/api/iac-mobile/checkin-tickets/${ticketId}/checkout`, { method: 'POST' });
    } catch (e) {}
    APP_STATE.activeTicket = null;
    showToast('Checked out of Internet Lounge');
  } else {
    // Check in request
    try {
      const res = await apiFetch('/api/iac-mobile/checkin-tickets/request', {
        method: 'POST',
        body: JSON.stringify({
          mobileUserId: APP_STATE.user.id,
          mobileUserName: APP_STATE.user.name,
          mobileUserEmail: APP_STATE.user.email,
        })
      });
      if (res.ok) {
        const data = await res.json();
        APP_STATE.activeTicket = data.ticket || {
          _id: 'mock_' + Date.now(),
          ticketCode: 'IAC-' + Math.floor(1000 + Math.random() * 9000),
          status: 'confirmed',
          requestedAt: new Date().toISOString()
        };
        // Auto confirm for demo instant responsiveness
        if (APP_STATE.activeTicket._id && !APP_STATE.activeTicket._id.startsWith('mock')) {
          await apiFetch(`/api/iac-mobile/checkin-tickets/${APP_STATE.activeTicket._id}/confirm`, {
            method: 'POST',
            body: JSON.stringify({ staffName: 'Self Kiosk / NFC' })
          });
          APP_STATE.activeTicket.status = 'confirmed';
        }
      }
    } catch (e) {
      APP_STATE.activeTicket = {
        _id: 'mock_pass',
        ticketCode: 'IAC-8894',
        status: 'confirmed',
        requestedAt: new Date().toISOString()
      };
    }
    showToast('Checked into Internet Lounge! Session #IAC-8894 started.');
  }
  renderCheckinUI();
}

function simulateNfcTap() {
  showToast('NFC Badge #441-A89F verified on Desk Beacon!');
  if (!APP_STATE.activeTicket) {
    toggleLoungeAccess();
  }
}

// -------------------------------------------------------------
// BOOKINGS WORKFLOW (TWO-STAGE)
// -------------------------------------------------------------
async function fetchBookings() {
  const container = document.getElementById('bookingsListContainer');
  container.innerHTML = '<div class="text-center p-4 text-muted">Loading room reservations...</div>';

  try {
    const res = await apiFetch(`/api/iac-mobile/booking-requests?mobileUserId=${APP_STATE.user.id}`);
    if (res.ok) {
      APP_STATE.bookings = await res.json();
    }
  } catch (e) {
    console.warn('Booking fetch fallback:', e);
  }

  renderBookingsList();
}

function filterBookingsTab(tab) {
  APP_STATE.bookingFilter = tab;
  document.querySelectorAll('.segment-tab').forEach(t => t.classList.remove('active'));
  const btn = document.getElementById(`tabBooking${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  if (btn) btn.classList.add('active');
  renderBookingsList();
}

function renderBookingsList() {
  const container = document.getElementById('bookingsListContainer');
  const now = new Date();

  let list = APP_STATE.bookings || [];

  if (APP_STATE.bookingFilter === 'upcoming') {
    list = list.filter(b => b.status === 'confirmed' || b.status === 'pending');
  } else if (APP_STATE.bookingFilter === 'previous') {
    list = list.filter(b => b.status === 'completed' || b.status === 'rejected' || b.status === 'cancelled');
  } else if (APP_STATE.bookingFilter === 'drafts') {
    list = [];
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="text-center p-6 bg-white rounded-2xl border border-slate-200">
        <p class="text-sm font-bold text-slate-700 m-0">No ${APP_STATE.bookingFilter} reservations found</p>
        <p class="text-xs text-muted mt-1">Tap "+ Request" to submit a new workstation or room permit.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(b => {
    const status = (b.status || 'pending').toLowerCase();
    const isApprovedAwaitingStage2 = status === 'confirmed' && !b.eventDetailsSubmitted;
    const isConfirmedFinal = status === 'confirmed' && b.eventDetailsSubmitted;
    const isPending = status === 'pending';

    let badgeClass = 'status-badge-pending';
    let statusLabel = 'PENDING';
    if (isConfirmedFinal) {
      badgeClass = 'status-badge-confirmed';
      statusLabel = 'CONFIRMED';
    } else if (isApprovedAwaitingStage2) {
      badgeClass = 'status-badge-approved';
      statusLabel = 'APPROVED • COMPLETE FORM';
    } else if (status === 'rejected') {
      badgeClass = 'status-pill';
      statusLabel = 'REJECTED';
    }

    const dateStr = b.requestedDate ? new Date(b.requestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today';

    return `
      <div class="booking-item-card">
        <div class="bcard-top">
          <div class="bcard-room-info">
            <div class="room-type-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div>
              <h4 class="bcard-title">Room ${b.roomNumber} ${b.roomType || 'Facility'}</h4>
              <span class="bcard-specs">${b.programName || 'Research & Computing'}</span>
            </div>
          </div>
          <span class="${badgeClass}">${statusLabel}</span>
        </div>

        <div class="bcard-divider"></div>

        <div class="bcard-slot-grid">
          <div>
            <span class="slot-heading">RESERVED SLOT</span>
            <div class="slot-detail-primary">${dateStr}</div>
            <div class="slot-detail-sub">${b.requestedSlot || b.arrivalTime || '14:00 - 18:00'}</div>
          </div>
          <div>
            <span class="slot-heading">PHYSICAL ACCESS</span>
            <div class="slot-detail-primary text-yellow-dark">${isConfirmedFinal ? 'RFID Ready' : (isPending ? 'Pending Review' : 'Action Required')}</div>
            <div class="slot-detail-sub">Tag #441 Assigned</div>
          </div>
        </div>

        ${isPending ? `
          <div class="awaiting-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Awaiting approval from Facilities Desk (Usually &lt; 30m)</span>
          </div>
        ` : ''}

        <div class="bcard-btn-row">
          ${isApprovedAwaitingStage2 ? `
            <button class="btn btn-yellow flex-1" onclick="openEventDetailsModal('${b._id}')">
              Complete Event Details
            </button>
          ` : isConfirmedFinal ? `
            <button class="btn btn-yellow flex-1" onclick="switchTab('checkin')">
              View Check-in Pass
            </button>
            <button class="btn btn-secondary flex-1" onclick="openBookingDetailModal('${b._id}')">
              Modify
            </button>
          ` : `
            <button class="btn btn-secondary flex-1" onclick="openBookingDetailModal('${b._id}')">
              Update Details
            </button>
            <button class="btn btn-danger-soft" onclick="cancelBooking('${b._id}')">
              Cancel
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// Stage 1: New Booking Request
function openNewBookingModal() {
  document.getElementById('bReqDate').value = new Date().toISOString().split('T')[0];
  openModal('newBookingModal');
}

async function handleNewBookingSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitBookingReq');
  btn.disabled = true;
  btn.textContent = 'Submitting Request...';

  const roomVal = document.getElementById('bReqRoom').value.split('|');
  const roomNum = roomVal[0];
  const roomType = roomVal[1];
  const dateVal = document.getElementById('bReqDate').value;
  const timeVal = document.getElementById('bReqTime').value;
  const programVal = document.getElementById('bReqProgram').value.trim();
  const notesVal = document.getElementById('bReqNotes').value.trim();

  try {
    const res = await apiFetch('/api/iac-mobile/booking-requests', {
      method: 'POST',
      body: JSON.stringify({
        mobileUserId: APP_STATE.user.id,
        mobileUserName: APP_STATE.user.name,
        contactEmail: APP_STATE.user.email,
        roomNumber: roomNum,
        roomType: roomType,
        requestedDate: dateVal,
        arrivalTime: timeVal,
        requestedSlot: `${timeVal} - 18:00 (4 hrs)`,
        programName: programVal,
        description: notesVal,
      })
    });

    if (res.ok) {
      showToast('Booking request submitted! Facilities desk notified.');
      closeModal('newBookingModal');
      await fetchBookings();
      switchTab('bookings');
    }
  } catch (err) {
    showToast('Failed to submit booking request.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Booking Request';
  }
}

// Stage 2: Event Details Form (For Approved Requests)
function openEventDetailsModal(bookingId) {
  const b = APP_STATE.bookings.find(item => item._id === bookingId);
  if (!b) return;

  document.getElementById('eventBookingId').value = bookingId;
  document.getElementById('evProgramName').value = b.programName || '';
  document.getElementById('evStartDate').value = b.requestedDate ? new Date(b.requestedDate).toISOString().split('T')[0] : '';
  document.getElementById('evEndDate').value = b.requestedDate ? new Date(b.requestedDate).toISOString().split('T')[0] : '';
  document.getElementById('evOrganizer').value = APP_STATE.user.name;
  document.getElementById('evPresenter').value = APP_STATE.user.name;
  document.getElementById('evDescription').value = b.description || '';

  openModal('eventDetailsModal');
}

async function handleEventDetailsSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitEventDetails');
  btn.disabled = true;
  btn.textContent = 'Finalizing Record...';

  const bookingId = document.getElementById('eventBookingId').value;
  const payload = {
    programName: document.getElementById('evProgramName').value,
    eventType: document.getElementById('evEventType').value,
    category: document.getElementById('evCategory').value,
    startDate: document.getElementById('evStartDate').value,
    endDate: document.getElementById('evEndDate').value,
    organizer: document.getElementById('evOrganizer').value,
    presenter: document.getElementById('evPresenter').value,
    participants: parseInt(document.getElementById('evParticipants').value, 10),
    beneficiaries: document.getElementById('evBeneficiaries').value,
    description: document.getElementById('evDescription').value,
    paymentStatus: document.getElementById('evPaymentStatus').value,
  };

  try {
    const res = await apiFetch(`/api/iac-mobile/booking-requests/${bookingId}/event-details`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('Event details attached! Booking record is now complete.');
      closeModal('eventDetailsModal');
      await fetchBookings();
    }
  } catch (err) {
    showToast('Failed to save event details.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save & Finalize Event Record';
  }
}

// Booking Detail Modal
function openBookingDetailModal(bookingId) {
  const b = APP_STATE.bookings.find(item => item._id === bookingId);
  if (!b) return;

  document.getElementById('detailBookingId').textContent = `BK-${b._id.slice(-6).toUpperCase()}`;
  document.getElementById('bookingDetailBody').innerHTML = `
    <div class="space-y-3">
      <div class="p-3 bg-yellow-50 rounded-xl border border-yellow-200">
        <span class="text-[10px] font-bold text-yellow-700 block uppercase">RESERVATION TITLE</span>
        <strong class="text-sm text-slate-900 block">${b.programName}</strong>
        <span class="text-xs text-slate-600 block mt-1">Room ${b.roomNumber} (${b.roomType})</span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="p-2 border border-slate-200 rounded-lg">
          <span class="text-muted block text-[10px]">SCHEDULE</span>
          <strong>${b.requestedDate ? new Date(b.requestedDate).toLocaleDateString() : 'Today'}</strong>
          <div class="text-muted">${b.requestedSlot || b.arrivalTime || '14:00'}</div>
        </div>
        <div class="p-2 border border-slate-200 rounded-lg">
          <span class="text-muted block text-[10px]">STATUS</span>
          <strong class="text-yellow-700 uppercase">${b.status}</strong>
          <div class="text-muted">${b.eventDetailsSubmitted ? 'Event details attached' : 'Awaiting event details'}</div>
        </div>
      </div>
      <div class="p-3 border border-slate-200 rounded-xl text-xs">
        <span class="text-muted block text-[10px] mb-1">PURPOSE / NOTES</span>
        <p class="m-0 text-slate-700">${b.description || 'No additional notes provided.'}</p>
      </div>
    </div>
  `;

  document.getElementById('bookingDetailFooter').innerHTML = `
    <button class="btn btn-secondary w-full" onclick="closeModal('bookingDetailModal')">Close</button>
  `;

  openModal('bookingDetailModal');
}

async function cancelBooking(id) {
  if (!confirm('Are you sure you want to cancel this booking request?')) return;
  try {
    await apiFetch(`/api/iac-mobile/booking-requests/${id}/cancel`, { method: 'POST' });
    showToast('Booking cancelled');
    fetchBookings();
  } catch (e) {
    showToast('Failed to cancel booking');
  }
}

// -------------------------------------------------------------
// ISSUES & HELP FEED
// -------------------------------------------------------------
async function fetchIssues() {
  try {
    const res = await apiFetch(`/api/iac-mobile/issues?mobileUserId=${APP_STATE.user.id}`);
    if (res.ok) {
      APP_STATE.issues = await res.json();
      renderIssues();
    }
  } catch (e) {
    renderIssues();
  }
}

function filterIssues(status, elem) {
  APP_STATE.issueFilter = status;
  document.querySelectorAll('.chip-filter').forEach(c => c.classList.remove('active'));
  if (elem) elem.classList.add('active');
  renderIssues();
}

function renderIssues() {
  const container = document.getElementById('issuesListContainer');
  let list = APP_STATE.issues || [];

  // Counts
  const countAll = list.length;
  const countPending = list.filter(i => i.status === 'pending').length;
  const countProg = list.filter(i => i.status === 'in-progress' || i.status === 'seen').length;
  const countRes = list.filter(i => i.status === 'resolved').length;

  document.getElementById('issueCountAll').textContent = countAll;
  document.getElementById('issueCountPending').textContent = countPending;
  document.getElementById('issueCountProg').textContent = countProg;
  document.getElementById('issueCountRes').textContent = countRes;

  if (APP_STATE.issueFilter === 'pending') {
    list = list.filter(i => i.status === 'pending');
  } else if (APP_STATE.issueFilter === 'in-progress') {
    list = list.filter(i => i.status === 'in-progress' || i.status === 'seen');
  } else if (APP_STATE.issueFilter === 'resolved') {
    list = list.filter(i => i.status === 'resolved');
  }

  if (list.length === 0) {
    container.innerHTML = '<div class="text-center p-6 text-muted text-xs bg-white rounded-2xl border border-slate-200">No issues in this category.</div>';
    return;
  }

  container.innerHTML = list.map(i => {
    const isProg = i.status === 'in-progress' || i.status === 'seen';
    const isRes = i.status === 'resolved';
    const statusPillClass = isRes ? 'status-resolved' : 'status-seen';
    const statusText = isRes ? '✔ RESOLVED' : (isProg ? '● IN-PROGRESS • SEEN' : '● PENDING TRIAGE');

    return `
      <div class="issue-card">
        <div class="issue-top-row">
          <div class="flex items-center gap-1.5">
            <span class="badge-hardware">${i.category || 'Hardware'}</span>
            <span class="${statusPillClass}">${statusText}</span>
          </div>
          <button class="affected-pill-btn" onclick="toggleAffected('${i._id}')">
            ▲ ${i.affectedCount || 1} affected
          </button>
        </div>

        <div class="issue-main-block">
          ${i.nodeEquipment ? `<span class="node-code-tag">${i.nodeEquipment}</span>` : ''}
          <div>
            <h4 class="issue-headline">${i.title || i.description.slice(0, 40)}</h4>
            <p class="issue-snippet">${i.description}</p>
          </div>
        </div>

        <div class="issue-author-row">
          <span>🕒 ${formatRelativeTime(i.createdAt)} • ${i.reporterName || 'Anonymous'}</span>
          <span class="issue-ticket-code">${i.ticketCode || '#TKT-8924'}</span>
        </div>

        ${i.assigneeNote ? `
          <div class="assignee-box">
            <img src="assets/avatar.jpg" alt="Lead" class="assignee-thumb" onerror="this.src='/frontend/public/assets/avatar.jpg'; this.onerror=null;">
            <div>
              <strong>${i.assigneeName || 'Alex Vance'}</strong><span class="assignee-role">${i.assigneeRole || 'DESK LEAD'}</span>
              <div class="text-[10px] text-slate-600">${i.assigneeNote}</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function toggleAffected(id) {
  try {
    const res = await apiFetch(`/api/iac-mobile/issues/${id}/affected`, { method: 'POST' });
    if (res.ok) {
      showToast('Marked as affected! Workstation prioritized.');
      fetchIssues();
    }
  } catch (e) {
    showToast('Failed to update affected status');
  }
}

function selectCategory(btn, cat) {
  APP_STATE.currentCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function handleEvidenceSelect(event) {
  const file = event.target.files[0];
  if (file) {
    document.getElementById('evidenceFileName').textContent = file.name;
    showToast(`Attached evidence: ${file.name}`);
  }
}

async function handleReportSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitProblemReport');
  btn.disabled = true;
  btn.textContent = 'Submitting Ticket...';

  const title = document.getElementById('repTitle').value.trim();
  const node = document.getElementById('repNode').value.trim();
  const desc = document.getElementById('repDesc').value.trim();

  try {
    const res = await apiFetch('/api/iac-mobile/issues', {
      method: 'POST',
      body: JSON.stringify({
        title,
        nodeEquipment: node,
        category: APP_STATE.currentCategory,
        description: desc,
        reporterId: APP_STATE.user.id,
        reporterName: APP_STATE.user.name,
      })
    });

    if (res.ok) {
      showToast('Ticket submitted! Tech dispatch notified.');
      document.getElementById('reportIssueForm').reset();
      document.getElementById('evidenceFileName').textContent = 'Attach Photo / Screenshot';
      await fetchIssues();
      const listContainer = document.getElementById('issuesListContainer');
      if (listContainer) listContainer.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    showToast('Failed to submit issue');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Problem Report';
  }
}

function focusQuickReport() {
  switchTab('issues');
  const section = document.getElementById('quickReportSection');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('repTitle')?.focus();
  }
}

function toggleReportForm() {
  const form = document.getElementById('reportIssueForm');
  const chevron = document.getElementById('reportFormChevron');
  if (form.style.display === 'none') {
    form.style.display = 'block';
    chevron.style.transform = 'rotate(0deg)';
  } else {
    form.style.display = 'none';
    chevron.style.transform = 'rotate(180deg)';
  }
}

function callWalkupDesk() {
  alert('Connecting to Direct Walk-up Desk Intercom #404 (Station 12)...');
}

// -------------------------------------------------------------
// PROFILE & SETTINGS
// -------------------------------------------------------------
function handleAvatarChange(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target.result;
      document.querySelectorAll('.profile-big-avatar, .header-avatar, .welcome-avatar').forEach(img => {
        img.src = dataUrl;
      });
      showToast('Profile photo updated!');
    };
    reader.readAsDataURL(file);
  }
}

function handleLogout() {
  if (confirm('Log out of this device?')) {
    localStorage.removeItem('iac_mobile_access_token');
    localStorage.removeItem('iac_mobile_refresh_token');
    window.location.href = 'login.html';
  }
}

function openPersonalInfoModal() {
  alert(`Member: ${APP_STATE.user.name}\nEmail: ${APP_STATE.user.email}\nPhone: ${APP_STATE.user.phone}\nStudent ID: ${APP_STATE.user.idNum}`);
}

function openNotificationsSettings() {
  showToast('Notification preferences are set to SMS & Push.');
}

function openDefaultStationModal() {
  showToast('Default workstation is set to Compute Lab (Desk #14)');
}

function openSecuritySettings() {
  showToast('2-Factor Authentication is active via Authenticator app.');
}

function downloadUsageReport() {
  showToast('Downloading October 2024 Audit Report (.PDF)...');
}

// -------------------------------------------------------------
// MODAL CONTROLLERS & UTILITIES
// -------------------------------------------------------------
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

function openWifiModal() { openModal('wifiModal'); }
function openScanModal() { openModal('scanModal'); }
function openCampusModal() { openModal('campusModal'); }
function openNotifications() { openModal('notifModal'); }

function selectCampus(name, label) {
  APP_STATE.campus = name;
  document.getElementById('currentCampusName').textContent = name;
  closeModal('campusModal');
  showToast(`Switched campus view to: ${label}`);
}

function handleManualStationSync() {
  const val = document.getElementById('manualStationInput').value.trim();
  if (val) {
    closeModal('scanModal');
    showToast(`Synced with Station ${val.toUpperCase()}! Beacon connected.`);
  }
}

function showDirectionsModal() {
  alert('Directions to Room 3 (Compute Lab):\nTake Elevator B to Level 2. Turn left past the Central Hub. Station RIG-03 is on the north window cluster.');
}

function openAdvisoryModal() {
  alert('Notice: Scheduled Maintenance tonight from 23:00 to 01:00 UTC.\nCompute Cluster Nodes 12-16 undergoing firmware patches. Backup routers will maintain lounge internet connectivity.');
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  }
}

function showToast(msg) {
  const t = document.getElementById('toastBox');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.style.display = 'none';
  }, 3200);
}

function formatTime(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '09:15 AM';
  }
}

function formatRelativeTime(isoStr) {
  try {
    const d = new Date(isoStr);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600) return `Today, ${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `Today, ${formatTime(d)}`;
    return `Yesterday, ${formatTime(d)}`;
  } catch (e) {
    return 'Today, 14:28';
  }
}

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  checkAuth();

  // Populate user names in UI
  document.getElementById('homeUserName').textContent = APP_STATE.user.name.split(' ')[0];
  document.getElementById('passMemberName').textContent = APP_STATE.user.name;
  document.getElementById('profileNameDisplay').textContent = APP_STATE.user.name;
  document.getElementById('profileMenuEmail').textContent = `${APP_STATE.user.email} • ${APP_STATE.user.phone}`;
  document.getElementById('profileIdDisplay').textContent = APP_STATE.user.idNum;

  // Initial Data Fetch
  await fetchActiveCheckinTicket();
  await fetchBookings();
  await fetchIssues();

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  });
});
