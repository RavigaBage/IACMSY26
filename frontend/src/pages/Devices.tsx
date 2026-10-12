import { useState, useEffect } from 'react';
import { ServerCrash, Loader2, Plus, X, MonitorPlay, AlertCircle, Edit2, Trash2, ChevronDown, Command, Moon, Sun, Zap, HelpCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Pagination } from '../components/ui/Pagination';
import { formatDistanceToNow } from 'date-fns';
import { useCrud } from '../hooks/useCrud';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { PowerManagement } from '../components/PowerManagement';
import { useAuth } from '../contexts/AuthContext';

interface Device {
  _id: string;
  deviceName: string;
  operatingSystem: string;
  ipAddress: string;
  location: string;
  macAddress?: string;
  networkSubnet?: string;
  status: {
    remoteAgent: 'waiting' | 'active' | 'offline';
  };
  security?: {
    lastSeen?: string;
  };
  createdAt: string;
  deviceId?: string;
}

const ROOM_INVENTORY = [
  'Seminar Room 1', 'Seminar Room 2', 'Seminar Room 3', 
  'Seminar Room 4', 'Conference Room', 'Training Lab'
];

export default function Devices() {
  const {
    data: devicesData,
    loading,
    submitting,
    fetchAll: fetchDevices,
    createRecord,
    updateRecord,
    deleteRecord,
  } = useCrud<any>({ endpoint: 'api/iac/devices/devicStatus' });

  const devices: Device[] = devicesData?.data || devicesData || [];

  const [searchQuery, setSearchQuery] = useState("");
  const [filterRoom, setFilterRoom] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fuzzyFilteredDevices = useFuzzySearch(devices, searchQuery, {
    keys: ['deviceName', 'ipAddress', 'operatingSystem', 'location']
  });

  const filteredDevices = fuzzyFilteredDevices.filter(d => {
    if (filterRoom !== "All" && d.location !== filterRoom) return false;
    if (filterStatus !== "All" && d.status?.remoteAgent !== filterStatus) return false;
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterRoom, filterStatus]);

  const totalPages = Math.ceil(filteredDevices.length / ITEMS_PER_PAGE) || 1;
  const paginatedDevices = filteredDevices.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Selection & Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    deviceName: '',
    operatingSystem: 'Desktop',
    location: ROOM_INVENTORY[0],
    ipAddress: '',
  });

  // Modal State for Remote Control & Delete
  const [modalAction, setModalAction] = useState<{
    type: 'shutdown' | 'restart' | 'logoff' | 'system_update' | 'sleep' | 'wake' | 'delete',
    title: string, 
    message: string, 
    ids: string[]
  } | null>(null);

  const { success, error, toast } = useToast();
  const { user } = useAuth();
  const [selectedCommand, setSelectedCommand] = useState('');
  const [showTargetPcGuide, setShowTargetPcGuide] = useState(false);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(() => {
      fetchDevices();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCancelForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setErrors({});
    setFormData({
      deviceName: '',
      operatingSystem: 'Desktop',
      location: ROOM_INVENTORY[0],
      ipAddress: '',
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.deviceName.trim()) newErrors.deviceName = "Device Name is required";
    if (!formData.ipAddress.trim()) newErrors.ipAddress = "Identifier is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      if (editingId) {
        await updateRecord(editingId, formData, 'api/iac/devices/devicStatus');
      } else {
        await createRecord(formData, 'api/iac/devices/submit-devicStatus');
      }
      handleCancelForm();
    } catch {
      // Error handled by useCrud
    }
  };

  const handleEdit = (device: Device, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({
      deviceName: device.deviceName,
      operatingSystem: device.operatingSystem || 'Desktop',
      location: device.location || ROOM_INVENTORY[0],
      ipAddress: device.ipAddress || '',
    });
    setEditingId(device._id);
    setIsFormOpen(true);
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredDevices.map(d => d._id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const requestCommand = () => {
    if (!selectedCommand || selectedIds.size === 0) return;
    if (selectedCommand === 'device-Status') {
      void checkStatus();
      return;
    }
    const details: Record<string, { title: string; message: string }> = {
      restart: { title: 'Restart selected computers', message: `Restart ${selectedIds.size} selected computer(s)? Any unsaved work may be lost.` },
      shutdown: { title: 'Shut down selected computers', message: `Shut down ${selectedIds.size} selected computer(s)? Any unsaved work may be lost.` },
      logoff: { title: 'Log off selected users', message: `Log off users on ${selectedIds.size} selected computer(s)? Any unsaved work may be lost.` },
      system_update: { title: 'Apply updates', message: `Check and apply system updates to ${selectedIds.size} selected computer(s)?` },
      sleep: { title: 'Sleep selected computers', message: `Send a sleep warning to ${selectedIds.size} selected computer(s). They will sleep after 30 seconds, and computers with an active user session will be skipped.` },
      wake: { title: 'Wake selected computers', message: `Send Wake-on-LAN packets to ${selectedIds.size} selected computer(s)?` },
    };
    const detailsForCommand = details[selectedCommand];
    if (detailsForCommand) setModalAction({ type: selectedCommand as 'shutdown' | 'restart' | 'logoff' | 'system_update' | 'sleep' | 'wake', ...detailsForCommand, ids: Array.from(selectedIds) });
  };

  const requestDelete = (device: Device, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalAction({
      type: 'delete',
      title: 'Unregister Device',
      message: `Unregister ${device.deviceName}? It will stop appearing on this dashboard.`,
      ids: [device._id]
    });
  };

  const executeModalAction = async () => {
    if (!modalAction) return;
    const { type, ids } = modalAction;
    setModalAction(null);

    if (type === 'delete') {
      try {
        await deleteRecord(ids[0], 'api/iac/devices/devicStatus');
      } catch {
        // Error handled by useCrud
      }
      return;
    }

    // Remote Control Actions
    try {
      setActionLoading(type);
      toast(`Sending ${type} command...`, 'info');
      if (type === 'sleep') {
        try {
          await api.post('/api/iac/power/sleep', { deviceIds: ids, graceSeconds: 30, skipIfActiveSession: false });
        } catch {
          await api.post('/api/iac/devices/sleep', { deviceIds: ids, graceSeconds: 30, skipIfActiveSession: false });
        }
        success('Sleep command sent to selected computer(s).');
      } else if (type === 'wake') {
        let result: any;
        try {
          result = await api.post('/api/iac/power/wake', { deviceIds: ids });
        } catch {
          result = await api.post('/api/iac/devices/wake', { deviceIds: ids });
        }
        const sent = result?.results?.filter((item: any) => item.status === 'sent').length ?? ids.length;
        success(`Wake-on-LAN packet sent to ${sent} of ${ids.length} selected computer(s).`);
        const failed = result?.results?.filter((item: any) => item.status === 'failed') || [];
        if (failed.length) error(failed.map((item: any) => `${item.deviceName}: ${item.error}`).join(' '));
      } else {
        await api.post(`api/iac/devices/${type}`, { deviceIds: ids });
        success(`Command ${type} sent successfully.`);
      }
      setSelectedIds(new Set()); // clear selection
      await fetchDevices();
    } catch {
      error(`Failed to execute ${type}`);
    } finally {
      setActionLoading(null);
    }
  };

  const checkStatus = async () => {
    if (selectedIds.size === 0) return;
    try {
      setActionLoading('device-Status');
      await api.post(`api/iac/devices/device-Status`, { deviceIds: Array.from(selectedIds) });
      success('Ping sent');
      await fetchDevices();
    } catch {
      error('Failed to ping agents');
    } finally {
      setActionLoading(null);
    }
  };


  return (
    <div className="p-8 max-w-7xl mx-auto transition-opacity duration-500 ease-in-out opacity-100">
      
      <ConfirmModal
        isOpen={!!modalAction}
        onClose={() => setModalAction(null)}
        onConfirm={executeModalAction}
        title={modalAction?.title || ''}
        message={modalAction?.message || ''}
        confirmText={modalAction?.type === 'delete' ? 'Delete' : 'Send command'}
        cancelText="Cancel"
        isDestructive={['delete', 'shutdown', 'restart', 'logoff', 'sleep'].includes(modalAction?.type || '')}
      />

      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-xl border border-zinc-200/60 shadow-sm">
            <ServerCrash className="w-6 h-6 text-zinc-900" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Device Management</h1>
            <p className="text-zinc-500 text-sm mt-1">Monitor, control, and deploy to endpoints.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowTargetPcGuide(true)}
            className="px-3.5 py-2 bg-white text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:text-zinc-900 transition-colors text-sm font-medium flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <HelpCircle className="w-4 h-4 text-emerald-600" />
            Target PC Setup Guide
          </button>
          <button 
            onClick={() => {
              if (isFormOpen) handleCancelForm();
              else setIsFormOpen(true);
            }}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors text-sm font-medium flex items-center gap-2 ml-2"
          >
            {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isFormOpen ? 'Cancel' : 'Register Device'}
          </button>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border border-zinc-200/60 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-zinc-100 p-2.5 text-zinc-700"><Command className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold text-zinc-900">Device commands</h2>
              <p className="mt-1 text-sm text-zinc-500">{selectedIds.size ? `${selectedIds.size} computer${selectedIds.size === 1 ? '' : 's'} selected` : 'Select computers from the list, then choose an action.'}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 sm:min-w-[260px]">
              <select value={selectedCommand} onChange={e => setSelectedCommand(e.target.value)} className="w-full appearance-none rounded-lg border border-zinc-200 bg-white py-2.5 pl-3 pr-10 text-sm font-medium text-zinc-800 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10">
                <option value="">Choose a command…</option>
                <optgroup label="Power management">
                  {user?.role === 'admin' && <option value="sleep">Sleep selected computers</option>}
                  {user?.role === 'admin' && <option value="wake">Wake selected computers (Wake-on-LAN)</option>}
                </optgroup>
                <optgroup label="Remote actions">
                  <option value="restart">Restart</option>
                  <option value="shutdown">Shut down</option>
                  <option value="logoff">Log off users</option>
                  <option value="system_update">Apply updates</option>
                  <option value="device-Status">Ping / check status</option>
                </optgroup>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            </div>
            <button type="button" onClick={requestCommand} disabled={!selectedCommand || selectedIds.size === 0 || !!actionLoading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedCommand === 'sleep' ? <Moon className="h-4 w-4" /> : selectedCommand === 'wake' ? <Sun className="h-4 w-4" /> : selectedCommand === 'device-Status' ? <MonitorPlay className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
              Run command
            </button>
          </div>
        </div>
        {selectedCommand === 'sleep' && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Computers receive a 30 second warning. A computer with an active user session will be skipped.</p>}
        {selectedCommand === 'wake' && <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">Wake-on-LAN requires the computer to be configured for WoL and reachable on its network.</p>}
      </section>

      {user?.role === 'admin' && <PowerManagement devices={devices} selectedIds={Array.from(selectedIds)} />}

      {isFormOpen && (
        <div className="mb-8 bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden animate-in slide-in-from-top-4 duration-300">
          <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              {editingId ? 'Edit Device' : 'Register New Device'}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Device Name</label>
                <input 
                  type="text" 
                  name="deviceName" 
                  required
                  value={formData.deviceName} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                  placeholder="e.g. LAB-PC-01"
                />
                {errors.deviceName && <p className="text-xs text-red-500 mt-1">{errors.deviceName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Device Type</label>
                <select 
                  name="operatingSystem" 
                  value={formData.operatingSystem} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm bg-white"
                >
                  <option value="Desktop">Desktop</option>
                  <option value="Laptop">Laptop</option>
                  <option value="Server">Server</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Location / Room</label>
                <select 
                  name="location" 
                  value={formData.location} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm bg-white"
                >
                  {ROOM_INVENTORY.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Identifier (IP / Hostname)</label>
                <input 
                  type="text" 
                  name="ipAddress" 
                  required
                  value={formData.ipAddress} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                  placeholder="e.g. 192.168.1.100"
                />
                {errors.ipAddress && <p className="text-xs text-red-500 mt-1">{errors.ipAddress}</p>}
              </div>

            </div>
            
            <div className="mt-6 flex items-center justify-end pt-6 border-t border-zinc-100">
              <button 
                type="submit" 
                disabled={submitting}
                className="px-6 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {submitting ? 'Saving...' : 'Save Device'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!isFormOpen && (
        <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-sm">
          <div className="flex-1">
            <input 
              type="text" 
              placeholder="Search devices..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm"
            />
          </div>
          <select 
            value={filterRoom}
            onChange={e => setFilterRoom(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm bg-white"
          >
            <option value="All">All Locations</option>
            {ROOM_INVENTORY.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select 
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm bg-white"
          >
            <option value="All">All Statuses</option>
            <option value="active">Online</option>
            <option value="offline">Offline</option>
            <option value="waiting">Waiting</option>
          </select>
        </div>
      )}

      {!isFormOpen && (
        <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-200/60">
                  <th className="py-3 px-4 w-12">
                    <input 
                      type="checkbox" 
                      checked={filteredDevices.length > 0 && selectedIds.size === filteredDevices.length}
                      onChange={toggleSelectAll}
                      className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Device</th>
                  <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Type / Location</th>
                  <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Identifier</th>
                  <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Last Seen</th>
                  <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin mx-auto mb-3"></div>
                      Loading devices...
                    </td>
                  </tr>
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      <AlertCircle className="w-8 h-8 mx-auto mb-3 text-zinc-300" />
                      No devices found. Ensure agents are deployed or register one manually.
                    </td>
                  </tr>
                ) : (
                  paginatedDevices.map(device => (
                    <tr 
                      key={device._id} 
                      className={`hover:bg-zinc-50/50 transition-colors cursor-pointer ${selectedIds.has(device._id) ? 'bg-zinc-50/80' : ''}`}
                      onClick={() => toggleSelect(device._id)}
                    >
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(device._id)}
                          onChange={() => toggleSelect(device._id)}
                          className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-900">{device.deviceName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-zinc-700 font-medium">{device.operatingSystem || 'Unknown'}</div>
                        <div className="text-xs text-zinc-500">{device.location || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-zinc-600"><div>{device.ipAddress || '-'}</div><div className="mt-1 text-xs text-zinc-400">{device.macAddress || 'MAC pending'}{device.networkSubnet ? ` · ${device.networkSubnet}` : ''}</div></td>
                      <td className="py-3 px-4">
                        {device.status?.remoteAgent === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Online
                          </span>
                        ) : device.status?.remoteAgent === 'offline' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Offline
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                            Waiting
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-zinc-500">
                        {device.security?.lastSeen ? formatDistanceToNow(new Date(device.security.lastSeen), { addSuffix: true }) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {user?.role === 'admin' && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalAction({
                                    type: 'sleep',
                                    title: `Put ${device.deviceName} to sleep`,
                                    message: `Send a sleep warning to "${device.deviceName}". The computer will enter sleep mode after 30 seconds.`,
                                    ids: [device._id]
                                  });
                                }}
                                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                                title="Put to sleep"
                                aria-label={`Put ${device.deviceName} to sleep`}
                              >
                                <Moon className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalAction({
                                    type: 'wake',
                                    title: `Wake ${device.deviceName} (Wake-on-LAN)`,
                                    message: `Send Wake-on-LAN magic packet to wake up "${device.deviceName}"?`,
                                    ids: [device._id]
                                  });
                                }}
                                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-sky-600 hover:text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                                title="Wake on LAN"
                                aria-label={`Wake ${device.deviceName}`}
                              >
                                <Sun className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={(e) => handleEdit(device, e)}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                            title="Edit"
                            aria-label="Edit device"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => requestDelete(device, e)}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete"
                            aria-label="Delete device"
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

      {showTargetPcGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Target PC Setup Guide (Sleep & Wake-on-LAN)</h3>
                  <p className="text-xs text-zinc-500">Settings required on endpoint computers to enable remote sleep and wake</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTargetPcGuide(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
                aria-label="Close guide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 text-sm text-zinc-700">
              <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-200/80">
                <h4 className="font-semibold text-zinc-900 flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-xs flex items-center justify-center font-bold">1</span>
                  BIOS / UEFI Motherboard Settings (Hardware)
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 ml-1">
                  <li>Enter BIOS setup on boot (<kbd className="px-1.5 py-0.5 bg-white border rounded">Del</kbd>, <kbd className="px-1.5 py-0.5 bg-white border rounded">F2</kbd>, or <kbd className="px-1.5 py-0.5 bg-white border rounded">F12</kbd>).</li>
                  <li>In <strong>Power Management / ACPI</strong>, enable <strong>Wake-on-LAN (WoL)</strong> or <strong>Power On By PCI-E/PME</strong>.</li>
                  <li><strong>Disable ErP / EuP Ready</strong>: If ErP is enabled, motherboard power to the network card is cut off during sleep or shutdown.</li>
                  <li>Set ACPI Sleep state to <strong>S3 (Suspend to RAM)</strong>.</li>
                </ul>
              </div>

              <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-200/80">
                <h4 className="font-semibold text-zinc-900 flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-xs flex items-center justify-center font-bold">2</span>
                  Windows Settings (Network Adapter & Fast Startup)
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 ml-1">
                  <li>Open <strong>Device Manager</strong> &rarr; <strong>Network Adapters</strong> &rarr; Right-click physical Ethernet &rarr; <strong>Properties</strong>.</li>
                  <li>In <strong>Advanced</strong> tab: Set <strong>Wake on Magic Packet</strong> to <em>Enabled</em>, and set <strong>Shutdown Wake-On-Lan</strong> to <em>Enabled</em>.</li>
                  <li>In <strong>Power Management</strong> tab: Check <em>Allow this device to wake the computer</em> and <em>Only allow a magic packet to wake the computer</em>.</li>
                  <li><strong>Disable Fast Startup</strong>: Control Panel &rarr; Power Options &rarr; &ldquo;Choose what the power buttons do&rdquo; &rarr; Uncheck <em>Turn on fast startup</em>. (Fast Startup puts Windows into S4 hybrid sleep where standard Ethernet listening is disabled).</li>
                  <li>Verify in admin PowerShell: <code className="bg-zinc-200 px-1 py-0.5 rounded text-[11px]">powercfg /devicequery wake_armed</code></li>
                </ul>
              </div>

              <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-200/80">
                <h4 className="font-semibold text-zinc-900 flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-xs flex items-center justify-center font-bold">3</span>
                  Linux Settings (ethtool)
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-zinc-600 ml-1">
                  <li>Check status: <code className="bg-zinc-200 px-1 py-0.5 rounded text-[11px]">sudo ethtool eth0 | grep Wake-on</code></li>
                  <li>Enable Magic Packet wake: <code className="bg-zinc-200 px-1 py-0.5 rounded text-[11px]">sudo ethtool -s eth0 wol g</code></li>
                  <li>Persist in NetworkManager: <code className="bg-zinc-200 px-1 py-0.5 rounded text-[11px]">nmcli connection modify &quot;Wired connection 1&quot; 802-3-ethernet.wake-on-lan magic</code></li>
                </ul>
              </div>

              <div className="rounded-xl bg-sky-50 p-4 border border-sky-200/80 text-sky-900">
                <h4 className="font-semibold flex items-center gap-2 mb-1">
                  <Sun className="w-4 h-4 text-sky-600" />
                  Local Subnet & WoL Relay
                </h4>
                <p className="text-xs text-sky-800 leading-relaxed">
                  Target computers must be connected via Ethernet cable. When the server is hosted in the cloud, any online agent in the same laboratory automatically relays the Wake-on-LAN Magic Packet directly onto the local LAN broadcast (<code className="bg-sky-100 px-1 py-0.5 rounded">255.255.255.255:9</code>).
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTargetPcGuide(false)}
                className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
