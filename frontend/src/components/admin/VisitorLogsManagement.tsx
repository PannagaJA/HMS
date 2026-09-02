import React, { useEffect, useState } from 'react';
import { Search, LogOut, Download } from 'lucide-react';
import type { VisitorLog } from '../../types';
import { apiClient } from '../../api/apiClient';

export const VisitorLogsManagement: React.FC = () => {
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'CHECKED_IN' | 'CHECKED_OUT'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentRoom, setStudentRoom] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [relation, setRelation] = useState('Parent');
  const [purpose, setPurpose] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await apiClient.get<VisitorLog[]>('/hms/visitor-logs/');
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load visitor logs', err);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/hms/visitor-logs/', {
        visitor_name: visitorName,
        visitor_phone: visitorPhone,
        mobile_number: visitorPhone,
        student_name: studentName,
        student_room: studentRoom,
        enrollment_no: enrollmentNo,
        relation,
        purpose,
        status: 'CHECKED_IN',
      });
      setShowAddModal(false);
      setVisitorName('');
      setVisitorPhone('');
      setStudentName('');
      setStudentRoom('');
      setEnrollmentNo('');
      setPurpose('');
      fetchLogs();
    } catch (err) {
      alert('Failed to register visitor check-in');
    }
  };

  const handleCheckOut = async (id: number) => {
    if (!confirm('Mark visitor as checked out?')) return;
    try {
      await apiClient.post(`/hms/visitor-logs/${id}/checkout/`);
      fetchLogs();
    } catch (err) {
      alert('Failed to check out visitor');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.visitor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.enrollment_no ? l.enrollment_no.toLowerCase().includes(searchTerm.toLowerCase()) : false);

    if (filterStatus === 'ALL') return matchesSearch;
    return matchesSearch && l.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Campus Visitor & Guest Register</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track external guests, family members, and guardian visits to hostel blocks</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Log</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>+ Check In Visitor</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search visitor or student name..."
            className="w-full bg-slate-50 pl-10 pr-4 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(['ALL', 'CHECKED_IN', 'CHECKED_OUT'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                filterStatus === tab
                  ? 'bg-[#0D3833] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'ALL' ? 'All Visitors' : tab === 'CHECKED_IN' ? 'Currently Inside' : 'Departed'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pl-6">Visitor</th>
                <th className="py-3.5 px-4">Relation</th>
                <th className="py-3.5 px-4">Visiting Student</th>
                <th className="py-3.5 px-4">Purpose</th>
                <th className="py-3.5 px-4">Check-In Time</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No visitor records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 pl-6 font-semibold text-slate-800">
                      <div>{log.visitor_name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{log.visitor_phone || log.mobile_number || 'N/A'}</div>
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-slate-600">
                      {log.relation}
                    </td>
                    <td className="py-4 px-4 text-xs">
                      <span className="font-bold text-slate-800">{log.student_name}</span>
                      <div className="text-slate-400">{log.student_room ? `Room ${log.student_room}` : log.enrollment_no || ''}</div>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600">
                      {log.purpose}
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-500">
                      {log.entry_time || log.check_in_time ? new Date(log.entry_time || log.check_in_time || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        log.status === 'CHECKED_IN'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {log.status === 'CHECKED_IN' ? 'CURRENTLY INSIDE' : 'CHECKED OUT'}
                      </span>
                    </td>
                    <td className="py-4 pr-6 text-right">
                      {log.status === 'CHECKED_IN' ? (
                        <button
                          onClick={() => handleCheckOut(log.id)}
                          className="px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Mark Exit</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Out at {log.exit_time || log.check_out_time ? new Date(log.exit_time || log.check_out_time || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Check In Visitor</h3>
            <p className="text-xs text-slate-500 mb-5">Record visitor details and destination student.</p>

            <form onSubmit={handleCheckIn} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Visitor Name</label>
                  <input
                    type="text"
                    required
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Name</label>
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Room No</label>
                  <input
                    type="text"
                    value={studentRoom}
                    onChange={(e) => setStudentRoom(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Relation</label>
                  <input
                    type="text"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    placeholder="e.g. Father / Guardian"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purpose of Visit</label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Document delivery"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer"
                >
                  Register Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
