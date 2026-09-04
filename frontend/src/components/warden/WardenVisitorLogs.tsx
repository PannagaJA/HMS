import React, { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Building2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../api/apiClient';
import type { VisitorLog, HostelStudent, Hostel } from '../../types';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { wardenService } from '../../services/wardenService';
import { adminService } from '../../services/adminService';
import { useDebounce } from '../../hooks/useDebounce';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const WardenVisitorLogs: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError, confirm } = useNotification();
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [students, setStudents] = useState<HostelStudent[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
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
    fetchHostels();
  }, [user]);

  const fetchHostels = async () => {
    try {
      let hostList: Hostel[] = [];
      if (user?.role === 'WARDEN') {
        hostList = await wardenService.getAssignedHostels(user.id);
      } else {
        hostList = await adminService.getHostels();
      }
      setHostels(hostList);

      if (hostList.length > 0) {
        setSelectedHostelId((prev) => {
          if (prev && (prev === 'ALL' || hostList.some((h) => String(h.id) === prev))) {
            return prev;
          }
          return String(hostList[0].id);
        });
      } else {
        setSelectedHostelId('ALL');
      }
    } catch (err) {
      console.error('Failed to load hostels', err);
    }
  };

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
      console.error('Failed to load students', err);
    }
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const st = students.find((s) => String(s.id) === String(formData.student));
      const studentId = Number(formData.student);
      const hostelId = st?.hostel || (st?.room_detail as any)?.hostel_id || (st as any)?.hostel_id || 1;
      const roomId = st?.room_detail?.id || (st as any)?.room_id || 1;
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from('visitor_logs').insert({
        student_id: studentId,
        hostel_id: hostelId,
        room_id: roomId,
        visitor_name: formData.visitor_name,
        mobile_number: formData.mobile_number,
        purpose: formData.purpose,
        check_in_time: new Date().toISOString(),
        recorded_by: userData.user?.id || null
      });

      if (error) throw error;

      showSuccess(`Visitor ${formData.visitor_name} check-in registered.`);
      setShowAddModal(false);
      setFormData({ student: '', visitor_name: '', mobile_number: '', purpose: '' });
      fetchVisitorLogs();
    } catch (err: any) {
      showError(err.message || err.response?.data?.error || 'Failed to register visitor');
    }
  };

  const handleCheckout = async (id: number) => {
    const isConfirmed = await confirm({
      title: 'Checkout Visitor',
      message: 'Mark this visitor as checked out of the hostel premises?',
      confirmText: 'Check Out'
    });
    if (!isConfirmed) return;

    try {
      const { error } = await supabase
        .from('visitor_logs')
        .update({ check_out_time: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      showSuccess('Visitor checked out successfully.');
      fetchVisitorLogs();
    } catch (err: any) {
      showError(err.message || err.response?.data?.error || 'Failed to checkout visitor');
    }
  };

  const debouncedSearch = useDebounce(search, 300);

  const filteredLogs = logs.filter((log: any) => {
    // 1. Filter by Hostel Block
    let matchesHostel = true;
    if (selectedHostelId && selectedHostelId !== 'ALL') {
      const selectedHostelObj = hostels.find((h) => String(h.id) === selectedHostelId);
      const selectedName = selectedHostelObj?.name ? selectedHostelObj.name.toLowerCase().trim() : '';
      const logHostelName = (log.hostel_name || (log.hostel && typeof log.hostel === 'object' ? log.hostel.name : '') || '').toLowerCase().trim();
      const logHostelId = String(log.hostel_id || log.hostel || (log.hostel && typeof log.hostel === 'object' ? log.hostel.id : '') || '');

      matchesHostel =
        hostels.length <= 1 ||
        logHostelId === selectedHostelId ||
        String(log.hostel) === selectedHostelId ||
        String(log.hostel_id) === selectedHostelId ||
        (Boolean(selectedName) && Boolean(logHostelName) && (
          logHostelName.includes(selectedName) || 
          selectedName.includes(logHostelName) ||
          (selectedName.includes('boys') && (logHostelName.includes('boys') || logHostelName.includes('aryabhata'))) ||
          (selectedName.includes('girls') && logHostelName.includes('girls'))
        ));
    }

    // 2. Filter by Search term
    if (!debouncedSearch) return matchesHostel;
    const q = debouncedSearch.toLowerCase();
    const mob = log.mobile_number || log.visitor_phone || '';
    const matchesSearch =
      log.visitor_name.toLowerCase().includes(q) ||
      (log.student_name && log.student_name.toLowerCase().includes(q)) ||
      mob.includes(q) ||
      log.purpose.toLowerCase().includes(q);

    return matchesHostel && matchesSearch;
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
          className="w-full sm:w-auto px-4 py-2.5 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Register New Visitor
        </button>
      </div>

      {/* Filter Toolbar with Hostel Block Selector */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1 max-w-md">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Select Hostel:</span>
          </span>
          <div className="flex-1 min-w-[200px]">
            <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
              <SelectTrigger className="w-full bg-slate-50 border-slate-200 font-semibold text-slate-800">
                <SelectValue placeholder="Choose hostel block" />
              </SelectTrigger>
              <SelectContent>
                {user?.role === 'ADMIN' && (
                  <SelectItem value="ALL">All Hostel Blocks</SelectItem>
                )}
                {user?.role === 'WARDEN' && hostels.length > 1 && (
                  <SelectItem value="ALL">All My Assigned Hostels</SelectItem>
                )}
                {hostels.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by visitor name, resident student, mobile number, or purpose..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 pl-10 pr-4 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
          />
        </div>
      </div>

      {/* Mobile View: Cards Grid (< md) */}
      <div className="block md:hidden space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs">
            No visitor logs recorded yet.
          </div>
        ) : (
          filteredLogs.map((log: any) => {
            const checkInTime = log.check_in_time || log.entry_time || '';
            const checkOutTime = log.check_out_time || log.exit_time || null;
            const isInside = !checkOutTime;

            return (
              <div key={log.id} className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{log.visitor_name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{log.mobile_number || log.visitor_phone || 'N/A'}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[10px] shrink-0 ${
                      isInside
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isInside ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                    {isInside ? 'INSIDE' : 'CHECKED OUT'}
                  </span>
                </div>

                <div className="text-xs space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 font-medium">Resident:</span>
                    <span className="font-bold text-slate-800">{log.student_name}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 font-medium">Purpose:</span>
                    <span className="italic text-slate-700">"{log.purpose}"</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 font-medium">Check-In:</span>
                    <span>{checkInTime ? new Date(checkInTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-end">
                  {isInside ? (
                    <button
                      onClick={() => handleCheckout(log.id)}
                      className="w-full py-2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      Mark Exit
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">
                      Left at {checkOutTime ? new Date(checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop View: Visitors Table (>= md) */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (10 Digits) *</label>
                <input
                  required
                  type="tel"
                  maxLength={10}
                  pattern="^[6-9][0-9]{9}$"
                  title="Enter a valid 10-digit Indian mobile number starting with 6-9"
                  placeholder="9876543210"
                  value={formData.mobile_number}
                  onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
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
                  className="px-5 py-2 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-xs cursor-pointer"
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
