import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from "../lib/api";
import { useCrud } from '../hooks/useCrud';

export default function AttendanceForm() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [qrLabel, setQrLabel] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    submitting,
    createRecord
  } = useCrud<any>({ endpoint: `api/public/qrcodes/${token}/submit` });

  const [formData, setFormData] = useState({
    fullName: '',
    idNumber: '',
    idType: 'student_id',
    gender: 'other',
    contact: '',
    timeIn: new Date().toISOString().slice(0, 16),
    timeOut: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await api.get(`api/public/qrcodes/validate/${token}`);
        if (res.data && res.data.success) {
          setQrLabel(res.data.data.label || 'Attendance Sign-in');
        }
      } catch (err: any) {
        setErrorMsg(err.response?.data?.error || 'Invalid or expired QR code.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Full Name is required';
    if (!formData.idNumber.trim()) newErrors.idNumber = 'ID Number is required';
    if (!formData.contact.trim()) newErrors.contact = 'Contact is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await createRecord(formData);
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Unavailable</h2>
          <p className="text-zinc-500 text-sm leading-relaxed">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Success!</h2>
          <p className="text-zinc-500 text-sm leading-relaxed">Your attendance has been recorded successfully. You may close this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans tracking-tight">
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center gap-4">
        <img 
          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYTmefnUDCIgdXIk_GGVt_J0cgINbO2yEHvENEg1u2hzJQAwq4VFEetC0&s=10" 
          alt="IAC Logo" 
          className="h-10 object-contain"
        />
        <div>
          <h1 className="text-sm font-bold text-[#00205B]">University of Ghana</h1>
          <h2 className="text-xs text-zinc-500">Information Access Center</h2>
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto p-4 md:p-6 lg:py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="bg-[#00205B] px-6 py-8 text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 flex">
              <div className="h-full flex-1 bg-[#CE1126]"></div>
              <div className="h-full flex-1 bg-[#FCD116]"></div>
              <div className="h-full flex-1 bg-[#006B3F]"></div>
            </div>
            <h2 className="text-2xl font-bold mb-1">{qrLabel}</h2>
            <p className="text-blue-100 text-sm">Please fill out this form to record your attendance.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g. Akua Serwaa Mensah"
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00205B]/20 focus:border-[#00205B] transition-colors text-sm"
              />
              {errors.fullName && <p className="text-xs text-[#CE1126] mt-1">{errors.fullName}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">ID Type</label>
                <select
                  value={formData.idType}
                  onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00205B]/20 focus:border-[#00205B] transition-colors text-sm appearance-none"
                >
                  <option value="student_id">Student ID</option>
                  <option value="ghana_card">Ghana Card</option>
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
                  value={formData.idNumber}
                  onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                  placeholder="e.g. 10293847"
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00205B]/20 focus:border-[#00205B] transition-colors text-sm"
                />
                {errors.idNumber && <p className="text-xs text-[#CE1126] mt-1">{errors.idNumber}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00205B]/20 focus:border-[#00205B] transition-colors text-sm appearance-none"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Contact</label>
                <input
                  type="tel"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  placeholder="+233 XX XXX XXXX"
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00205B]/20 focus:border-[#00205B] transition-colors text-sm"
                />
                {errors.contact && <p className="text-xs text-[#CE1126] mt-1">{errors.contact}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Time In</label>
                <input
                  type="datetime-local"
                  value={formData.timeIn}
                  onChange={(e) => setFormData({ ...formData, timeIn: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00205B]/20 focus:border-[#00205B] transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Time Out</label>
                <input
                  type="datetime-local"
                  value={formData.timeOut}
                  onChange={(e) => setFormData({ ...formData, timeOut: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00205B]/20 focus:border-[#00205B] transition-colors text-sm"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#00205B] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#001740] transition-colors disabled:opacity-50 shadow-md shadow-[#00205B]/20"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Attendance'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
