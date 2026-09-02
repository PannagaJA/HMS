import React, { useEffect, useState } from 'react';
import {
  Search,
  Plus,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import type { VisitorLog, HostelStudent } from '../../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const WardenVisitorLogs: React.FC = () => {
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [students, setStudents] = useState<HostelStudent[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    student: '',
    visitor_name: '',
    mobile_number: '',
    purpose: '',
  });

  useEffect(() => {
    fetchVisitorLogs();
    fetchStudents();
  }, []);

  const fetchVisitorLogs = async () => {
    try {
      const res = await apiClient.get<VisitorLog[]>('/warden/visitor-logs/');
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load visitor logs', err);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await apiClient.get<HostelStudent[]>('/warden/students/');
      setStudents(res.data);
    } catch (err) {
      console.error('Failed to load students for visitor register', err);
    }
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const st = students.find((s) => s.id === Number(formData.student));
      await apiClient.post('/warden/visitor-logs/', {
        ...formData,
        student: Number(formData.student),
        hostel: st?.hostel || st?.room_detail?.id || 1,
      });
      setShowAddModal(false);
      setFormData({ student: '', visitor_name: '', mobile_number: '', purpose: '' });
      fetchVisitorLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to register visitor');
    }
  };

  const handleCheckout = async (id: number) => {
    try {
      await apiClient.post(`/warden/visitor-logs/${id}/checkout/`);
      fetchVisitorLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to checkout visitor');
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const mob = log.mobile_number || log.visitor_phone || '';
    return (
      log.visitor_name.toLowerCase().includes(q) ||
      (log.student_name && log.student_name.toLowerCase().includes(q)) ||
      mob.includes(q) ||
      log.purpose.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Visitor Register & Logs</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track external guests visiting residents in assigned blocks</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-colors flex items-center gap-2 shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Register New Visitor
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by visitor name, resident student, mobile number, or purpose..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white pl-10 pr-4 py-2.5 rounded-full text-xs border border-slate-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
        />
      </div>

      {/* Visitors Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Visitor</th>
                <th className="px-5 py-3.5">Resident Student</th>
                <th className="px-5 py-3.5">Purpose</th>
                <th className="px-5 py-3.5">Check-In</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    No visitor logs recorded yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const checkInTime = log.check_in_time || log.entry_time || '';
                  const checkOutTime = log.check_out_time || log.exit_time || null;
                  const isInside = !checkOutTime;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">{log.visitor_name}</div>
                        <div className="text-[10px] text-slate-400">{log.mobile_number || log.visitor_phone}</div>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">
                        {log.student_name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 italic">
                        "{log.purpose}"
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {checkInTime ? new Date(checkInTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[10px] ${
                            isInside
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isInside ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                          {isInside ? 'INSIDE' : 'CHECKED OUT'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isInside ? (
                          <button
                            onClick={() => handleCheckout(log.id)}
                            className="px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
                          >
                            Mark Exit
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">
                            Left at {checkOutTime ? new Date(checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Visitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-1">Register New Visitor</h3>
            <p className="text-xs text-slate-500 mb-4">Record guest check-in at hostel gate</p>

            <form onSubmit={handleCreateLog} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Visiting Student *</label>
                <Select value={formData.student} onValueChange={(val) => setFormData({ ...formData, student: val })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Resident Student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((st) => (
                      <SelectItem key={st.id} value={String(st.id)}>
                        {st.student_name} ({st.enrollment_no}) - Room {st.room_detail?.no || st.room_no || 'N/A'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Visitor Full Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.visitor_name}
                  onChange={(e) => setFormData({ ...formData, visitor_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (10 Digits) *</label>
                <input
                  required
                  type="tel"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="9876543210"
                  value={formData.mobile_number}
                  onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Purpose of Visit *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Parents visiting, delivering documents"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-xs cursor-pointer"
                >
                  Check In Visitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
