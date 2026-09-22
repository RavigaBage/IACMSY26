import { useState, useEffect } from 'react';
import { Coffee, Plus, Save, Clock, X, User, Edit2, Trash2 } from 'lucide-react';
import { useCrud } from "../hooks/useCrud";
import { useFuzzySearch } from '../hooks/useFuzzySearch';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Pagination } from '../components/ui/Pagination';

interface LoungeUser {
  _id: string;
  name: string;
  identifier: string;
  identifierType: string;
  contactNumber: string;
  gender: string;
  timeIn: string;
  timeOut?: string;
  Signature: string;
}

export default function Lounge() {
  const {
    data: users,
    loading,
    submitting,
    fetchAll: fetchUsers,
    createRecord,
    updateRecord,
    deleteRecord,
    pages: pageNumber,
  } = useCrud<LoungeUser>({ endpoint: 'api/users/lounge-data' });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const totalPages = pageNumber;

  const [searchQuery, setSearchQuery] = useState('');
  
  const fuzzyFilteredUsers = useFuzzySearch<LoungeUser>(users || [], searchQuery, {
    keys: ['name', 'identifier', 'Signature']
  });
  
 

  // Form State
  const [formData, setFormData] = useState({
    full_name: '',
    user_id: '',
    user_id_type: 'ghana_card',
    contact: '',
    gender: 'male',
    user_time_in: '',
    user_time_out: ''
  });

useEffect(() => {
  fetchUsers({ page: currentPage, limit: 20 });
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  setFormData((prev) => ({ ...prev, user_time_in: now.toISOString().slice(0, 16) }));
}, [currentPage, fetchUsers]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Full Name is required';
    if (!formData.user_id.trim()) newErrors.user_id = 'ID Number is required';
    if (!formData.contact.trim()) newErrors.contact = 'Contact Number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      if (editingId) {
        await updateRecord(editingId, formData);
      } else {
        await createRecord(formData, 'api/users/submit-lounge-data');
      }
      setIsFormOpen(false);
      setEditingId(null);
      setErrors({});
      // Reset form
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setFormData({
        full_name: '',
        user_id: '',
        user_id_type: 'ghana_card',
        contact: '',
        gender: 'male',
        user_time_in: now.toISOString().slice(0, 16),
        user_time_out: ''
      });
    } catch {
      // Error is handled in useCrud
    }
  };

  const handleEdit = (user: LoungeUser) => {
    setFormData({
      full_name: user.name || user.Signature,
      user_id: user.identifier,
      user_id_type: user.identifierType || 'ghana_card',
      contact: user.contactNumber,
      gender: user.gender || 'male',
      user_time_in: user.timeIn ? user.timeIn:"",
      user_time_out: user.timeOut ? user.timeOut:"" 
    });
    setEditingId(user._id);
    setIsFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      await deleteRecord(itemToDelete, 'api/users/lounge');
    } catch {
      // Error is handled in useCrud
    } finally {
      setItemToDelete(null);
    }
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setErrors({});
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setFormData({
      full_name: '',
      user_id: '',
      user_id_type: 'ghana_card',
      contact: '',
      gender: 'male',
      user_time_in: now.toISOString().slice(0, 16),
      user_time_out: ''
    });
  };

  const formatTimeColor = (timeVal: string): string => {

    const hour = Number(
      (timeVal.includes("T") ? timeVal.split("T")[1] : timeVal).split(":")[0]
    );

    if (hour < 12) {
      return "morn";
    } else {
      return "even";
    }
  };

  const formatIdType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto transition-opacity duration-500 ease-in-out opacity-100">
      <ConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Record"
        message="Are you sure you want to delete this record? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
      />
      
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white rounded-xl border border-zinc-200/60 shadow-sm">
            <Coffee className="w-6 h-6 text-zinc-900" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Internet Lounge</h1>
            <p className="text-zinc-500 text-sm mt-1">Manage internet access tokens and active users.</p>
          </div>
        </div>
        
        <button 
          onClick={() => {
            if (isFormOpen) {
              handleCancel();
            } else {
              setIsFormOpen(true);
            }
          }}
          className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors text-sm font-medium flex items-center gap-2 self-start md:self-auto"
        >
          {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isFormOpen ? 'Cancel' : 'Add User'}
        </button>
      </header>
      
      {isFormOpen && (
        <div className="mb-8 bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
            <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
              <User className="w-5 h-5 text-zinc-400" />
              {editingId ? 'Edit User Record' : 'Register New User'}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Full Name (Signature)</label>
                <input 
                  type="text" 
                  name="full_name" 
                  required
                  value={formData.full_name} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                  placeholder="e.g. John Doe"
                />
                {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Contact Number</label>
                <input 
                  type="text" 
                  name="contact" 
                  required
                  value={formData.contact} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                  placeholder="e.g. 0501234567"
                />
                {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">ID Type</label>
                <select 
                  name="user_id_type" 
                  value={formData.user_id_type} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm bg-white"
                >
                  <option value="ghana_card">Ghana Card</option>
                  <option value="student_id">Student ID</option>
                  <option value="passport">Passport</option>
                  <option value="driver_license">Driver License</option>
                  <option value="voter_id">Voter ID</option>
                  <option value="nhis_card">NHIS Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">ID Number</label>
                <input 
                  type="text" 
                  name="user_id" 
                  required
                  value={formData.user_id} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                  placeholder="ID Number"
                />
                {errors.user_id && <p className="text-xs text-red-500 mt-1">{errors.user_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Gender</label>
                <select 
                  name="gender" 
                  value={formData.gender} 
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm bg-white"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Time In</label>
                  <input 
                    type="datetime-local" 
                    name="user_time_in" 
                    required
                    value={formData.user_time_in} 
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Time Out (Optional)</label>
                  <input 
                    type="datetime-local" 
                    name="user_time_out" 
                    value={formData.user_time_out} 
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end pt-6 border-t border-zinc-100">
              <button 
                type="submit" 
                disabled={submitting}
                className="px-6 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {submitting ? 'Saving...' : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Record
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-6 flex items-center bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-sm">
        <div className="flex-1 relative w-full">
          <input 
            type="text" 
            placeholder="Search users by name, ID or signature..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-200/60">
                <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">User</th>
                <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Contact</th>
                <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Identification</th>
                <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Time In</th>
                <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin mx-auto mb-3"></div>
                    Loading records...
                  </td>
                </tr>
              ) : fuzzyFilteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <Coffee className="w-8 h-8 mx-auto mb-3 text-zinc-300" />
                    No users found.
                  </td>
                </tr>
              ) : (
                fuzzyFilteredUsers.map((user: LoungeUser) => {
                  const isActive = !user.timeOut || user.timeOut === '';
                  return (
                    <tr key={user._id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-900">{user.name}</div>
                        <div className="text-xs text-zinc-500 capitalize">{user.gender}</div>
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-zinc-600">{user.contactNumber}</td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-zinc-700">{user.identifier}</div>
                        <div className="text-xs text-zinc-500">{formatIdType(user.identifierType)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-zinc-600 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          <p className={`md:font-bold ${formatTimeColor(user.timeIn) === 'morn' ? 'text-green-800' : 'text-red-500'}`}>
                            {user.timeIn}
                          </p>
                        </div>
                        <div className="text-xs text-zinc-400">
                          {user.timeIn}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium  bg-emerald-600 text-white border border-zinc-200/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                            Checked Out
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setItemToDelete(user._id)}
                            className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="px-6 bg-zinc-50/50 border-t border-zinc-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
