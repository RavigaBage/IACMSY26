import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import {
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Plus,
  Trash2,
  Edit2,
  Mail,
  Megaphone,
  AlertTriangle,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Server,
  Key,
  Check,
  Sparkles,
  QrCode,
  UserCheck,
  Bell,
} from 'lucide-react';

interface CheckinTicket {
  _id: string;
  mobileUserId: string;
  mobileUserName: string;
  mobileUserEmail: string;
  ticketCode: string;
  status: 'pending' | 'confirmed' | 'declined' | 'checked_out' | 'expired';
  requestedAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  declinedAt?: string;
  declinedBy?: string;
  declinedReason?: string;
  checkedOutAt?: string;
}

interface Issue {
  _id: string;
  reporterId?: string;
  reporterName: string;
  category: 'Equipment' | 'Facility' | 'Software' | 'Cleanliness' | 'General';
  description: string;
  status: 'seen' | 'pending' | 'resolved';
  upvotesCount: number;
  downvotesCount: number;
  createdAt: string;
  userVote?: 'up' | 'down' | null;
}

interface Announcement {
  _id: string;
  category: 'pinned' | 'event' | 'class' | 'notice';
  title: string;
  description: string;
  imageUrl?: string | null;
  startsAt?: string;
  endsAt?: string;
  sortOrder: number;
  isActive: boolean;
}

interface BookingRequest {
  _id: string;
  mobileUserId: string;
  mobileUserName: string;
  contactEmail: string;
  roomNumber: string;
  roomType: string;
  requestedDate: string;
  requestedSlot: string;
  arrivalTime?: string;
  programName: string;
  description: string;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: string;
}

interface SmtpForm {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

interface AdminNotification {
  id: string;
  type: 'checkin' | 'booking' | 'issue';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  targetTab: 'checkins' | 'bookings' | 'issues';
}

export default function IacMobile() {
  const [activeTab, setActiveTab] = useState<
    'checkins' | 'bookings' | 'issues' | 'announcements' | 'smtp' | 'simulator'
  >('checkins');

  // Notification state
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  // Tracking previous data for real-time notification alerts
  const prevTicketIdsRef = useRef<Set<string> | null>(null);
  const prevBookingIdsRef = useRef<Set<string> | null>(null);
  const prevIssueIdsRef = useRef<Set<string> | null>(null);

  // Checkin Tickets
  const [tickets, setTickets] = useState<CheckinTicket[]>([]);
  const [ticketFilter, setTicketFilter] = useState<'pending' | 'all'>('pending');
  const [staffNameInput, setStaffNameInput] = useState<string>('Staff Admin');
  const [decliningTicketId, setDecliningTicketId] = useState<string | null>(null);
  const [ticketDeclineReason, setTicketDeclineReason] = useState<string>('');

  // Booking Requests
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [bookingFilter, setBookingFilter] = useState<'pending' | 'all'>('pending');
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Issues
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issueFilter, setIssueFilter] = useState<string>('all');

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnoModal, setShowAnnoModal] = useState<boolean>(false);
  const [editingAnno, setEditingAnno] = useState<Partial<Announcement> | null>(null);

  // SMTP Settings
  const [smtpConfig, setSmtpConfig] = useState<SmtpForm>({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromEmail: '',
    fromName: 'IAC Mobile System',
  });
  const [testEmailAddress, setTestEmailAddress] = useState<string>('');
  const [testEmailLoading, setTestEmailLoading] = useState<boolean>(false);

  // Mobile App Simulator State
  const [simUserId] = useState<string>('sim_user_99');
  const [simUserName, setSimUserName] = useState<string>('Alex Johnson');
  const [simUserEmail, setSimUserEmail] = useState<string>('alex.johnson@example.com');
  const [simTicket, setSimTicket] = useState<CheckinTicket | null>(null);
  const [simNewIssueDesc, setSimNewIssueDesc] = useState<string>('');
  const [simNewIssueCat, setSimNewIssueCat] = useState<Issue['category']>('General');
  const [simBookingRoom, setSimBookingRoom] = useState<string>('3');
  const [simBookingDate, setSimBookingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [simBookingSlot, setSimBookingSlot] = useState<string>('09:00 - 10:00');
  const [simBookingProgram, setSimBookingProgram] = useState<string>('Study Session');

  // Global UI alerts
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // Helper to add new notification
  const addNotification = (
    type: 'checkin' | 'booking' | 'issue',
    title: string,
    message: string,
    targetTab: 'checkins' | 'bookings' | 'issues'
  ) => {
    const newNotif: AdminNotification = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      type,
      title,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      targetTab,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Fetch Data (with change detection for notifications)
  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const [ticketResult, bookingResult, issueResult] = await Promise.allSettled([
        api.get('/api/iac-mobile/checkin-tickets'),
        api.get('/api/iac-mobile/booking-requests'),
        api.get(`/api/iac-mobile/issues?mobileUserId=${simUserId}`),
      ]);

      if (ticketResult.status === 'fulfilled' && ticketResult.value) {
        const ticketList: CheckinTicket[] = Array.isArray(ticketResult.value)
          ? ticketResult.value
          : [];

        if (prevTicketIdsRef.current !== null) {
          ticketList.forEach((t) => {
            if (t.status === 'pending' && !prevTicketIdsRef.current!.has(t._id)) {
              addNotification(
                'checkin',
                'New Check-in Request',
                `${t.mobileUserName} (${t.ticketCode}) requested lounge check-in.`,
                'checkins'
              );
            }
          });
        }
        prevTicketIdsRef.current = new Set(ticketList.map((t) => t._id));
        setTickets(ticketList);
      }

      if (bookingResult.status === 'fulfilled' && bookingResult.value) {
        const bookingList: BookingRequest[] = Array.isArray(bookingResult.value)
          ? bookingResult.value
          : [];

        if (prevBookingIdsRef.current !== null) {
          bookingList.forEach((b) => {
            if (b.status === 'pending' && !prevBookingIdsRef.current!.has(b._id)) {
              addNotification(
                'booking',
                'New Room Booking Request',
                `${b.mobileUserName} requested Room ${b.roomNumber} (${b.programName}).`,
                'bookings'
              );
            }
          });
        }
        prevBookingIdsRef.current = new Set(bookingList.map((b) => b._id));
        setBookings(bookingList);
      }

      if (issueResult.status === 'fulfilled' && issueResult.value) {
        const issueList: Issue[] = Array.isArray(issueResult.value)
          ? issueResult.value
          : [];

        if (prevIssueIdsRef.current !== null) {
          issueList.forEach((i) => {
            if (!prevIssueIdsRef.current!.has(i._id)) {
              addNotification(
                'issue',
                'New Issue Report',
                `${i.reporterName} reported: ${i.description.slice(0, 45)}...`,
                'issues'
              );
            }
          });
        }
        prevIssueIdsRef.current = new Set(issueList.map((i) => i._id));
        setIssues(issueList);
      }

      // Announcements & SMTP Config (only fetched on initial load / manual refresh)
      if (isManual || prevTicketIdsRef.current === null) {
        const [annoResult, smtpResult] = await Promise.allSettled([
          api.get('/api/iac-mobile/admin/announcements'),
          api.get('/api/iac-mobile/smtp-config'),
        ]);

        if (annoResult.status === 'fulfilled' && annoResult.value) {
          const annoList = Array.isArray(annoResult.value) ? annoResult.value : [];
          setAnnouncements(annoList);
        }

        if (smtpResult.status === 'fulfilled' && smtpResult.value) {
          const data = smtpResult.value;
          if (data && typeof data === 'object') {
            setSmtpConfig({
              host: data.host || 'smtp.gmail.com',
              port: data.port || 587,
              secure: data.secure || false,
              user: data.user || '',
              pass: data.pass || '',
              fromEmail: data.fromEmail || '',
              fromName: data.fromName || 'IAC Mobile System',
            });
          }
        }
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (!msg.includes('<!DOCTYPE') && !msg.includes('<body') && !msg.includes('Unexpected token')) {
        console.warn('Error fetching IAC mobile data:', msg);
      }
    } finally {
      if (isManual) setLoading(false);
    }
  }, [simUserId]);

  // Real-time polling effect (15 second interval, active only when tab is visible)
  useEffect(() => {
    fetchData(true);

    const interval = setInterval(() => {
      // Pause background requests if user is in another tab or minimized
      if (document.visibilityState === 'visible') {
        fetchData(false);
      }
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Checkin Actions
  const handleConfirmTicket = async (ticketId: string) => {
    try {
      await api.post(`/api/iac-mobile/checkin-tickets/${ticketId}/confirm`, {
        staffName: staffNameInput,
      });

      showAlert('success', 'Check-in ticket confirmed! Added to Lounge records & streak updated.');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to confirm check-in');
    }
  };

  const handleDeclineTicket = async (ticketId: string) => {
    try {
      await api.post(`/api/iac-mobile/checkin-tickets/${ticketId}/decline`, {
        staffName: staffNameInput,
        reason: ticketDeclineReason || 'Declined by administrator',
      });

      showAlert('success', 'Check-in ticket declined.');
      setDecliningTicketId(null);
      setTicketDeclineReason('');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to decline check-in ticket');
    }
  };

  // Booking Actions
  const handleConfirmBooking = async (bookingId: string) => {
    try {
      await api.post(`/api/iac-mobile/booking-requests/${bookingId}/confirm`, {});

      showAlert('success', 'Booking approved & added to production calendar! Email dispatched.');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to confirm booking request');
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    try {
      await api.post(`/api/iac-mobile/booking-requests/${bookingId}/reject`, {
        reason: rejectionReason,
      });

      showAlert('success', 'Booking request declined and notification email sent.');
      setRejectingBookingId(null);
      setRejectionReason('');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to reject booking request');
    }
  };

  // Issue Status Action
  const handleUpdateIssueStatus = async (issueId: string, status: Issue['status']) => {
    try {
      await api.patch(`/api/iac-mobile/issues/${issueId}/status`, { status });

      showAlert('success', `Issue status updated to ${status}.`);
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to update issue status');
    }
  };

  // Vote Issue Action
  const handleVoteIssue = async (issueId: string, direction: 'up' | 'down') => {
    try {
      await api.post(`/api/iac-mobile/issues/${issueId}/vote`, {
        mobileUserId: simUserId,
        direction,
      });

      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to register vote');
    }
  };

  // Announcement Actions
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnno?.title || !editingAnno?.description) {
      showAlert('error', 'Title and description are required.');
      return;
    }

    try {
      const isEdit = Boolean(editingAnno._id);
      if (isEdit) {
        await api.put(`/api/iac-mobile/announcements/${editingAnno._id}`, editingAnno);
      } else {
        await api.post('/api/iac-mobile/announcements', editingAnno);
      }

      showAlert(
        'success',
        isEdit ? 'Announcement updated!' : 'New announcement added to mobile slider!'
      );
      setShowAnnoModal(false);
      setEditingAnno(null);
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to save announcement');
    }
  };

  const handleDeleteAnnouncement = async (annoId: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/api/iac-mobile/announcements/${annoId}`);

      showAlert('success', 'Announcement removed.');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to delete announcement');
    }
  };

  // SMTP Actions
  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/iac-mobile/smtp-config', smtpConfig);

      showAlert('success', 'SMTP settings saved successfully!');
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to save SMTP settings');
    }
  };

  const handleTestSmtp = async () => {
    if (!testEmailAddress) {
      showAlert('error', 'Please enter a test email address.');
      return;
    }

    setTestEmailLoading(true);
    try {
      await api.post('/api/iac-mobile/smtp-config/test', {
        testEmail: testEmailAddress,
      });

      showAlert('success', `Test email sent successfully to ${testEmailAddress}!`);
    } catch (err: any) {
      showAlert('error', err.message || 'Test email failed');
    } finally {
      setTestEmailLoading(false);
    }
  };

  // Simulator User Actions
  const handleSimRequestCheckin = async () => {
    try {
      const ticketData = await api.post('/api/iac-mobile/checkin-tickets', {
        mobileUserId: simUserId,
        mobileUserName: simUserName,
        mobileUserEmail: simUserEmail,
      });

      setSimTicket(ticketData);
      showAlert('success', `Pass created with code ${ticketData.ticketCode}! Visible in Admin Queue.`);
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Check-in request failed');
    }
  };

  const handleSimSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simNewIssueDesc) return;
    try {
      await api.post('/api/iac-mobile/issues', {
        reporterId: simUserId,
        reporterName: simUserName,
        category: simNewIssueCat,
        description: simNewIssueDesc,
      });

      setSimNewIssueDesc('');
      showAlert('success', 'Issue posted to the IAC mobile community board!');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Failed to submit issue');
    }
  };

  const handleSimSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/iac-mobile/booking-requests', {
        mobileUserId: simUserId,
        mobileUserName: simUserName,
        contactEmail: simUserEmail,
        roomNumber: simBookingRoom,
        requestedDate: simBookingDate,
        requestedSlot: simBookingSlot,
        programName: simBookingProgram,
      });

      showAlert('success', 'Booking request submitted to admin review queue!');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Booking request failed');
    }
  };

  const filteredTickets = tickets.filter((t) => (ticketFilter === 'pending' ? t.status === 'pending' : true));
  const filteredBookings = bookings.filter((b) => (bookingFilter === 'pending' ? b.status === 'pending' : true));
  const filteredIssues = issues.filter((i) => (issueFilter === 'all' ? true : i.category === issueFilter));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 text-zinc-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-zinc-900 text-white rounded-xl shadow-md">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">IAC Mobile Management</h1>
            <p className="text-zinc-500 text-sm">
              Control center for the IAC Mobile App: Check-ins, Bookings, Issues, Announcements & Email
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Admin Notification Center Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors shadow-sm text-zinc-600 flex items-center justify-center"
              title="Notification Center"
            >
              <Bell className="w-5 h-5 text-zinc-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Drawer */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white border border-zinc-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="p-3.5 bg-zinc-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-sky-400" />
                    <span className="font-semibold text-sm">Notifications ({unreadCount} unread)</span>
                  </div>
                  {notifications.length > 0 && (
                    <button
                      onClick={markAllNotificationsRead}
                      className="text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-400">
                      No new notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setActiveTab(n.targetTab);
                          markNotificationRead(n.id);
                          setShowNotifications(false);
                        }}
                        className={`p-3.5 text-xs cursor-pointer hover:bg-zinc-50 transition-colors flex gap-3 ${
                          !n.read ? 'bg-sky-50/60 font-medium' : ''
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {n.type === 'checkin' && <QrCode className="w-4 h-4 text-emerald-600" />}
                          {n.type === 'booking' && <Calendar className="w-4 h-4 text-amber-600" />}
                          {n.type === 'issue' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center justify-between font-semibold text-zinc-900">
                            <span>{n.title}</span>
                            <span className="text-[10px] text-zinc-400 font-normal">{n.timestamp}</span>
                          </div>
                          <p className="text-zinc-600 text-[11px] line-clamp-2">{n.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : 'text-zinc-500'}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Global Alert Notification */}
      {alert && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 border shadow-sm transition-all ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {alert.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span className="text-sm font-medium">{alert.message}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-100 scrollbar-none">
        {[
          { id: 'checkins', label: 'Check-in Queue', icon: QrCode, badge: tickets.filter((t) => t.status === 'pending').length },
          { id: 'bookings', label: 'Booking Requests', icon: Calendar, badge: bookings.filter((b) => b.status === 'pending').length },
          { id: 'issues', label: 'Issues Board', icon: AlertTriangle, badge: issues.filter((i) => i.status === 'pending').length },
          { id: 'announcements', label: 'Announcements', icon: Megaphone, badge: announcements.length },
          { id: 'smtp', label: 'Email & SMTP', icon: Mail },
          { id: 'simulator', label: 'App Simulator', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'bg-white text-zinc-600 border border-zinc-200/80 hover:bg-zinc-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-zinc-400'}`} />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`ml-1 px-2 py-0.5 text-xs font-semibold rounded-full ${
                    isActive ? 'bg-sky-500 text-white' : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: CHECK-IN QUEUE */}
      {activeTab === 'checkins' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Mobile Check-in Tickets</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Confirming a ticket logs the visitor into the primary Lounge Check-in system and increments their streak.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTicketFilter('pending')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  ticketFilter === 'pending'
                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                    : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                Pending Queue ({tickets.filter((t) => t.status === 'pending').length})
              </button>
              <button
                onClick={() => setTicketFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  ticketFilter === 'all'
                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                    : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                All Passes ({tickets.length})
              </button>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-12 text-center">
              <UserCheck className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-zinc-800">No Check-in Tickets Found</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                {ticketFilter === 'pending'
                  ? 'All pending mobile passes have been verified! Use the Simulator tab to test creating a pass.'
                  : 'No tickets registered in the database yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket._id}
                  className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-sm space-y-4 hover:border-zinc-300 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-sky-50 text-sky-700 rounded-xl border border-sky-100 font-mono font-bold text-lg">
                        {ticket.ticketCode}
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900">{ticket.mobileUserName}</h4>
                        <p className="text-xs text-zinc-500">{ticket.mobileUserEmail || 'No email provided'}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${
                        ticket.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : ticket.status === 'pending'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : ticket.status === 'declined'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-500 space-y-1 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                    <p className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      Requested: {new Date(ticket.requestedAt).toLocaleString()}
                    </p>
                    {ticket.confirmedAt && (
                      <p className="flex items-center gap-1.5 text-emerald-700 font-medium">
                        <Check className="w-3.5 h-3.5" />
                        Confirmed: {new Date(ticket.confirmedAt).toLocaleString()} by {ticket.confirmedBy}
                      </p>
                    )}
                    {ticket.declinedAt && (
                      <p className="flex items-center gap-1.5 text-rose-700 font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        Declined: {new Date(ticket.declinedAt).toLocaleString()} {ticket.declinedBy ? `by ${ticket.declinedBy}` : ''}
                      </p>
                    )}
                    {ticket.declinedReason && (
                      <p className="text-[11px] text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-100">
                        Reason: {ticket.declinedReason}
                      </p>
                    )}
                  </div>

                  {ticket.status === 'pending' && (
                    <div className="pt-2 border-t border-zinc-100 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={staffNameInput}
                            onChange={(e) => setStaffNameInput(e.target.value)}
                            placeholder="Staff Name"
                            className="w-full text-xs px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                          />
                        </div>
                        <button
                          onClick={() => handleConfirmTicket(ticket._id)}
                          className="px-3.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm shrink-0 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Confirm & Log
                        </button>
                        <button
                          onClick={() => {
                            if (decliningTicketId === ticket._id) {
                              setDecliningTicketId(null);
                            } else {
                              setDecliningTicketId(ticket._id);
                              setTicketDeclineReason('');
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-sm shrink-0 flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Decline
                        </button>
                      </div>

                      {decliningTicketId === ticket._id && (
                        <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2 animate-fadeIn">
                          <p className="text-xs font-bold text-rose-900">Decline Check-in Ticket</p>
                          <input
                            type="text"
                            value={ticketDeclineReason}
                            onChange={(e) => setTicketDeclineReason(e.target.value)}
                            placeholder="Reason for declining (optional)"
                            className="w-full text-xs px-3 py-1.5 rounded-lg border border-rose-300 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDecliningTicketId(null)}
                              className="px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeclineTicket(ticket._id)}
                              className="px-3 py-1 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 shadow-sm"
                            >
                              Confirm Decline
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BOOKING REQUESTS */}
      {activeTab === 'bookings' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Mobile Room Reservation Requests</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Review pending requests from mobile users. Approving writes directly to the core booking engine & emails the user.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBookingFilter('pending')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  bookingFilter === 'pending'
                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                    : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                Pending ({bookings.filter((b) => b.status === 'pending').length})
              </button>
              <button
                onClick={() => setBookingFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  bookingFilter === 'all'
                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                    : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                All ({bookings.length})
              </button>
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-12 text-center">
              <Calendar className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-zinc-800">No Booking Requests</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                {bookingFilter === 'pending'
                  ? 'There are no pending booking requests from mobile users.'
                  : 'No mobile booking requests recorded.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((b) => (
                <div
                  key={b._id}
                  className="bg-white rounded-2xl border border-zinc-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-zinc-300 transition-all"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-0.5 text-xs font-bold rounded-full capitalize ${
                          b.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {b.status}
                      </span>
                      <h3 className="font-bold text-base text-zinc-900">{b.programName}</h3>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-zinc-600 bg-zinc-50 p-3 rounded-xl">
                      <div>
                        <span className="text-zinc-400 block">Requested By</span>
                        <span className="font-medium text-zinc-800">{b.mobileUserName}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block">Contact Email</span>
                        <span className="font-medium text-zinc-800 truncate block">{b.contactEmail}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block">Target Room</span>
                        <span className="font-medium text-zinc-800">Room {b.roomNumber} ({b.roomType})</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block">Date & Time</span>
                        <span className="font-medium text-zinc-800">
                          {new Date(b.requestedDate).toLocaleDateString()} @ {b.arrivalTime || b.requestedSlot}
                        </span>
                      </div>
                    </div>
                  </div>

                  {b.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleConfirmBooking(b._id)}
                        className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm & Email
                      </button>
                      <button
                        onClick={() => setRejectingBookingId(b._id)}
                        className="px-4 py-2 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Rejection Modal */}
          {rejectingBookingId && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200 space-y-4">
                <h3 className="text-lg font-bold text-zinc-900">Decline Reservation Request</h3>
                <p className="text-xs text-zinc-500">
                  Provide an optional reason that will be included in the automated refusal email to the applicant.
                </p>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Room is under maintenance or requested slot is reserved for staff meeting."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setRejectingBookingId(null)}
                    className="px-4 py-2 text-xs font-medium bg-zinc-100 text-zinc-700 rounded-xl hover:bg-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRejectBooking(rejectingBookingId)}
                    className="px-4 py-2 text-xs font-medium bg-red-600 text-white rounded-xl hover:bg-red-700"
                  >
                    Send Decline Email
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ISSUES BOARD */}
      {activeTab === 'issues' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Community Reports & Issues</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Issues reported from the mobile app. Update status to Seen, Pending, or Resolved.
              </p>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {['all', 'Equipment', 'Facility', 'Software', 'Cleanliness', 'General'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setIssueFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize whitespace-nowrap transition-colors ${
                    issueFilter === cat
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {filteredIssues.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-zinc-800">No Issues Reported</h3>
              <p className="text-xs text-zinc-500 mt-1">No community reports matching this category filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredIssues.map((issue) => (
                <div
                  key={issue._id}
                  className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 text-xs font-bold bg-zinc-100 text-zinc-800 rounded-md">
                        {issue.category}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize ${
                          issue.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : issue.status === 'seen'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {issue.status}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-800 font-medium leading-relaxed">{issue.description}</p>

                    <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-100">
                      <span>Reported by: {issue.reporterName}</span>
                      <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
                    {/* Voting status */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 bg-zinc-50 p-1 rounded-lg border border-zinc-200">
                      <button
                        onClick={() => handleVoteIssue(issue._id, 'up')}
                        disabled={issue.status === 'resolved'}
                        className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                          issue.userVote === 'up'
                            ? 'bg-emerald-600 text-white'
                            : 'hover:bg-zinc-200 text-emerald-700'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> {issue.upvotesCount}
                      </button>
                      <button
                        onClick={() => handleVoteIssue(issue._id, 'down')}
                        disabled={issue.status === 'resolved'}
                        className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                          issue.userVote === 'down'
                            ? 'bg-rose-600 text-white'
                            : 'hover:bg-zinc-200 text-rose-700'
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" /> {issue.downvotesCount}
                      </button>
                    </div>

                    {/* Admin Status Toggle */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateIssueStatus(issue._id, 'seen')}
                        className={`px-2.5 py-1 text-xs rounded-lg border font-medium ${
                          issue.status === 'seen'
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                        }`}
                      >
                        Seen
                      </button>
                      <button
                        onClick={() => handleUpdateIssueStatus(issue._id, 'pending')}
                        className={`px-2.5 py-1 text-xs rounded-lg border font-medium ${
                          issue.status === 'pending'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                        }`}
                      >
                        Pending
                      </button>
                      <button
                        onClick={() => handleUpdateIssueStatus(issue._id, 'resolved')}
                        className={`px-2.5 py-1 text-xs rounded-lg border font-medium ${
                          issue.status === 'resolved'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                        }`}
                      >
                        Resolved
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Mobile Slider Announcements</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Manage pinned banners, events, classes, and notices displayed on the mobile app carousel.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingAnno({
                  category: 'notice',
                  title: '',
                  description: '',
                  imageUrl: '',
                  sortOrder: 0,
                  isActive: true,
                });
                setShowAnnoModal(true);
              }}
              className="px-4 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-2 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              New Announcement
            </button>
          </div>

          {announcements.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200/80 p-12 text-center">
              <Megaphone className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-zinc-800">No Announcements Created</h3>
              <p className="text-xs text-zinc-500 mt-1">Create an announcement to broadcast news to mobile users.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {announcements.map((anno) => (
                <div
                  key={anno._id}
                  className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-sm flex flex-col justify-between"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider ${
                          anno.category === 'pinned'
                            ? 'bg-purple-100 text-purple-800'
                            : anno.category === 'event'
                            ? 'bg-emerald-100 text-emerald-800'
                            : anno.category === 'class'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {anno.category}
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">Order: {anno.sortOrder}</span>
                    </div>

                    <h3 className="font-bold text-base text-zinc-900">{anno.title}</h3>
                    <p className="text-xs text-zinc-600 line-clamp-3 leading-relaxed">{anno.description}</p>

                    {anno.imageUrl && (
                      <img
                        src={anno.imageUrl}
                        alt="Preview"
                        className="w-full h-28 object-cover rounded-xl border border-zinc-200"
                      />
                    )}
                  </div>

                  <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${anno.isActive ? 'text-emerald-600' : 'text-zinc-400'}`}
                    >
                      {anno.isActive ? '● Active' : '○ Inactive'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingAnno(anno);
                          setShowAnnoModal(true);
                        }}
                        className="p-1.5 text-zinc-600 hover:bg-zinc-200 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(anno._id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Announcement Modal */}
          {showAnnoModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-zinc-200 space-y-4 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold text-zinc-900">
                  {editingAnno?._id ? 'Edit Announcement' : 'Create New Announcement'}
                </h3>

                <form onSubmit={handleSaveAnnouncement} className="space-y-4 text-xs">
                  <div>
                    <label className="font-semibold text-zinc-700 block mb-1">Category</label>
                    <select
                      value={editingAnno?.category || 'notice'}
                      onChange={(e) =>
                        setEditingAnno({ ...editingAnno, category: e.target.value as any })
                      }
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-medium"
                    >
                      <option value="notice">Notice</option>
                      <option value="pinned">Pinned</option>
                      <option value="event">Event</option>
                      <option value="class">Class</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-700 block mb-1">Title</label>
                    <input
                      type="text"
                      value={editingAnno?.title || ''}
                      onChange={(e) => setEditingAnno({ ...editingAnno, title: e.target.value })}
                      placeholder="Announcement Headline"
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-700 block mb-1">Description</label>
                    <textarea
                      value={editingAnno?.description || ''}
                      onChange={(e) => setEditingAnno({ ...editingAnno, description: e.target.value })}
                      placeholder="Detailed content for mobile users..."
                      rows={3}
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-700 block mb-1">Image URL (Optional)</label>
                    <input
                      type="url"
                      value={editingAnno?.imageUrl || ''}
                      onChange={(e) => setEditingAnno({ ...editingAnno, imageUrl: e.target.value })}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-zinc-700 block mb-1">Sort Order</label>
                      <input
                        type="number"
                        value={editingAnno?.sortOrder || 0}
                        onChange={(e) =>
                          setEditingAnno({ ...editingAnno, sortOrder: Number(e.target.value) })
                        }
                        className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-medium"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 font-semibold text-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingAnno?.isActive ?? true}
                          onChange={(e) =>
                            setEditingAnno({ ...editingAnno, isActive: e.target.checked })
                          }
                          className="rounded text-zinc-900 focus:ring-0 w-4 h-4"
                        />
                        Active on Mobile
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => setShowAnnoModal(false)}
                      className="px-4 py-2 text-xs font-medium bg-zinc-100 text-zinc-700 rounded-xl hover:bg-zinc-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-xl hover:bg-zinc-800"
                    >
                      Save Announcement
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SMTP / EMAIL SETTINGS */}
      {activeTab === 'smtp' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-sm space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 pb-4 border-b border-zinc-100">
              <div className="p-3 bg-sky-50 text-sky-700 rounded-xl">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Gmail / SMTP Server Credentials</h2>
                <p className="text-xs text-zinc-500">
                  Configure the mail server for automated booking confirmation and rejection notifications.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSmtp} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">SMTP Host</label>
                  <input
                    type="text"
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Port</label>
                  <input
                    type="number"
                    value={smtpConfig.port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, port: Number(e.target.value) })}
                    placeholder="587"
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">SMTP User / Gmail Address</label>
                  <input
                    type="email"
                    value={smtpConfig.user}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                    placeholder="admin@example.com"
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">
                    App Password / SMTP Password
                  </label>
                  <input
                    type="password"
                    value={smtpConfig.pass}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">From Email Address</label>
                  <input
                    type="email"
                    value={smtpConfig.fromEmail}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                    placeholder="noreply@iac.org"
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50"
                  />
                </div>
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">Sender Display Name</label>
                  <input
                    type="text"
                    value={smtpConfig.fromName}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                    placeholder="IAC System Notifications"
                    className="w-full p-2.5 rounded-xl border border-zinc-200 bg-zinc-50"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-semibold bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  Save SMTP Credentials
                </button>
              </div>
            </form>

            {/* Test Email Section */}
            <div className="pt-6 border-t border-zinc-100 space-y-3">
              <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-600" /> Test Mail Delivery
              </h3>
              <p className="text-xs text-zinc-500">
                Send an immediate test email to verify your SMTP server configuration.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="Enter recipient email address"
                  className="flex-1 p-2.5 text-xs rounded-xl border border-zinc-200 bg-zinc-50"
                />
                <button
                  onClick={handleTestSmtp}
                  disabled={testEmailLoading}
                  className="px-4 py-2.5 text-xs font-semibold bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors shadow-sm shrink-0 flex items-center gap-1.5"
                >
                  <Send className={`w-3.5 h-3.5 ${testEmailLoading ? 'animate-bounce' : ''}`} />
                  {testEmailLoading ? 'Sending...' : 'Send Test Mail'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: MOBILE APP SIMULATOR / TESTER */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <h2 className="text-lg font-bold text-zinc-900">IAC Mobile App (White &amp; Yellow Edition)</h2>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                5-Screen Mobile Architecture: Home, Check-In, Bookings, Facility Help / Issues, and Member Profile.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-zinc-50 px-2 py-1 rounded-xl border border-zinc-200 text-xs">
                <span className="text-zinc-500 font-medium">Test User:</span>
                <input
                  type="text"
                  value={simUserName}
                  onChange={(e) => setSimUserName(e.target.value)}
                  className="w-24 p-1 rounded border border-zinc-300 font-medium bg-white text-xs"
                />
                <input
                  type="email"
                  value={simUserEmail}
                  onChange={(e) => setSimUserEmail(e.target.value)}
                  className="w-36 p-1 rounded border border-zinc-300 font-medium bg-white text-xs"
                />
              </div>
              <a
                href="/iacmobile-app/"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 text-xs font-bold bg-amber-400 text-zinc-900 hover:bg-amber-500 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <span>Open Fullscreen Mobile Web</span>
                <span className="text-xs">↗</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Phone Device Frame */}
            <div className="lg:col-span-6 xl:col-span-5 flex justify-center">
              <div className="w-full max-w-[390px] bg-zinc-950 rounded-[44px] p-3 shadow-2xl border-4 border-zinc-800">
                {/* Notch */}
                <div className="w-28 h-4 bg-zinc-900 mx-auto rounded-b-xl mb-2 flex items-center justify-center">
                  <div className="w-8 h-1 bg-zinc-700 rounded-full" />
                </div>

                {/* Live Mobile Screen running the white & yellow app */}
                <div className="bg-white rounded-[28px] overflow-hidden shadow-inner flex flex-col">
                  <iframe
                    src="/iacmobile-app/"
                    title="IAC Mobile Preview"
                    className="w-full h-[640px] border-none bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Interactive Forms & Test Triggers */}
            <div className="lg:col-span-6 xl:col-span-7 space-y-4">
              {/* Checkin Trigger Card */}
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-amber-500" /> Fast Digital Pass Generator
                  </h3>
                  <button
                    onClick={handleSimRequestCheckin}
                    className="px-3 py-1.5 text-xs font-bold bg-amber-400 text-zinc-900 rounded-lg hover:bg-amber-500"
                  >
                    Generate Pass
                  </button>
                </div>
                {simTicket ? (
                  <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-center space-y-1">
                    <span className="text-[10px] text-amber-700 block font-bold">LATEST GENERATED TICKET</span>
                    <span className="text-base font-extrabold font-mono text-zinc-900 tracking-wider">
                      {simTicket.ticketCode}
                    </span>
                    <span className="text-[10px] block font-semibold text-emerald-700 capitalize">
                      Status: {simTicket.status}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Generates a live check-in pass for {simUserName} into the real database queue.</p>
                )}
              </div>

              {/* Report Issue Form */}
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
                <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Post Community Report
                </h3>
                <form onSubmit={handleSimSubmitIssue} className="space-y-3 text-xs">
                  <div>
                    <label className="font-medium text-zinc-600 block mb-1">Category</label>
                    <select
                      value={simNewIssueCat}
                      onChange={(e) => setSimNewIssueCat(e.target.value as any)}
                      className="w-full p-2 rounded-lg border border-zinc-200 bg-zinc-50"
                    >
                      <option value="General">General</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Facility">Facility</option>
                      <option value="Software">Software</option>
                      <option value="Cleanliness">Cleanliness</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-zinc-600 block mb-1">Description</label>
                    <textarea
                      value={simNewIssueDesc}
                      onChange={(e) => setSimNewIssueDesc(e.target.value)}
                      placeholder="e.g. Lounge Workstation #4 headphone jack loose"
                      rows={2}
                      className="w-full p-2 rounded-lg border border-zinc-200 bg-zinc-50"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-400 text-zinc-900 font-bold rounded-lg hover:bg-amber-500"
                  >
                    Post Issue
                  </button>
                </form>
              </div>

              {/* Booking Request Form */}
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
                <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" /> Test Room Booking Submission
                </h3>
                <form onSubmit={handleSimSubmitBooking} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-medium text-zinc-600 block mb-1">Room Number</label>
                      <input
                        type="text"
                        value={simBookingRoom}
                        onChange={(e) => setSimBookingRoom(e.target.value)}
                        className="w-full p-2 rounded-lg border border-zinc-200 bg-zinc-50"
                      />
                    </div>
                    <div>
                      <label className="font-medium text-zinc-600 block mb-1">Time Slot</label>
                      <input
                        type="text"
                        value={simBookingSlot}
                        onChange={(e) => setSimBookingSlot(e.target.value)}
                        className="w-full p-2 rounded-lg border border-zinc-200 bg-zinc-50"
                      />
                    </div>
                    <div>
                      <label className="font-medium text-zinc-600 block mb-1">Program Name</label>
                      <input
                        type="text"
                        value={simBookingProgram}
                        onChange={(e) => setSimBookingProgram(e.target.value)}
                        className="w-full p-2 rounded-lg border border-zinc-200 bg-zinc-50"
                      />
                    </div>
                    <div>
                      <label className="font-medium text-zinc-600 block mb-1">Date</label>
                      <input
                        type="date"
                        value={simBookingDate}
                        onChange={(e) => setSimBookingDate(e.target.value)}
                        className="w-full p-2 rounded-lg border border-zinc-200 bg-zinc-50"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-400 text-zinc-900 font-bold rounded-lg hover:bg-amber-500"
                  >
                    Submit Booking Request
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
