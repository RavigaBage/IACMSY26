import React, { useState, useEffect } from 'react';
import { QrCode, Plus, Loader2, Download, Eye, X, Ban, Trash2, Search, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Pagination } from '../components/ui/Pagination';
import { useCrud } from '../hooks/useCrud';
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { api } from '../lib/api';

interface QRCodeRecord {
  _id: string;
  token: string;
  label?: string;
  durationValue: number;
  durationUnit: string;
  expiresAt: string;
  status: string;
  computedStatus: string;
  createdBy?: { name: string };
  submissionCount: number;
  createdAt: string;
}

export default function AttendanceQR() {
  
  const {
    data: qrData,
    loading,
    submitting,
    fetchAll: fetchQRCodes,
    createRecord,
    updateRecord,
    deleteRecord,
  } = useCrud<any>({ endpoint: 'api/qrcodes' });

  const qrCodes: QRCodeRecord[] = qrData?.data || qrData || [];

  const [activeQR, setActiveQR] = useState<QRCodeRecord | null>(null);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  
  const [formData, setFormData] = useState({
    label: '',
    durationValue: '1',
    durationUnit: 'hours'
  });

  const [viewQR, setViewQR] = useState<QRCodeRecord | null>(null);
  const [modalAction, setModalAction] = useState<{ type: 'deactivate' | 'delete' | 'regenerate', code: QRCodeRecord } | null>(null);

  const fetchActiveQR = async () => {
    try {
      const res = await api.get('api/qrcodes/active');
      if (res?.data) {
        setActiveQR(res.data);
      } else {
        setActiveQR(null);
      }
    } catch (err) {
      console.error('Error fetching active QR:', err);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fuzzyFilteredQRs = useFuzzySearch(qrCodes, searchQuery, {
    keys: ['label', 'createdBy.name', 'token']
  });

  const filteredQRs = fuzzyFilteredQRs.filter(qr => {
    if (statusFilter !== 'All' && qr.computedStatus !== statusFilter) return false;
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredQRs.length / ITEMS_PER_PAGE) || 1;
  const paginatedQRs = filteredQRs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    fetchQRCodes();
    fetchActiveQR();
  }, [fetchQRCodes]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createRecord(formData, 'api/qrcodes/generate/');
      setShowGenerateForm(false);
      setFormData({ label: '', durationValue: '1', durationUnit: 'hours' });
      if (res?.data) {
        setActiveQR(res.data);
        setViewQR(res.data);
      }
      fetchActiveQR();
      fetchQRCodes();
    } catch {
      // handled by useCrud
    }
  };

  const executeModalAction = async () => {
    if (!modalAction) return;
    try {
      if (modalAction.type === 'deactivate') {
        await updateRecord(modalAction.code._id, {}, `api/qrcodes/${modalAction.code._id}/deactivate`);
      } else if (modalAction.type === 'delete') {
        await deleteRecord(modalAction.code._id, 'api/qrcodes');
      } else if (modalAction.type === 'regenerate') {
        const res = await updateRecord(
          modalAction.code._id,
          { durationValue: modalAction.code.durationValue, durationUnit: modalAction.code.durationUnit },
          `api/qrcodes/${modalAction.code._id}/regenerate`
        );
        if (res?.data) {
          setViewQR(res.data);
        }
      }
      setModalAction(null);
      fetchActiveQR();
      fetchQRCodes();
    } catch {
      // handled by useCrud
    }
  };

  const downloadQR = (code: QRCodeRecord) => {
    const svg = document.getElementById(`qr-${code._id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `attendance-qr-${code.label || code.token}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto">
      <ConfirmModal
        isOpen={!!modalAction}
        onClose={() => setModalAction(null)}
        onConfirm={executeModalAction}
        title={
          modalAction?.type === 'delete'
            ? 'Delete QR Code'
            : modalAction?.type === 'deactivate'
            ? 'Deactivate QR Code'
            : 'Regenerate QR Code'
        }
        message={
          modalAction?.type === 'delete'
            ? `Are you sure you want to delete this QR code? (${modalAction.code.label || 'Unnamed'}). Submissions will be kept.`
            : modalAction?.type === 'deactivate'
            ? `Are you sure you want to deactivate this QR code now? It will expire immediately.`
            : `Are you sure you want to generate a new active QR token for "${modalAction?.code.label || 'Unnamed Session'}"? The old QR token will be replaced.`
        }
        confirmText={
          modalAction?.type === 'delete'
            ? 'Delete'
            : modalAction?.type === 'deactivate'
            ? 'Deactivate'
            : 'Regenerate'
        }
        cancelText="Cancel"
        isDestructive={modalAction?.type === 'delete' || modalAction?.type === 'deactivate'}
      />

      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-xl border border-zinc-200/60 shadow-sm">
            <QrCode className="w-6 h-6 text-zinc-900" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">QR Attendance</h1>
            <p className="text-sm text-zinc-500 mt-1">Generate temporary QR codes for student sign-ins</p>
          </div>
        </div>
        <button
          onClick={() => setShowGenerateForm(!showGenerateForm)}
          className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shadow-md shadow-zinc-900/10"
        >
          {showGenerateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showGenerateForm ? 'Cancel' : 'Generate QR Code'}
        </button>
      </header>

      {showGenerateForm && (
        <div className="bg-white rounded-2xl border border-zinc-200/60 p-6 shadow-sm mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Create New QR Code</h2>
          <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Session Label (Optional)</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm"
                placeholder="e.g. Monday Morning Session"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Expiry Duration</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.durationValue}
                  onChange={(e) => setFormData({ ...formData, durationValue: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm"
                />
                <select
                  value={formData.durationUnit}
                  onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-zinc-900 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Attendance QR Banner Card */}
      <div className="mb-8">
        {activeQR ? (
          <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white rounded-3xl p-8 shadow-xl border border-zinc-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
              <div className="space-y-4 max-w-xl text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-3">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    ACTIVE ATTENDANCE CODE
                  </span>
                  <span className="text-xs text-zinc-400">
                    Expires: {format(new Date(activeQR.expiresAt), 'h:mm a (MMM d)')}
                  </span>
                </div>

                <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
                  {activeQR.label || 'Active Internet Lounge Session'}
                </h2>

                <p className="text-zinc-300 text-sm leading-relaxed">
                  Students and visitors can scan this QR code or navigate directly to register attendance.
                </p>

                <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-zinc-400">
                  <span className="bg-zinc-800/80 px-3 py-1.5 rounded-lg border border-zinc-700">
                    Submissions: <strong className="text-white">{activeQR.submissionCount || 0}</strong>
                  </span>
                  <span className="bg-zinc-800/80 px-3 py-1.5 rounded-lg border border-zinc-700">
                    Token: <strong className="text-white font-mono">{activeQR.token}</strong>
                  </span>
                </div>

                <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <button
                    onClick={() => downloadQR(activeQR)}
                    className="px-4 py-2 bg-white text-zinc-900 hover:bg-zinc-100 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download PNG
                  </button>
                  <button
                    onClick={() => setModalAction({ type: 'deactivate', code: activeQR })}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Ban className="w-4 h-4" />
                    Deactivate Code
                  </button>
                </div>
              </div>

              {/* QR Code SVG Display */}
              <div className="bg-white p-5 rounded-2xl shadow-2xl flex flex-col items-center justify-center gap-3 shrink-0">
                <QRCodeSVG
                  id={`qr-${activeQR._id}`}
                  value={`${window.location.origin}/attendance/form?token=${activeQR.token}`}
                  size={160}
                  level="H"
                  includeMargin={true}
                />
                <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                  Scan To Sign In
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-xl text-amber-700 shrink-0">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900 text-sm">No Active Attendance QR Code</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  Press <strong>"Generate QR Code"</strong> above to create an active temporary code for student sign-ins.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowGenerateForm(true)}
              className="px-4 py-2 bg-amber-900 text-white hover:bg-amber-800 rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-sm"
            >
              Generate Code Now
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-sm">
        <div className="flex-1 relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search QR codes by label or creator..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm"
          />
        </div>
        <select 
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm bg-white"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Expired">Expired</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p className="text-sm">Loading QR codes...</p>
        </div>
      ) : filteredQRs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200/60 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-100">
            <QrCode className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 mb-1">No QR Codes Found</h3>
          <p className="text-sm text-zinc-500">Generate a QR code to start collecting student attendance.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-50/50 border-b border-zinc-200/60">
                <tr>
                  <th className="px-6 py-4 font-medium text-zinc-500">Label / Session</th>
                  <th className="px-6 py-4 font-medium text-zinc-500">Generated</th>
                  <th className="px-6 py-4 font-medium text-zinc-500">Expiry</th>
                  <th className="px-6 py-4 font-medium text-zinc-500">Status</th>
                  <th className="px-6 py-4 font-medium text-zinc-500">Submissions</th>
                  <th className="px-6 py-4 font-medium text-zinc-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedQRs.map((code) => (
                  <tr key={code._id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-zinc-900">{code.label || 'Unnamed Session'}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">By {code.createdBy?.name || 'System'}</p>
                    </td>
                    <td className="px-6 py-4 text-zinc-600">
                      {format(new Date(code.createdAt), 'MMM d, h:mm a')}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-zinc-900">{code.durationValue} {code.durationUnit}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Until {format(new Date(code.expiresAt), 'MMM d, h:mm a')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        code.computedStatus === 'Active'
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                      }`}>
                        {code.computedStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-900">
                      {code.submissionCount}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewQR(code)}
                          className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View QR"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadQR(code)}
                          className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                          title="Download QR"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setModalAction({ type: 'regenerate', code })}
                          className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Regenerate QR Code"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        {code.computedStatus === 'Active' && (
                          <button
                            onClick={() => setModalAction({ type: 'deactivate', code })}
                            className="p-2 text-zinc-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Deactivate Now"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setModalAction({ type: 'delete', code })}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Hidden QR for download generation */}
                      <div className="hidden">
                        <QRCodeSVG
                          id={`qr-${code._id}`}
                          value={`${window.location.origin}/attendance/${code.token}`}
                          size={1024}
                          level="H"
                          imageSettings={{
                            src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYTmefnUDCIgdXIk_GGVt_J0cgINbO2yEHvENEg1u2hzJQAwq4VFEetC0&s=10',
                            height: 256,
                            width: 256,
                            excavate: true,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* View QR Modal */}
      {viewQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-zinc-200/60 p-8 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">{viewQR.label || 'Attendance QR Code'}</h3>
                <p className="text-sm text-zinc-500 mt-1">
                  {viewQR.computedStatus === 'Active' 
                    ? `Expires ${formatDistanceToNow(new Date(viewQR.expiresAt), { addSuffix: true })}` 
                    : 'Expired'}
                </p>
              </div>
              <button 
                onClick={() => setViewQR(null)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-200/60 flex items-center justify-center mb-6">
              <QRCodeSVG
                value={`${window.location.origin}/attendance/${viewQR.token}`}
                size={256}
                level="H"
                imageSettings={{
                  src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYTmefnUDCIgdXIk_GGVt_J0cgINbO2yEHvENEg1u2hzJQAwq4VFEetC0&s=10',
                  height: 64,
                  width: 64,
                  excavate: true,
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => downloadQR(viewQR)}
                className="flex-1 bg-zinc-900 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shadow-md shadow-zinc-900/10"
              >
                <Download className="w-4 h-4" /> Download QR
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 bg-white text-zinc-900 border border-zinc-200 px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-zinc-50 transition-colors"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
