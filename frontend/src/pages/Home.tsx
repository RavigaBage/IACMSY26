import { useState, useEffect } from 'react';
import { Users, MonitorPlay, ServerCrash, AlertCircle, RefreshCw, Clock, MapPin } from 'lucide-react';
import { api } from '../lib/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface RecentEvent {
  id: string;
  name: string;
  organizer: string;
  presenter: string;
  roomNumber: number;
  roomType: string;
  participants: number;
  eventType: string;
  status: string;
  date: string;
}

interface SummaryData {
  currentLoungeCount: number;
  totalLoungeUsers: number;
  activeRoomsCount: number;
  totalRoomBookings: number;
  connectedDevicesCount: number;
  pendingReportsCount: number;
  recentEvents: RecentEvent[];
  systemMatrix: {
    hourlyTraffic: Array<{ hour: string; visitors: number }>;
    byRoom: Array<{ roomNumber: string; bookings: number; totalParticipants: number }>;
    byEventType: Array<{ eventType: string; count: number }>;
  };
}

export default function Home() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'traffic' | 'rooms'>('traffic');

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await api.get('api/reports/summary');
      if (res?.summary) {
        setSummary(res.summary);
      }
    } catch {
      // error handled silently or fallback state shown
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Overview</h1>
        </div>
        
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="min-h-[44px] self-start sm:self-auto px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-lg font-medium text-sm flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </header>

      {/* Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lounge Visitors */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              Today
            </span>
          </div>
          <p className="text-xs font-medium text-zinc-500 mb-1">Lounge Visitors</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">
              {loading ? '—' : (summary?.currentLoungeCount ?? 0)}
            </p>
          </div>
          <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-100">
            Total recorded: <span className="font-semibold text-zinc-700">{summary?.totalLoungeUsers ?? 0}</span>
          </p>
        </div>

        {/* Active Rooms */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-emerald-50 rounded-lg">
              <MonitorPlay className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              In Session
            </span>
          </div>
          <p className="text-xs font-medium text-zinc-500 mb-1">Active Rooms</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">
              {loading ? '—' : (summary?.activeRoomsCount ?? 0)}
            </p>
          </div>
          <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-100">
            Bookings: <span className="font-semibold text-zinc-700">{summary?.totalRoomBookings ?? 0}</span>
          </p>
        </div>

        {/* Connected Endpoints */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-purple-50 rounded-lg">
              <ServerCrash className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
              Devices
            </span>
          </div>
          <p className="text-xs font-medium text-zinc-500 mb-1">Connected Endpoints</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">
              {loading ? '—' : (summary?.connectedDevicesCount ?? 0)}
            </p>
          </div>
          <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-100">
            Registered devices
          </p>
        </div>

        {/* System Reports */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-amber-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
              Audit
            </span>
          </div>
          <p className="text-xs font-medium text-zinc-500 mb-1">Generated Reports</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-zinc-900 tracking-tight">
              {loading ? '—' : (summary?.pendingReportsCount ?? 0)}
            </p>
          </div>
          <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-100">
            Export ready
          </p>
        </div>
      </div>

      {/* Main Charts & Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Matrix Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200 shadow-2xs p-4 sm:p-6 min-h-[380px] flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-zinc-900 text-base">Facility Activity</h2>
            </div>
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
              <button
                onClick={() => setActiveTab('traffic')}
                className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'traffic'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Lounge Traffic
              </button>
              <button
                onClick={() => setActiveTab('rooms')}
                className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'rooms'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Room Utilization
              </button>
            </div>
          </div>

          <div className="flex-1 w-full min-h-[260px]">
            {activeTab === 'traffic' ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary?.systemMatrix?.hourlyTraffic || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#FFF', fontSize: '12px' }}
                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                  />
                  <Bar dataKey="visitors" name="Visitors" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary?.systemMatrix?.byRoom || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="roomNumber" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', border: 'none', color: '#FFF', fontSize: '12px' }}
                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                  />
                  <Bar dataKey="totalParticipants" name="Participants" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="bookings" name="Bookings" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Events Panel */}
        <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs p-4 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-zinc-900 text-base">Recent Events</h2>
            </div>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center py-10 text-sm text-zinc-400">
                  Loading events...
                </div>
              ) : !summary?.recentEvents || summary.recentEvents.length === 0 ? (
                <div className="text-center py-10 text-sm text-zinc-400">
                  No recent events recorded.
                </div>
              ) : (
                summary.recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-xs text-zinc-900 line-clamp-1">{event.name}</h4>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        event.status === 'OCCUPIED'
                          ? 'bg-amber-100 text-amber-800'
                          : event.status === 'RESERVED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {event.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-500 mb-1.5">
                      <span className="flex items-center gap-1 font-medium text-zinc-700">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                        Room {event.roomNumber}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        {event.date}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-zinc-200 text-zinc-500">
                      <span>{event.organizer}</span>
                      <span className="font-medium text-zinc-700">
                        {event.participants} attendees
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
