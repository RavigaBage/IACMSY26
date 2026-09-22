import { useState, useEffect } from 'react';
import { ServerCrash, Loader2, Plus, X, RefreshCw, Power, LogOut, MonitorPlay, AlertCircle, Edit2, Trash2, Download } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Pagination } from '../components/ui/Pagination';
import { formatDistanceToNow } from 'date-fns';
import { useCrud } from '../hooks/useCrud';
import { useFuzzySearch } from '../hooks/useFuzzySearch';

interface Device {
  _id: string;
  deviceName: string;
  operatingSystem: string;
  ipAddress: string;
  location: string;
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
    type: 'shutdown' | 'restart' | 'logoff' | 'system_update' | 'delete', 
    title: string, 
    message: string, 
    ids: string[]
  } | null>(null);

  const { success, error, toast } = useToast();

  useEffect(() => {
    fetchDevices();
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

  const requestAction = (type: 'shutdown' | 'restart' | 'logoff' | 'system_update', title: string, message: string) => {
    if (selectedIds.size === 0) return;
    setModalAction({ type, title, message, ids: Array.from(selectedIds) });
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
      await api.post(`api/iac/devices/${type}`, { deviceIds: ids });
      success(`Command ${type} executed successfully`);
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
        confirmText={modalAction?.type === 'delete' ? 'Delete' : 'Confirm'}
        cancelText="Cancel"
        isDestructive={modalAction?.type !== 'system_update'}
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
            onClick={() => requestAction('restart', 'Restart Devices', 'Restart selected devices? Any unsaved work will be lost.')}
            disabled={selectedIds.size === 0 || !!actionLoading}
            className="px-3 py-2 bg-white text-zinc-700 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {actionLoading === 'restart' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Restart
          </button>
          <button 
            onClick={() => requestAction('shutdown', 'Shutdown Devices', 'Shutdown selected devices? Any unsaved work will be lost.')}
            disabled={selectedIds.size === 0 || !!actionLoading}
            className="px-3 py-2 bg-white text-red-600 rounded-lg border border-zinc-200 hover:bg-red-50 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {actionLoading === 'shutdown' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
            Shutdown
          </button>
          <button 
            onClick={() => requestAction('logoff', 'Logoff Users', 'Logoff active users from selected devices? Any unsaved work will be lost.')}
            disabled={selectedIds.size === 0 || !!actionLoading}
            className="px-3 py-2 bg-white text-zinc-700 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {actionLoading === 'logoff' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Logoff
          </button>
          <button 
            onClick={() => requestAction('system_update', 'Apply Updates', 'Check and apply system updates to selected devices?')}
            disabled={selectedIds.size === 0 || !!actionLoading}
            className="px-3 py-2 bg-white text-zinc-700 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {actionLoading === 'system_update' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Updates
          </button>
          <button 
            onClick={checkStatus}
            disabled={selectedIds.size === 0 || !!actionLoading}
            className="px-3 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
          >
            {actionLoading === 'device-Status' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MonitorPlay className="w-4 h-4" />}
            Ping
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
                      <td className="py-3 px-4 text-sm font-mono text-zinc-600">{device.ipAddress || '-'}</td>
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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleEdit(device, e)}
                            className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => requestDelete(device, e)}
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
