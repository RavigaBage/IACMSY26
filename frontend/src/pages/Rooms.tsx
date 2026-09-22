import { useState, useEffect } from 'react';
import { Calendar, List, Plus, Save, X, Edit2, Trash2, Eye, MonitorPlay, ChevronLeft, ChevronRight, CheckCircle, Search } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Pagination } from '../components/ui/Pagination';
import { useCrud } from '../hooks/useCrud';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, 
  startOfDay 
} from 'date-fns';

const ROOM_INVENTORY = [
  { name: 'Seminar Room 1', type: 'Seminar Room', rate: 200 },
  { name: 'Seminar Room 2', type: 'Seminar Room', rate: 200 },
  { name: 'Seminar Room 3', type: 'Seminar Room', rate: 200 },
  { name: 'Seminar Room 4', type: 'Seminar Room', rate: 200 },
  { name: 'Conference Room', type: 'Conference', rate: 750 },
  { name: 'Training Lab', type: 'Training Lab', rate: 750 },
];

const EVENT_TYPES = [
  "workshop",
  "teaching",
  "meetings",
  "v.conference",
  "discussion",
  "l.institution",
  "it training",
  "project",
];

const CATEGORIES = [
  "programming",
  "data science",
  "networking",
  "robotics",
  "drone",
  "iot",
  "ai",
  "b.computing",
  "others",
];

const BENEFICIARIES = [
  "government officials",
  "senior citizens",
  "local residents",
  "students",
  "business",
  "others",
];


interface Booking {
  _id: string;
  date: string;
  roomType: string;
  rate: number;
  organizer: string;
  presenter: string;
  programName: string;
  participants: number;
  eventType: string;
  category: string;
  beneficiaries: string;
  description: string;
  paymentStatus: 'Unpaid' | 'Paid' | 'Partially Paid';
  amountDue: number;
  endDate:Date;
  startDate:Date;
  status: 'Booked' | 'Occupied' | 'Completed' | 'Cancelled';
}

// Small read-only field used inside the View modal
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-medium text-zinc-900">{value || '—'}</div>
    </div>
  );
}

export default function Rooms() {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  
  const {
    data: bookingsData,
    loading,
    submitting,
    fetchAll: fetchBookings,
    createRecord,
    updateRecord,
    deleteRecord,
  } = useCrud<any>({ endpoint: 'api/bookings/event-program?limit=500' });

  // API returns { status, data: [...] } instead of direct array sometimes.
  const bookings: Booking[] = bookingsData?.data || bookingsData || "";

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRoom, setFilterRoom] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fuzzyFilteredBookings = useFuzzySearch(bookings, searchQuery, {
    keys: ['programName', 'organizer', 'presenter', 'roomType']
  });

  const filteredBookings = fuzzyFilteredBookings.filter(b => {
    if (filterRoom !== 'All' && b.roomType !== filterRoom) return false;
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterRoom]);

  const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE) || 1;
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // View modal state (Read of C.R.U.D)
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);

  const [formData, setFormData] = useState({
    date: '',
    roomType: ROOM_INVENTORY[0].name,
    organizer: '',
    presenter: '',
    programName: '',
    participants: 1,
    eventType: EVENT_TYPES[0],
    category: CATEGORIES[0],
    beneficiaries:'',
    description: '',
    endDate:'',
    startDate:'',
    paymentStatus: 'Unpaid',
  });

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'date' && { startDate: value })
    }));
  };

  const calculateDerivedFields = () => {
    const roomDetails = ROOM_INVENTORY.find(r => r.name === formData.roomType);
    const rate = roomDetails?.rate || 0;
    const amountDue = rate;
    
    // Status Logic
    let status = 'Booked';
    const bDate = startOfDay(new Date(formData.date));
    const today = startOfDay(new Date());
    
    if (bDate < today) status = 'Completed';
    else if (bDate.getTime() === today.getTime()) status = 'Occupied';
    
    return { rate, amountDue, status };
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.endDate) newErrors.endDate = "End Date is required";
    if (!formData.organizer.trim()) newErrors.organizer = "Organizer is required";
    if (!formData.presenter.trim()) newErrors.presenter = "Presenter is required";
    if (!formData.programName.trim()) newErrors.programName = "Program Name is required";
    if (!formData.participants || formData.participants < 1) newErrors.participants = "Must be at least 1";
    if (!formData.beneficiaries || formData.beneficiaries.length === 0) newErrors.beneficiaries = "Select at least one beneficiary";
    console.log('error validating',newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      const derived = calculateDerivedFields();
      const payload = { ...formData, ...derived };

      // Validation: Check double booking
      const conflict = bookings.find(b => 
        b.roomType === formData.roomType && 
        startOfDay(new Date(b.date)).getTime() === startOfDay(new Date(formData.date)).getTime() &&
        b.status !== 'Cancelled' &&
        b._id !== editingId
      );

      if (conflict) {
        console.error(`Room already booked for this date by ${conflict.organizer}`);
        return;
      }

      if (editingId) {
        await updateRecord(editingId, payload, 'api/bookings/event-program');
      } else {
        await createRecord(payload, 'api/bookings/submit-event-program');
      }
      
      handleCancel();
    } catch {
      // handled by useCrud
    }
  };

  const handleEdit = (booking: Booking) => {
    setFormData({
      date: new Date(booking.date).toISOString().slice(0, 10),
      roomType: booking.roomType,
      organizer: booking.organizer,
      presenter: booking.presenter,
      programName: booking.programName,
      participants: booking.participants,
      eventType: booking.eventType,
      category: booking.category,
      beneficiaries: booking.beneficiaries,
      description: booking.description || '',
      endDate:new Date(booking.endDate).toISOString().slice(0, 10),
      startDate:new Date(booking.date).toISOString().slice(0, 10),
      paymentStatus: booking.paymentStatus,
    });
    setEditingId(booking._id);
    setIsFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      await deleteRecord(itemToDelete, 'api/bookings/event-program');
    } catch {
      // handled by useCrud
    } finally {
      setItemToDelete(null);
    }
  };

  const handleTogglePayment = async (booking: Booking) => {
    try {
      const newStatus = booking.paymentStatus === 'Paid' ? 'Unpaid' : 'Paid';
      await updateRecord(booking._id, { paymentStatus: newStatus }, 'api/bookings/event-program');
    } catch {
      // handled by useCrud
    }
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setErrors({});
    setFormData({
      date: '',
      roomType: ROOM_INVENTORY[0].name,
      organizer: '',
      presenter: '',
      programName: '',
      participants: 1,
      eventType: EVENT_TYPES[0],
      category: CATEGORIES[0],
      beneficiaries: "",
      description: '',
      endDate:'',
      startDate:'',
      paymentStatus: 'Unpaid',
    });
  };

  const openNewBooking = (date?: Date) => {
    handleCancel();
    if (date) {
      setFormData(prev => ({ ...prev, date: format(date, 'yyyy-MM-dd') }));
    }
    setIsFormOpen(true);
  };

  // Calendar rendering logic
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        
        // Find bookings for this day
        const dayBookings = filteredBookings.filter(b => 
          isSameDay(new Date(b.startDate), cloneDay) && b.status !== 'Cancelled'
        );

        days.push(
          <div
            key={day.toString()}
            onClick={() => openNewBooking(cloneDay)}
            className={`min-h-[120px] p-2 border border-zinc-200/50 hover:bg-zinc-50 transition-colors cursor-pointer flex flex-col gap-1
              ${!isSameMonth(day, monthStart) ? 'bg-zinc-50 text-zinc-400' : 'bg-white text-zinc-900'}
              ${isSameDay(day, new Date()) ? 'ring-2 ring-inset ring-zinc-900' : ''}
            `}
          >
            <div className="flex justify-between items-start">
              <span className={`text-sm font-medium ${isSameDay(day, new Date()) ? 'bg-zinc-900 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>
                {formattedDate}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto mt-1 flex flex-col gap-1 scrollbar-hide">
              {dayBookings.map((b) => {
                let bg = 'bg-blue-50 text-blue-700 border-blue-200';
                if (b.status === 'Completed') bg = 'bg-zinc-100 text-zinc-600 border-zinc-200';
                if (b.paymentStatus === 'Paid') bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (b.status === 'Occupied') bg = 'bg-amber-50 text-amber-700 border-amber-200';

                return (
                  <div
                    key={b._id}
                    onClick={(e) => { e.stopPropagation(); setViewBooking(b); }}
                    className={`group relative text-xs px-1.5 py-1 rounded border ${bg} flex items-center gap-1 cursor-pointer`}
                    title={`${b.roomType} - ${b.programName}`}
                  >
                    <span className="truncate flex-1 min-w-0">
                      {b.roomType.split(' ')[0]} {b.roomType.split(' ')[1]}: {b.programName}
                    </span>

                    {/* CRUD action icons - revealed on hover, hidden by default to keep the day cell compact */}
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 bg-white/90 rounded px-0.5 -mr-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setViewBooking(b); }}
                        className="p-0.5 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                        title="View"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(b); }}
                        className="p-0.5 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setItemToDelete(b._id); }}
                        className="p-0.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    
    return (
      <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-200/60 bg-zinc-50/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          {rows}
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto transition-opacity duration-500 ease-in-out opacity-100">
      <ConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Booking"
        message="Are you sure you want to delete this booking? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
      />

      {/* View Modal - Read action of C.R.U.D */}
      {viewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-zinc-100 flex items-start justify-between shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">{viewBooking.programName}</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  {viewBooking.roomType} · {format(new Date(viewBooking.date), 'MMMM d, yyyy')}
                </p>
              </div>
              <button
                onClick={() => setViewBooking(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border
                  ${viewBooking.status === 'Completed' ? 'bg-zinc-100 text-zinc-600 border-zinc-200' :
                    viewBooking.status === 'Occupied' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    viewBooking.status === 'Cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
                    'bg-blue-50 text-blue-700 border-blue-200'}
                `}>
                  {viewBooking.status}
                </span>
                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border
                  ${viewBooking.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    viewBooking.paymentStatus === 'Partially Paid' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'}
                `}>
                  {viewBooking.paymentStatus === 'Paid' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {viewBooking.paymentStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <InfoRow label="Organizer" value={viewBooking.organizer} />
                <InfoRow label="Presenter" value={viewBooking.presenter} />
                <InfoRow label="Event Type" value={viewBooking.eventType} />
                <InfoRow label="Category" value={viewBooking.category} />
                <InfoRow label="Participants" value={viewBooking.participants} />
                <InfoRow label="Amount Due" value={`${viewBooking.amountDue ?? viewBooking.rate ?? 0} GHS`} />
                <InfoRow label="Beneficiaries" value={viewBooking.beneficiaries} />
                <InfoRow label="Room" value={viewBooking.roomType} />
                <InfoRow label="Start Date" value={format(new Date(viewBooking.startDate || viewBooking.date), 'MMM d, yyyy')} />
                <InfoRow label="End Date" value={viewBooking.endDate ? format(new Date(viewBooking.endDate), 'MMM d, yyyy') : '—'} />
              </div>

              {viewBooking.description && (
                <div>
                  <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Description</div>
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap">{viewBooking.description}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => { setItemToDelete(viewBooking._id); setViewBooking(null); }}
                className="px-4 py-2 text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={() => { const b = viewBooking; setViewBooking(null); handleEdit(b); }}
                className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
      
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-xl border border-zinc-200/60 shadow-sm">
            <MonitorPlay className="w-6 h-6 text-zinc-900" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Rooms & Facilities</h1>
            <p className="text-zinc-500 text-sm mt-1">Manage bookings for seminar rooms and training labs.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="flex bg-zinc-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          <button 
            onClick={() => {
              if (isFormOpen) handleCancel();
              else openNewBooking();
            }}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors text-sm font-medium flex items-center gap-2"
          >
            {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isFormOpen ? 'Cancel' : 'New Booking'}
          </button>
        </div>
      </header>

      {!isFormOpen && (
        <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-sm">
          <div className="flex-1 relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search bookings by program, organizer, or room..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm"
            />
          </div>
          <select 
            value={filterRoom}
            onChange={e => setFilterRoom(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm bg-white"
          >
            <option value="All">All Rooms</option>
            {ROOM_INVENTORY.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        </div>
      )}

      {viewMode === 'calendar' && !isFormOpen && (
        <div className="mb-6 flex items-center justify-between bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-sm">
          <h2 className="text-xl font-bold text-zinc-900">{format(currentDate, 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-zinc-600"/></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors">Today</button>
            <button onClick={handleNextMonth} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-zinc-600"/></button>
          </div>
        </div>
      )}
      
      {isFormOpen && (
        <div className="mb-8 bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden animate-in slide-in-from-top-4 duration-300">
          <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              {editingId ? 'Edit Booking' : 'New Room Booking'}
            </h2>
            <div className="text-sm text-zinc-500">
              Operating Hours: 8:00 AM – 6:00 PM, Monday to Saturday
            </div>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Date</label>
                <input 
                  type="date" 
                  name="date" 
                  required
                  value={formData.date} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Room</label>
                <select 
                  name="room" 
                  value={formData.roomType} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm bg-white"
                >
                  {ROOM_INVENTORY.map(r => (
                    <option key={r.name} value={r.name}>{r.name} - {r.rate} GHS/day</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Payment Status</label>
                <select 
                  name="paymentStatus" 
                  value={formData.paymentStatus} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm bg-white"
                >
                  <option value="Unpaid">Unpaid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Program / Event Name</label>
                <input 
                  type="text" 
                  name="programName" 
                  required
                  value={formData.programName} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                  placeholder="e.g. Annual Tech Summit"
                />
                {errors.programName && <p className="text-xs text-red-500 mt-1">{errors.programName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Event Organizer</label>
                <input 
                  type="text" 
                  name="organizer" 
                  required
                  value={formData.organizer} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                  placeholder="Name or Organization"
                />
                {errors.organizer && <p className="text-xs text-red-500 mt-1">{errors.organizer}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Presenter / Facilitator</label>
                <input 
                  type="text" 
                  name="presenter" 
                  required
                  value={formData.presenter} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                  placeholder="Name of Presenter"
                />
                {errors.presenter && <p className="text-xs text-red-500 mt-1">{errors.presenter}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Event Type</label>
                <select 
                  name="eventType" 
                  value={formData.eventType} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm bg-white"
                >
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Event Category</label>
                <select 
                  name="category" 
                  value={formData.category} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm bg-white"
                >
                  {CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">No. of Participants</label>
                <input 
                  type="number" 
                  name="participants" 
                  required
                  min="1"
                  value={formData.participants} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                />
                {errors.participants && <p className="text-xs text-red-500 mt-1">{errors.participants}</p>}
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Beneficiaries</label>
                <select 
                  name="beneficiaries" 
                  required
                  value={formData.beneficiaries} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm bg-white"
                >
                  {BENEFICIARIES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                
              </div>
              
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Event Description</label>
                <textarea 
                  name="description" 
                  rows={3}
                  value={formData.description} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                  placeholder="Optional details about the event..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">When does the event End</label>
                <input 
                  type="date" 
                  name="endDate" 
                  required
                  value={formData.endDate} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                />
                {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
              </div>

            </div>
            
            <div className="mt-6 flex items-center justify-between pt-6 border-t border-zinc-100">
              <div className="text-sm font-medium text-zinc-900">
                Amount Due: <span className="text-emerald-600 ml-1">{ROOM_INVENTORY.find(r => r.name === formData.roomType)?.rate || 0} GHS</span>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="px-6 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {submitting ? 'Saving...' : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Booking
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {!isFormOpen && viewMode === 'calendar' && renderCalendar()}

      {!isFormOpen && viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-200/60">
                  <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
                  <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Room</th>
                  <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Program / Organizer</th>
                  <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Payment</th>
                  <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                      <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin mx-auto mb-3"></div>
                      Loading bookings...
                    </td>
                  </tr>
                ) : filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                      <Calendar className="w-8 h-8 mx-auto mb-3 text-zinc-300" />
                      No bookings found.
                    </td>
                  </tr>
                ) : (
                  paginatedBookings.map(booking => (
                    <tr key={booking._id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-900">{format(new Date(booking.date), 'MMM d, yyyy')}</div>
                        <div className="text-xs text-zinc-500">{booking.status}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-zinc-700">{booking.roomType}</div>
                        <div className="text-xs text-zinc-500">{booking.rate} GHS</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-zinc-900">{booking.programName}</div>
                        <div className="text-xs text-zinc-500">{booking.organizer} ({booking.participants} pax)</div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleTogglePayment(booking)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors hover:opacity-80
                            ${booking.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' : 
                              booking.paymentStatus === 'Partially Paid' ? 'bg-amber-50 text-amber-700 border-amber-200/50' :
                              'bg-rose-50 text-rose-700 border-rose-200/50'
                            }
                          `}
                        >
                          {booking.paymentStatus === 'Paid' ? <CheckCircle className="w-3 h-3"/> : null}
                          {booking.paymentStatus}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewBooking(booking)}
                            className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(booking)}
                            className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setItemToDelete(booking._id)}
                            className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 bg-zinc-50/50 border-t border-zinc-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}