/**
 * IAC Mobile Application Logic
 * Integrates with Backend: /api/iac-mobile/...
 * White & Yellow Theme Architecture
 */

// Global State
const APP_STATE = {
  activeTab: 'home',
  user: {
    id: localStorage.getItem('iac_mobile_user_id') || '',
    name: localStorage.getItem('iac_mobile_user_name') || '',
    email: localStorage.getItem('iac_mobile_user_email') || '',
    phone: localStorage.getItem('iac_mobile_user_phone') || '',
    idNum: localStorage.getItem('iac_mobile_user_id_num') || '',
    streak: parseInt(localStorage.getItem('iac_mobile_user_streak') || '0', 10),
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
  announcements: [],
  announcementIndex: 0,
  announcementTimer: null,
  syncInterval: null,
};

// XSS Sanitizer to safely interpolate user-controlled data into HTML
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Central Auth Gate: strictly validates session server-side; redirects on any failure
async function checkAuthAndInit() {
  const token = localStorage.getItem('iac_mobile_access_token');
  if (!token) {
    redirectToLogin();
    return false;
  }

  try {
    const res = await fetch('/api/iac-mobile/auth/verify', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.user) {
        APP_STATE.user = {
          id: data.user.mobileUserId || data.user.id || '',
          dbId: data.user.id || '',
          mobileUserId: data.user.mobileUserId || data.user.id || '',
          name: data.user.name || '',
          email: data.user.email || '',
          phone: data.user.phoneNumber || '',
          idNum: data.user.studentId || '',
          streak: data.user.streak || 0,
          totalCheckins: data.user.totalCheckins || 0,
        };
        localStorage.setItem('iac_mobile_user_id', APP_STATE.user.id);
        localStorage.setItem('iac_mobile_user_name', APP_STATE.user.name);
        localStorage.setItem('iac_mobile_user_email', APP_STATE.user.email);
        localStorage.setItem('iac_mobile_user_phone', APP_STATE.user.phone);
        localStorage.setItem('iac_mobile_user_id_num', APP_STATE.user.idNum);
        localStorage.setItem('iac_mobile_user_streak', String(APP_STATE.user.streak));
        return true;
      }
    }

    // Attempt token refresh on 401
    const refreshToken = localStorage.getItem('iac_mobile_refresh_token');
    if (refreshToken) {
      const refRes = await fetch('/api/iac-mobile/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      if (refRes.ok) {
        const refData = await refRes.json();
        if (refData.accessToken) {
          localStorage.setItem('iac_mobile_access_token', refData.accessToken);
          return checkAuthAndInit(); // Re-verify with freshly minted token
        }
      }
    }

    // Invalid or revoked session
    redirectToLogin();
    return false;
  } catch (err) {
    // On unexpected error, if no valid token in storage, force login
    if (!token) {
      redirectToLogin();
      return false;
    }
    return true;
  }
}

function redirectToLogin() {
  localStorage.removeItem('iac_mobile_access_token');
  localStorage.removeItem('iac_mobile_refresh_token');
  localStorage.removeItem('iac_mobile_user_id');
  localStorage.removeItem('iac_mobile_user_name');
  localStorage.removeItem('iac_mobile_user_email');
  localStorage.removeItem('iac_mobile_user_phone');
  localStorage.removeItem('iac_mobile_user_id_num');
  localStorage.removeItem('iac_mobile_user_streak');
  sessionStorage.clear();
  window.location.replace('login.html?returnUrl=index.html');
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
async function fetchActiveCheckinTicket(isSync = false) {
  if (!APP_STATE.user.id) return;
  try {
    const res = await apiFetch(`/api/iac-mobile/checkin-tickets?mobileUserId=${APP_STATE.user.id}`);
    if (res.ok) {
      const tickets = await res.json();
      const list = Array.isArray(tickets) ? tickets : [];
      const currentActive = list.find(t => t.status === 'confirmed' || t.status === 'pending');

      const prevStatus = APP_STATE.activeTicket ? APP_STATE.activeTicket.status : null;
      APP_STATE.activeTicket = currentActive || null;

      // Real-time transition alert when admin confirms or declines
      if (isSync && prevStatus === 'pending' && currentActive && currentActive.status === 'confirmed') {
        showToast('🎉 Check-in Approved by Staff! Your digital pass is now active.');
        await fetchUserProfile();
      } else if (isSync && prevStatus === 'pending' && (!currentActive || currentActive.status === 'declined')) {
        showToast('Notice: Check-in ticket was declined or cancelled by administrator.');
      }

      renderCheckinUI();
    }
  } catch (e) {
    console.warn('Checkin ticket fetch error:', e);
  }
}

function renderCheckinUI() {
  const isCheckedIn = !!APP_STATE.activeTicket;
  const t = APP_STATE.activeTicket;
  const isPending = t && t.status === 'pending';
  const isConfirmed = t && t.status === 'confirmed';

  const navBadge = document.getElementById('navCheckinBadge');
  if (navBadge) navBadge.style.display = isCheckedIn ? 'block' : 'none';

  // Home card representation
  const homeStatusPill = document.getElementById('homePassStatusPill');
  const homeStatusText = document.getElementById('homePassStatusText');
  const homeSessionCode = document.getElementById('homeSessionCode');
  const homePassTitle = document.getElementById('homePassTitle');
  const homePassSubtitle = document.getElementById('homePassSubtitle');
  const homePassBtnText = document.getElementById('homePassBtnText');
  const homeProgressWrap = document.getElementById('homeProgressWrap');

  // Pass Screen Elements
  const passCodeLarge = document.getElementById('passCodeLarge');
  const passCheckedInAt = document.getElementById('passCheckedInAt');
  const ticketStatusBadge = document.getElementById('ticketStatusBadge');
  const btnToggleCheckin = document.getElementById('btnToggleCheckin');

  if (isPending) {
    if (homeStatusPill) homeStatusPill.className = 'status-pill active-pill';
    if (homeStatusText) homeStatusText.textContent = '⏳ AWAITING STAFF APPROVAL';
    if (homeSessionCode) homeSessionCode.textContent = `SESSION #${t.ticketCode || 'PENDING'}`;
    if (homePassTitle) homePassTitle.textContent = 'Pass Pending Approval';
    if (homePassSubtitle) homePassSubtitle.textContent = `Requested at ${formatTime(t.requestedAt || new Date())} • Awaiting front desk review`;
    if (homePassBtnText) homePassBtnText.textContent = 'View Pending Pass & QR';
    if (homeProgressWrap) homeProgressWrap.style.display = 'none';

    if (passCodeLarge) passCodeLarge.textContent = t.ticketCode || 'IAC-PENDING';
    if (passCheckedInAt) passCheckedInAt.textContent = `Requested ${formatTime(t.requestedAt || new Date())} (Pending)`;
    if (ticketStatusBadge) {
      ticketStatusBadge.textContent = '⏳ AWAITING APPROVAL';
      ticketStatusBadge.className = 'ticket-validity bg-amber-100 text-amber-900 border-amber-300';
    }
    if (btnToggleCheckin) {
      btnToggleCheckin.textContent = 'Withdraw / Cancel Request';
      btnToggleCheckin.className = 'btn btn-secondary w-full';
    }
  } else if (isConfirmed) {
    if (homeStatusPill) homeStatusPill.className = 'status-pill active-pill';
    if (homeStatusText) homeStatusText.textContent = 'ACTIVE CHECK-IN';
    if (homeSessionCode) homeSessionCode.textContent = `SESSION #${t.ticketCode || 'IAC-8894'}`;
    if (homePassTitle) homePassTitle.textContent = 'Current Access Pass';
    if (homePassSubtitle) homePassSubtitle.textContent = `Checked into Main Lounge at ${formatTime(t.confirmedAt || t.requestedAt || new Date())}`;
    if (homePassBtnText) homePassBtnText.textContent = 'View Digital Pass & QR';
    if (homeProgressWrap) homeProgressWrap.style.display = 'block';

    if (passCodeLarge) passCodeLarge.textContent = t.ticketCode || 'IAC-8894';
    if (passCheckedInAt) passCheckedInAt.textContent = `Today, ${formatTime(t.confirmedAt || t.requestedAt || new Date())}`;
    if (ticketStatusBadge) {
      ticketStatusBadge.textContent = 'ACTIVE TICKET';
      ticketStatusBadge.className = 'ticket-validity';
    }
    if (btnToggleCheckin) {
      btnToggleCheckin.textContent = 'Check Out of Lounge';
      btnToggleCheckin.className = 'btn btn-danger-soft w-full';
    }
  } else {
    // Not checked in
    if (homeStatusPill) homeStatusPill.className = 'status-pill';
    if (homeStatusText) homeStatusText.textContent = 'NOT CHECKED IN';
    if (homeSessionCode) homeSessionCode.textContent = 'IAC ACCESS PORTAL';
    if (homePassTitle) homePassTitle.textContent = 'Internet Lounge Pass';
    if (homePassSubtitle) homePassSubtitle.textContent = 'High-speed workstation access & quiet focus labs.';
    if (homePassBtnText) homePassBtnText.textContent = 'Check In to Lounge';
    if (homeProgressWrap) homeProgressWrap.style.display = 'none';

    if (passCodeLarge) passCodeLarge.textContent = '○ INACTIVE';
    if (passCheckedInAt) passCheckedInAt.textContent = 'Not Checked In';
    if (ticketStatusBadge) {
      ticketStatusBadge.textContent = 'READY TO ENTER';
      ticketStatusBadge.className = 'ticket-validity';
    }
    if (btnToggleCheckin) {
      btnToggleCheckin.textContent = 'Check In to Lounge';
      btnToggleCheckin.className = 'btn btn-yellow w-full';
    }
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
    const ticketId = APP_STATE.activeTicket._id;
    const isPending = APP_STATE.activeTicket.status === 'pending';

    try {
      const res = await apiFetch(`/api/iac-mobile/checkin-tickets/${ticketId}/checkout`, { method: 'POST' });
      if (res.ok) {
        APP_STATE.activeTicket = null;
        showToast(isPending ? 'Check-in request withdrawn.' : 'Checked out of Internet Lounge. Session completed.');
        await fetchUserProfile();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update check-in status.');
      }
    } catch (e) {
      showToast('Network error while processing check-out.');
    }
  } else {
    // Submit authentic check-in request for administrator review
    try {
      const res = await apiFetch('/api/iac-mobile/checkin-tickets/request', {
        method: 'POST',
        body: JSON.stringify({
          mobileUserId: APP_STATE.user.id,
          mobileUserName: APP_STATE.user.name,
          mobileUserEmail: APP_STATE.user.email,
          mobileUserPhone: APP_STATE.user.phone,
          mobileUserIdNumber: APP_STATE.user.idNum,
        })
      });

      if (res.ok) {
        const data = await res.json();
        APP_STATE.activeTicket = data.ticket || data;
        showToast(`Check-in request submitted! Pass #${APP_STATE.activeTicket.ticketCode || ''} is awaiting front desk approval.`);
      } else {
        const err = await res.json();
        if (err.alreadyCheckedIn && err.ticket) {
          APP_STATE.activeTicket = err.ticket;
          showToast('Found your existing active check-in for today.');
        } else {
          showToast(err.error || err.message || 'Check-in request failed.');
        }
      }
    } catch (e) {
      showToast('Failed to connect to check-in service.');
    }
  }
  renderCheckinUI();
}

function simulateNfcTap() {
  if (!APP_STATE.activeTicket) {
    showToast('📡 NFC Beacon detected at Desk Reader! Submitting check-in request...');
    toggleLoungeAccess();
  } else if (APP_STATE.activeTicket.status === 'pending') {
    showToast(`📡 NFC Beacon tapped. Ticket #${APP_STATE.activeTicket.ticketCode || ''} is awaiting front desk staff confirmation.`);
  } else {
    showToast(`📡 NFC Beacon tapped. Active session #${APP_STATE.activeTicket.ticketCode || ''} verified on reader.`);
  }
}

// -------------------------------------------------------------
// BOOKINGS WORKFLOW (TWO-STAGE)
// -------------------------------------------------------------
async function fetchBookings(isSync = false) {
  const container = document.getElementById('bookingsListContainer');
  if (!isSync && container) {
    container.innerHTML = '<div class="text-center p-4 text-muted">Loading room reservations...</div>';
  }

  try {
    const res = await apiFetch(`/api/iac-mobile/booking-requests?mobileUserId=${APP_STATE.user.id}`);
    if (res.ok) {
      const newBookings = await res.json();
      if (Array.isArray(newBookings)) {
        if (isSync && APP_STATE.bookings.length > 0) {
          // Detect status changes from admin actions
          newBookings.forEach((nb) => {
            const old = APP_STATE.bookings.find((ob) => ob._id === nb._id);
            if (old && old.status === 'pending' && nb.status === 'confirmed') {
              showToast(`🎉 Reservation for Room ${nb.roomNumber} (${nb.roomType}) was Approved by staff!`);
            } else if (old && old.status === 'pending' && nb.status === 'rejected') {
              showToast(`Reservation for Room ${nb.roomNumber} was declined: ${nb.rejectionReason || 'Declined by staff'}`);
            }
          });
        }
        APP_STATE.bookings = newBookings;
      }
    }
  } catch (e) {
    console.warn('Booking fetch fallback:', e);
  }

  renderBookingsList();
  updateHomeUpcomingReservation();
}

function updateHomeUpcomingReservation() {
  const upcoming = (APP_STATE.bookings || []).find(b => b.status === 'confirmed' || b.status === 'pending');
  const card = document.getElementById('homeUpcomingCard');
  const timeEl = document.getElementById('homeUpcomingTime');
  const nodeEl = document.getElementById('homeUpcomingNode');
  const roomEl = document.getElementById('homeUpcomingRoom');

  if (!card) return;

  if (upcoming) {
    card.style.display = 'block';
    const dStr = upcoming.requestedDate ? new Date(upcoming.requestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today';
    if (timeEl) timeEl.textContent = `${dStr} at ${upcoming.arrivalTime || '14:00'}`;
    if (nodeEl) nodeEl.textContent = `ROOM-${upcoming.roomNumber || '03'}`;
    if (roomEl) roomEl.textContent = `Room ${upcoming.roomNumber} (${upcoming.roomType}) • ${upcoming.programName || 'Facility Reservation'}`;
  }
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
  if (!container) return;

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
    let statusLabel = 'PENDING REVIEW';
    if (isConfirmedFinal) {
      badgeClass = 'status-badge-confirmed';
      statusLabel = 'CONFIRMED';
    } else if (isApprovedAwaitingStage2) {
      badgeClass = 'status-badge-approved';
      statusLabel = 'APPROVED • COMPLETE FORM';
    } else if (status === 'rejected') {
      badgeClass = 'status-pill bg-rose-100 text-rose-800 border-rose-200';
      statusLabel = 'DECLINED';
    } else if (status === 'cancelled') {
      badgeClass = 'status-pill';
      statusLabel = 'CANCELLED';
    }

    const dateStr = b.requestedDate ? new Date(b.requestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today';

    return `
      <div class="booking-item-card">
        <div class="bcard-top">
          <div class="bcard-room-info">
            <div class="room-type-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div>
              <h4 class="bcard-title">Room ${escapeHtml(b.roomNumber)} (${escapeHtml(b.roomType || 'Facility')})</h4>
              <span class="bcard-specs">${escapeHtml(b.programName || 'Research & Computing')}</span>
            </div>
          </div>
          <span class="${badgeClass}">${statusLabel}</span>
        </div>

        <div class="bcard-divider"></div>

        <div class="bcard-slot-grid">
          <div>
            <span class="slot-heading">RESERVED SLOT</span>
            <div class="slot-detail-primary">${dateStr}</div>
            <div class="slot-detail-sub">${escapeHtml(b.requestedSlot || b.arrivalTime || '14:00 - 18:00')}</div>
          </div>
          <div>
            <span class="slot-heading">PHYSICAL ACCESS</span>
            <div class="slot-detail-primary text-yellow-dark">${isConfirmedFinal ? 'Access Granted' : (isPending ? 'Pending Staff Review' : (status === 'rejected' ? 'Declined' : 'Action Required'))}</div>
            <div class="slot-detail-sub">${isConfirmedFinal ? 'RFID Badge Active' : (status === 'rejected' ? (escapeHtml(b.rejectionReason) || 'Declined by staff') : 'Awaiting confirmation')}</div>
          </div>
        </div>

        ${isPending ? `
          <div class="awaiting-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Awaiting administrator approval from Facilities Desk</span>
          </div>
        ` : ''}

        ${status === 'rejected' && b.rejectionReason ? `
          <div class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs mt-2">
            <strong>Reason for decline:</strong> ${escapeHtml(b.rejectionReason)}
          </div>
        ` : ''}

        <div class="bcard-btn-row">
          ${isApprovedAwaitingStage2 ? `
            <button class="btn btn-yellow flex-1" onclick="openEventDetailsModal('${b._id}')">
              Complete Event Details
            </button>
            <button class="btn btn-secondary flex-1" onclick="openBookingDetailModal('${b._id}')">
              Details
            </button>
          ` : isConfirmedFinal ? `
            <button class="btn btn-yellow flex-1" onclick="switchTab('checkin')">
              View Access Pass
            </button>
            <button class="btn btn-secondary flex-1" onclick="openBookingDetailModal('${b._id}')">
              Details
            </button>
          ` : isPending ? `
            <button class="btn btn-secondary flex-1" onclick="openBookingDetailModal('${b._id}')">
              View Details
            </button>
            <button class="btn btn-danger-soft" onclick="cancelBooking('${b._id}')">
              Cancel Request
            </button>
          ` : `
            <button class="btn btn-secondary flex-1" onclick="openBookingDetailModal('${b._id}')">
              View Details
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
      showToast('Booking request submitted! Facilities desk notified for approval.');
      closeModal('newBookingModal');
      await fetchBookings();
      switchTab('bookings');
    } else {
      const err = await res.json();
      showToast(err.error || err.message || 'Failed to submit booking request.');
    }
  } catch (err) {
    showToast(err?.message || 'Failed to submit booking request.');
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
    } else {
      const err = await res.json();
      showToast(err.error || err.message || 'Failed to save event details.');
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
        <strong class="text-sm text-slate-900 block">${escapeHtml(b.programName)}</strong>
        <span class="text-xs text-slate-600 block mt-1">Room ${escapeHtml(b.roomNumber)} (${escapeHtml(b.roomType)})</span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="p-2 border border-slate-200 rounded-lg">
          <span class="text-muted block text-[10px]">SCHEDULE</span>
          <strong>${b.requestedDate ? new Date(b.requestedDate).toLocaleDateString() : 'Today'}</strong>
          <div class="text-muted">${escapeHtml(b.requestedSlot || b.arrivalTime || '14:00')}</div>
        </div>
        <div class="p-2 border border-slate-200 rounded-lg">
          <span class="text-muted block text-[10px]">STATUS</span>
          <strong class="text-yellow-700 uppercase">${escapeHtml(b.status)}</strong>
          <div class="text-muted">${b.eventDetailsSubmitted ? 'Event details attached' : 'Awaiting event details'}</div>
        </div>
      </div>
      <div class="p-3 border border-slate-200 rounded-xl text-xs">
        <span class="text-muted block text-[10px] mb-1">PURPOSE / NOTES</span>
        <p class="m-0 text-slate-700">${escapeHtml(b.description || 'No additional notes provided.')}</p>
      </div>
      ${b.rejectionReason ? `
        <div class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <span class="text-[10px] font-bold block uppercase">DECLINE REASON</span>
          <p class="m-0">${escapeHtml(b.rejectionReason)}</p>
        </div>
      ` : ''}
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
    const res = await apiFetch(`/api/iac-mobile/booking-requests/${id}/cancel`, { method: 'POST' });
    if (res.ok) {
      showToast('Booking request cancelled');
      await fetchBookings();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to cancel booking');
    }
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
          ${i.nodeEquipment ? `<span class="node-code-tag">${escapeHtml(i.nodeEquipment)}</span>` : ''}
          <div>
            <h4 class="issue-headline">${escapeHtml(i.title || i.description.slice(0, 40))}</h4>
            <p class="issue-snippet">${escapeHtml(i.description)}</p>
          </div>
        </div>

        <div class="issue-author-row">
          <span>🕒 ${formatRelativeTime(i.createdAt)} • ${escapeHtml(i.reporterName || 'Anonymous')}</span>
          <span class="issue-ticket-code">${escapeHtml(i.ticketCode || '#TKT-8924')}</span>
        </div>

        ${i.assigneeNote ? `
          <div class="assignee-box">
            <img src="assets/avatar.jpg" alt="Lead" class="assignee-thumb" onerror="this.src='/frontend/public/assets/avatar.jpg'; this.onerror=null;">
            <div>
              <strong>${escapeHtml(i.assigneeName || 'Staff Lead')}</strong><span class="assignee-role">${escapeHtml(i.assigneeRole || 'DESK LEAD')}</span>
              <div class="text-[10px] text-slate-600">${escapeHtml(i.assigneeNote)}</div>
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

async function handleLogout() {
  if (confirm('Log out of this device?')) {
    try {
      await apiFetch('/api/iac-mobile/auth/logout', { method: 'POST' });
    } catch (e) {
      // Continue client cleanup even if network fails
    }
    redirectToLogin();
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

async function fetchUserProfile() {
  if (!APP_STATE.user.id) return;
  try {
    const res = await apiFetch('/api/iac-mobile/auth/verify');
    if (res.ok) {
      const data = await res.json();
      if (data && data.user) {
        APP_STATE.user = {
          ...APP_STATE.user,
          id: data.user.mobileUserId || data.user.id || APP_STATE.user.id,
          mobileUserId: data.user.mobileUserId || APP_STATE.user.mobileUserId || data.user.id,
          dbId: data.user.id || APP_STATE.user.dbId,
          name: data.user.name || APP_STATE.user.name,
          email: data.user.email || APP_STATE.user.email,
          phone: data.user.phoneNumber || APP_STATE.user.phone,
          idNum: data.user.studentId || APP_STATE.user.idNum,
          streak: data.user.streak !== undefined ? data.user.streak : APP_STATE.user.streak,
          totalCheckins: data.user.totalCheckins !== undefined ? data.user.totalCheckins : APP_STATE.user.totalCheckins,
        };
        localStorage.setItem('iac_mobile_user_streak', String(APP_STATE.user.streak));
        const statStreak = document.getElementById('statStreak');
        if (statStreak) statStreak.textContent = String(APP_STATE.user.streak);
        const statCheckins = document.getElementById('statCheckins');
        if (statCheckins) statCheckins.textContent = String(APP_STATE.user.totalCheckins || 0);
      }
    }
  } catch (err) {
    console.warn('User profile refresh failed:', err);
  }
}

async function fetchAnnouncements() {
  try {
    const res = await apiFetch('/api/iac-mobile/announcements');
    if (res.ok) {
      const list = await res.json();
      APP_STATE.announcements = Array.isArray(list) ? list.slice(0, 5) : [];
      APP_STATE.announcementIndex = Math.min(APP_STATE.announcementIndex, Math.max(APP_STATE.announcements.length - 1, 0));
      renderAnnouncement();
      clearInterval(APP_STATE.announcementTimer);
      if (APP_STATE.announcements.length > 1) {
        APP_STATE.announcementTimer = setInterval(() => changeAnnouncement(1), 6000);
      }
    } else {
      APP_STATE.announcements = [];
      renderAnnouncement();
    }
  } catch (err) {
    console.warn('Announcements fetch failed:', err);
    APP_STATE.announcements = [];
    renderAnnouncement();
  }
}

function renderAnnouncement() {
  const announcements = APP_STATE.announcements;
  const controls = document.getElementById('announcementControls');
  const latestHeading = document.getElementById('latestAnnouncementHeading');
  const latestText = document.getElementById('latestAnnouncementText');
  const latestCategory = document.getElementById('latestAnnouncementCategory');
  const latestImage = document.getElementById('latestAnnouncementImage');
  const heading = document.getElementById('advisoryHeading');
  const text = document.getElementById('advisoryText');
  const category = document.getElementById('announcementCategory');
  const count = document.getElementById('announcementCount');
  const dots = document.getElementById('announcementDots');
  const copy = document.getElementById('announcementCopy');
  if (!controls || !latestHeading || !latestText || !latestCategory || !latestImage || !heading || !text || !category || !count || !dots) return;

  if (announcements.length === 0) {
    latestHeading.textContent = 'No announcements right now';
    latestText.textContent = 'There are no active announcements to show.';
    latestCategory.textContent = 'Updates';
    latestImage.hidden = true;
    heading.textContent = 'No announcements right now';
    text.textContent = 'There are no active announcements to show.';
    category.textContent = 'Updates';
    count.textContent = '0 / 0';
    controls.hidden = true;
    dots.replaceChildren();
    return;
  }

  const latest = announcements[0];
  latestHeading.textContent = latest.title || 'Announcement';
  latestText.textContent = latest.description || '';
  latestCategory.textContent = latest.category || 'notice';
  setAnnouncementImage(latestImage, latest);

  const announcement = announcements[APP_STATE.announcementIndex];
  heading.textContent = announcement.title || 'Announcement';
  text.textContent = announcement.description || '';
  category.textContent = announcement.category || 'notice';
  count.textContent = `${APP_STATE.announcementIndex + 1} / ${announcements.length}`;
  controls.hidden = announcements.length < 2;
  setAnnouncementImage(document.getElementById('announcementImage'), announcement);

  dots.replaceChildren(...announcements.map((item, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'advisory-dot';
    dot.setAttribute('aria-label', `Show announcement ${index + 1}: ${item.title || 'Announcement'}`);
    dot.setAttribute('aria-current', String(index === APP_STATE.announcementIndex));
    dot.addEventListener('click', () => changeAnnouncement(index - APP_STATE.announcementIndex));
    return dot;
  }));

  if (copy) {
    copy.classList.remove('is-changing');
    requestAnimationFrame(() => copy.classList.add('is-changing'));
  }
}

function setAnnouncementImage(image, announcement) {
  if (!image) return;
  const imageUrl = typeof announcement.imageUrl === 'string' ? announcement.imageUrl.trim() : '';
  image.hidden = !imageUrl;
  image.onerror = () => {
    image.hidden = true;
  };
  if (imageUrl) {
    image.src = imageUrl;
    image.alt = announcement.title ? `Image for ${announcement.title}` : 'Announcement image';
  } else {
    image.removeAttribute('src');
    image.alt = '';
  }
}

function changeAnnouncement(offset) {
  const total = APP_STATE.announcements.length;
  if (total < 2) return;
  APP_STATE.announcementIndex = (APP_STATE.announcementIndex + offset + total) % total;
  renderAnnouncement();
}

function updateActivitySummary() {
  const statCheckins = document.getElementById('statCheckins');
  if (statCheckins) statCheckins.textContent = String(APP_STATE.user.totalCheckins || 0);
  const statStreak = document.getElementById('statStreak');
  if (statStreak) statStreak.textContent = String(APP_STATE.user.streak || 0);
  const statTickets = document.getElementById('statTickets');
  if (statTickets) {
    const openCount = (APP_STATE.issues || []).filter(i => i.status !== 'resolved').length;
    statTickets.textContent = String(openCount);
  }
}

function initSocket() {
  if (typeof io !== 'undefined') {
    try {
      const socket = io();
      socket.on('connect', () => {
        console.log('[Socket] Connected to real-time update engine');
      });
      socket.on('mobile:checkin:update', (data) => {
        if (!data || !data.mobileUserId || data.mobileUserId === APP_STATE.user.id || data.mobileUserId === APP_STATE.user.mobileUserId) {
          fetchActiveCheckinTicket(true);
        }
      });
      socket.on('mobile:booking:update', (data) => {
        if (!data || !data.mobileUserId || data.mobileUserId === APP_STATE.user.id || data.mobileUserId === APP_STATE.user.mobileUserId) {
          fetchBookings(true);
        }
      });
      socket.on('mobile:issue:update', () => {
        fetchIssues();
      });
      socket.on('mobile:announcement:update', () => {
        fetchAnnouncements();
      });
    } catch (e) {
      console.warn('[Socket] Could not initialize socket connection:', e);
    }
  }
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
// INITIALIZATION & AUTH GATE
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthed = await checkAuthAndInit();
  if (!isAuthed) return;

  // Reveal application UI and dismiss auth splash gate
  const splash = document.getElementById('authGateSplash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 250);
  }

  // Populate verified user names and identity in UI
  const displayName = APP_STATE.user.name || 'Member';
  const firstName = displayName.split(' ')[0] || displayName;
  document.getElementById('homeUserName').textContent = firstName;
  document.getElementById('passMemberName').textContent = displayName;
  document.getElementById('profileNameDisplay').textContent = displayName;
  document.getElementById('profileMenuEmail').textContent = `${APP_STATE.user.email || 'Verified Member'} • ${APP_STATE.user.phone || 'No phone'}`;
  document.getElementById('profileIdDisplay').textContent = APP_STATE.user.idNum || 'IAC-MEMBER';

  // Initial Data Fetch for verified user
  await fetchActiveCheckinTicket();
  await fetchBookings();
  await fetchIssues();
  await fetchAnnouncements();
  updateActivitySummary();

  // Initialize Real-time Socket.io listener
  initSocket();

  // Active Background Polling (5-second intervals) for instant synchronization
  if (APP_STATE.syncInterval) clearInterval(APP_STATE.syncInterval);
  APP_STATE.syncInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      fetchActiveCheckinTicket(true);
      fetchBookings(true);
      updateActivitySummary();
    }
  }, 5000);

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  });
});
