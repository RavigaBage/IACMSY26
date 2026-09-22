import { useState, useEffect } from 'react';
import { Users, MonitorPlay, ServerCrash, AlertCircle, RefreshCw, Clock, MapPin, Sparkles } from 'lucide-react';
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
    } catch (err) {
      console.error('Failed to fetch home summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto transition-opacity duration-500 ease-in-out opacity-100 space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live System Telemetry
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Platform Overview</h1>
          <p className="text-zinc-500 mt-1 text-sm max-w-xl">
            Real-time facility utilization, lounge activity, active room bookings, and system metrics.
          </p>
        </div>
        
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="self-start md:self-auto px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-xl font-medium text-sm flex items-center gap-2 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
          Refresh Live Data
        </button>
      </header>

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Lounge Activity */}
        <div className="group bg-white p-6 rounded-3xl border border-zinc-200/60 shadow-sm hover:shadow-md hover:border-zinc-300/80 transition-all duration-300">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-blue-50 rounded-2xl group-hover:bg-blue-100 transition-colors">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="flex items-center text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              Live Today
            </span>
          </div>
          <h3 className="text-sm font-medium text-zinc-500 mb-1">Lounge Visitors</h3>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold text-zinc-900 tracking-tight">
              {loading ? '...' : (summary?.currentLoungeCount ?? 0)}
            </p>
            <span className="text-xs font-medium text-zinc-400">
              in lounge today
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-100">
            Total recorded: <strong className="text-zinc-700 font-semibold">{summary?.totalLoungeUsers ?? 0}</strong>
          </p>
        </div>

        {/* Active Rooms */}
        <div className="group bg-white p-6 rounded-3xl border border-zinc-200/60 shadow-sm hover:shadow-md hover:border-zinc-300/80 transition-all duration-300">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-emerald-50 rounded-2xl group-hover:bg-emerald-100 transition-colors">
              <MonitorPlay className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              In Session
            </span>
          </div>
          <h3 className="text-sm font-medium text-zinc-500 mb-1">Rooms & Labs</h3>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold text-zinc-900 tracking-tight">
              {loading ? '...' : (summary?.activeRoomsCount ?? 0)}
            </p>
            <span className="text-xs font-medium text-zinc-400">
              active programs today
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-100">
            Total events booked: <strong className="text-zinc-700 font-semibold">{summary?.totalRoomBookings ?? 0}</strong>
          </p>
        </div>

        {/* Connected Devices */}
        <div className="group bg-white p-6 rounded-3xl border border-zinc-200/60 shadow-sm hover:shadow-md hover:border-zinc-300/80 transition-all duration-300">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-purple-50 rounded-2xl group-hover:bg-purple-100 transition-colors">
              <ServerCrash className="w-5 h-5 text-purple-600" />
            </div>
            <span className="flex items-center text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">
              Online
            </span>
          </div>
          <h3 className="text-sm font-medium text-zinc-500 mb-1">Connected Endpoints</h3>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold text-zinc-900 tracking-tight">
              {loading ? '...' : (summary?.connectedDevicesCount ?? 0)}
            </p>
            <span className="text-xs font-medium text-zinc-400">
              devices connected
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-100">
            Network status: <strong className="text-emerald-600 font-semibold">Healthy (100%)</strong>
          </p>
        </div>

        {/* System Reports */}
        <div className="group bg-white p-6 rounded-3xl border border-zinc-200/60 shadow-sm hover:shadow-md hover:border-zinc-300/80 transition-all duration-300">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-amber-50 rounded-2xl group-hover:bg-amber-100 transition-colors">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <span className="flex items-center text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
              Audit Logs
            </span>
          </div>
          <h3 className="text-sm font-medium text-zinc-500 mb-1">Generated Reports</h3>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold text-zinc-900 tracking-tight">
              {loading ? '...' : (summary?.pendingReportsCount ?? 0)}
            </p>
            <span className="text-xs font-medium text-zinc-400">
              system reports
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-100">
            Export format: <strong className="text-zinc-700 font-semibold">Excel (.xlsx)</strong>
          </p>
        </div>
      </div>

      {/* Main Feature Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* System Activity Matrix Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-zinc-200/60 shadow-sm p-8 min-h-[420px] flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-bold text-zinc-900 tracking-tight text-lg">System Activity Matrix</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Live facility traffic & participation dynamics</p>
            </div>
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200/80">
              <button
                onClick={() => setActiveTab('traffic')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'traffic'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Today's Lounge Traffic
              </button>
              <button
                onClick={() => setActiveTab('rooms')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'rooms'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                Room Utilization
              </button>
            </div>
          </div>

          <div className="flex-1 w-full min-h-[280px]">
            {activeTab === 'traffic' ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary?.systemMatrix?.hourlyTraffic || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#FFF', fontSize: '12px' }}
                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                  />
                  <Bar dataKey="visitors" name="Lounge Visitors" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary?.systemMatrix?.byRoom || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="roomNumber" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', border: 'none', color: '#FFF', fontSize: '12px' }}
                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                  />
                  <Bar dataKey="totalParticipants" name="Total Participants" fill="#10B981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="bookings" name="Events Count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Events Panel */}
        <div className="bg-white rounded-3xl border border-zinc-200/60 shadow-sm p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-zinc-900 tracking-tight text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Recent Events
              </h3>
              <span className="text-xs font-semibold text-zinc-400 bg-zinc-100 px-2.5 py-1 rounded-full">
                Latest
              </span>
            </div>

            <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center py-12 text-sm text-zinc-400 animate-pulse">
                  Loading recent events...
                </div>
              ) : !summary?.recentEvents || summary.recentEvents.length === 0 ? (
                <div className="text-center py-12 text-sm text-zinc-400">
                  No recent events recorded yet.
                </div>
              ) : (
                summary.recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/60 hover:bg-zinc-100/80 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="font-semibold text-sm text-zinc-900 line-clamp-1">{event.name}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        event.status === 'OCCUPIED'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : event.status === 'RESERVED'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {event.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-500 mb-2">
                      <span className="flex items-center gap-1 font-medium text-zinc-700">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                        Room {event.roomNumber} ({event.roomType})
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        {event.date}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-200/60 text-zinc-500">
                      <span>By: <strong className="text-zinc-700 font-medium">{event.organizer}</strong></span>
                      <span className="bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-zinc-700 font-semibold">
                        {event.participants} guests
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
