import { useState, useEffect } from 'react';
import { FileBarChart2, Loader2, Plus, Download, Eye, Trash2, AlertCircle, X, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Pagination } from '../components/ui/Pagination';
import { format } from 'date-fns';
import { useCrud } from '../hooks/useCrud';
import { useFuzzySearch } from '../hooks/useFuzzySearch';

interface Report {
  _id: string;
  title: string;
  reportType: string;
  dateRange: {
    from: string;
    to: string;
  };
  createdAt: string;
  generatedBy?: {
    name: string;
    email: string;
  };
  summary: any;
  chartData: any;
  tableData: any;
}
const REPORT_TYPE = [
   'internet_lounge',
  'seminar_rooms',
  'training_rooms',
  'conference_rooms',
  'center_overview',
  'device_status',
  'custom'
]
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function Reports() {
  const {
    data: reportsData,
    loading,
    fetchAll: fetchReports,
    deleteRecord,
  } = useCrud<any>({ endpoint: 'api/reports' });
  
  // Extract actual reports array from res.data.data
  const reports: Report[] = reportsData?.data || reportsData || [];

  const { success, error } = useToast();

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedReportType, setReportType] = useState('center_overview');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = useState('');

  const [viewReport, setViewReport] = useState<Report | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fuzzyFilteredReports = useFuzzySearch(reports, searchQuery, {
    keys: ['title', 'reportType', 'generatedBy.name']
  });

  const filteredReports = fuzzyFilteredReports.filter(r => {
    if (filterType !== 'All' && r.reportType !== filterType) return false;
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE) || 1;
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      await api.post('api/reports/generate/monthly', { month: selectedMonth, year: selectedYear,reportType:selectedReportType });
      success('Report generated successfully');
      setIsGenerateModalOpen(false);
      await fetchReports();
    } catch (err: any) {
      error(err.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteRecord(deleteId, 'api/reports');
    } catch {
      // Error handled by useCrud
    } finally {
      setDeleteId(null);
    }
  };


  const handleDownload = async (report: Report, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const safeTitle = (report.title || 'IAC_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      await api.download(`api/reports/${report._id}/excel`, `${safeTitle}.xlsx`);
      success('Excel report downloaded successfully');
    } catch (err: any) {
      error(err.message || 'Failed to download Excel report');
    }
  };

  const handleExportCurrentMonthExcel = async () => {
    try {
      await api.download(
        `api/reports/export?month=${selectedMonth}&year=${selectedYear}`,
        `IAC_Monthly_Report_${selectedMonth}_${selectedYear}.xlsx`
      );
      success('Monthly Excel report downloaded successfully');
    } catch (err: any) {
      error(err.message || 'Failed to export monthly Excel report');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (viewReport) {
    return (
      <div className="p-8 max-w-5xl mx-auto bg-white min-h-screen">
        <div className="print:hidden mb-8 flex items-center justify-between">
          <button 
            onClick={() => setViewReport(null)}
            className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Close
          </button>
          <button 
            onClick={handlePrint}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Print / Export PDF
          </button>
        </div>

        <div className="print:block">
          <div className="text-center mb-10 border-b border-zinc-200 pb-8">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{viewReport.title}</h1>
            <p className="text-zinc-500 mt-2 text-sm">
              Generated on {format(new Date(viewReport.createdAt), 'PPP')} by {viewReport.generatedBy?.name || 'System'}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
              <div className="text-sm font-medium text-zinc-500 mb-1">Total Visitors</div>
              <div className="text-2xl font-bold text-zinc-900">{viewReport.summary?.totalVisitors || 0}</div>
            </div>
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
              <div className="text-sm font-medium text-zinc-500 mb-1">Total Events</div>
              <div className="text-2xl font-bold text-zinc-900">{viewReport.summary?.totalEvents || 0}</div>
            </div>
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
              <div className="text-sm font-medium text-zinc-500 mb-1">Total Participants</div>
              <div className="text-2xl font-bold text-zinc-900">{viewReport.summary?.totalParticipants || 0}</div>
            </div>
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 text-center">
              <div className="text-sm font-medium text-zinc-500 mb-1">Revenue Generated</div>
              <div className="text-2xl font-bold text-emerald-600">${viewReport.summary?.totalRevenue || 0}</div>
            </div>
          </div>

          <h3 className="text-xl font-bold text-zinc-900 mb-4 border-b border-zinc-200 pb-2">Room Utilization Breakdown</h3>
          <div className="mb-10 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {viewReport.chartData?.roomUtilization?.map((ru: any) => (
              <div key={ru.room} className="p-3 bg-white border border-zinc-200 rounded-lg flex justify-between items-center">
                <span className="text-sm font-medium text-zinc-700">{ru.room}</span>
                <span className="text-sm font-bold text-zinc-900">{ru.count} events</span>
              </div>
            ))}
            {(!viewReport.chartData?.roomUtilization || viewReport.chartData.roomUtilization.length === 0) && (
              <div className="text-sm text-zinc-500 col-span-full">No events recorded this month.</div>
            )}
          </div>

          <h3 className="text-xl font-bold text-zinc-900 mb-4 border-b border-zinc-200 pb-2">Daily Event Details</h3>
          <div className="mb-10 overflow-x-auto">
            <table className="w-full text-left border-collapse border border-zinc-200">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="py-2 px-3 text-xs font-semibold text-zinc-500 uppercase">Date</th>
                  <th className="py-2 px-3 text-xs font-semibold text-zinc-500 uppercase">Room</th>
                  <th className="py-2 px-3 text-xs font-semibold text-zinc-500 uppercase">Event Name</th>
                  <th className="py-2 px-3 text-xs font-semibold text-zinc-500 uppercase">Organizer</th>
                  <th className="py-2 px-3 text-xs font-semibold text-zinc-500 uppercase">Participants</th>
                  <th className="py-2 px-3 text-xs font-semibold text-zinc-500 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {viewReport.tableData?.events?.map((ev: any, idx: number) => (
                  <tr key={idx} className="hover:bg-zinc-50/50">
                    <td className="py-2 px-3 text-sm text-zinc-900">{format(new Date(ev.date), 'MMM d, yyyy')}</td>
                    <td className="py-2 px-3 text-sm text-zinc-700">{ev.room}</td>
                    <td className="py-2 px-3 text-sm text-zinc-700 font-medium">{ev.programName}</td>
                    <td className="py-2 px-3 text-sm text-zinc-500">{ev.organizer}</td>
                    <td className="py-2 px-3 text-sm text-zinc-500">{ev.participants}</td>
                    <td className="py-2 px-3 text-sm text-zinc-500">
                      ${ev.paymentStatus === 'Paid' ? ev.amountDue : (ev.paymentStatus === 'Partially Paid' ? ev.amountDue/2 : 0)}
                    </td>
                  </tr>
                ))}
                {(!viewReport.tableData?.events || viewReport.tableData.events.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-500 text-sm">No events found for this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-xl font-bold text-zinc-900 mb-4 border-b border-zinc-200 pb-2">Daily Visitor Counts</h3>
          <div className="mb-10 overflow-x-auto">
            <table className="w-full text-left border-collapse border border-zinc-200">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="py-2 px-3 text-xs font-semibold text-zinc-500 uppercase">Date</th>
                  <th className="py-2 px-3 text-xs font-semibold text-zinc-500 uppercase">Total Visitors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {viewReport.chartData?.visitsByDay?.map((vd: any, idx: number) => (
                  <tr key={idx} className="hover:bg-zinc-50/50">
                    <td className="py-2 px-3 text-sm text-zinc-900">{vd._id}</td>
                    <td className="py-2 px-3 text-sm text-zinc-700 font-medium">{vd.visitors}</td>
                  </tr>
                ))}
                {(!viewReport.chartData?.visitsByDay || viewReport.chartData.visitsByDay.length === 0) && (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-zinc-500 text-sm">No visitor logs found for this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto transition-opacity duration-500 ease-in-out opacity-100">
      
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete Report"
        message={`Delete the report "${deleteTitle}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
      />

      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900">Generate Report</h3>
              <button 
                onClick={() => !isGenerating && setIsGenerateModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
                disabled={isGenerating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Select Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  disabled={isGenerating}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm bg-white"
                >
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Select Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  disabled={isGenerating}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm bg-white"
                >
                  {YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-700 mb-1">Report Type</label>
                <select
                  value={selectedReportType}
                  onChange={(e) => setReportType(e.target.value)}
                  disabled={isGenerating}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm bg-white"
                >
                  {REPORT_TYPE.map((rt) => (
                    <option key={rt} value={rt}>{rt}</option>
                  ))}
                </select>
              </div>
            
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsGenerateModalOpen(false)}
                  disabled={isGenerating}
                  className="px-4 py-2 text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 text-sm font-medium flex items-center gap-2 disabled:opacity-70"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileBarChart2 className="w-4 h-4" />}
                  {isGenerating ? 'Generating...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-xl border border-zinc-200/60 shadow-sm">
            <FileBarChart2 className="w-6 h-6 text-zinc-900" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Reports</h1>
            <p className="text-zinc-500 text-sm mt-1">Generate, view, and export monthly system reports.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCurrentMonthExcel}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Excel (.xlsx)
          </button>
          <button 
            onClick={() => setIsGenerateModalOpen(true)}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </header>

      <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-sm">
        <div className="flex-1 relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search reports by title or author..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm"
          />
        </div>
        <select 
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm bg-white"
        >
          {REPORT_TYPE.map((reportsType,index)=>(
            <option key={index} value={reportsType}>{reportsType}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-200/60">
                <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Report Title/Period</th>
                <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Month Covered</th>
                <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date Generated</th>
                <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Generated By</th>
                <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin mx-auto mb-3"></div>
                    Loading reports...
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-3 text-zinc-300" />
                    No reports found.
                  </td>
                </tr>
              ) : (
                paginatedReports.map(report => (
                  <tr key={report._id} className="hover:bg-zinc-50/50 transition-colors">

                    <td className="py-3 px-4">
                      <div className="font-medium text-zinc-900">{report.title}</div>
                      <div className="text-xs text-zinc-500">{report.reportType === 'monthly_summary' ? 'Monthly Snapshot' : 'Custom Report'}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-600">
                      {format(new Date(report.dateRange.from), 'MMMM yyyy')}
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-600">
                      {format(new Date(report.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-600">
                      {report.generatedBy?.name || 'Admin'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewReport(report)}
                          className="p-1.5 text-zinc-600 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDownload(report, e)}
                          className="p-1.5 text-zinc-600 bg-white border border-zinc-200 rounded-md hover:bg-zinc-50 transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteTitle(report.title);
                            setDeleteId(report._id);
                          }}
                          className="p-1.5 text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
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
    </div>
  );
}
