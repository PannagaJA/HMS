import React, { useEffect, useState } from 'react';
import { Search, Plus, CheckCircle } from 'lucide-react';
import type { VisitorLog } from '../../types';
import { apiClient } from '../../api/apiClient';

export const VisitorLogsManagement: React.FC = () => {
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [studentId, setStudentId] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [purpose, setPurpose] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await apiClient.get<VisitorLog[]>('/security/visitors/');
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load visitor logs', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/security/visitors/', {
        student: Number(studentId),
        visitor_name: visitorName,
        mobile_number: mobileNumber,
        purpose,
        check_in_time: new Date().toISOString(),
      });
      setShowModal(false);
      setStudentId('');
      setVisitorName('');
      setMobileNumber('');
      setPurpose('');
      fetchLogs();
    } catch (err) {
      alert('Failed to register visitor');
    }
  };

  const handleCheckOut = async (id: number) => {
    try {
      await apiClient.post(`/security/visitors/${id}/check_out/`);
      fetchLogs();
    } catch (err) {
      alert('Failed to mark visitor exit');
    }
  };

  const filtered = logs.filter((l) =>
    l.visitor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.enrollment_no.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Visitor Logbook</h1>
          <p className="text-sm text-slate-500 mt-0.5">Audit campus guest entries, parents, guardians, and contractor check-ins</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-full bg-[#0D3833] text-white text-sm font-semibold hover:bg-[#064E3B] transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Log New Visitor</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by visitor name, student, or phone..."
            className="w-full bg-slate-50 pl-10 pr-4 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pl-6">Visitor</th>
                <th className="py-3.5 px-4">Contact Phone</th>
                <th className="py-3.5 px-4">Visiting Resident</th>
                <th className="py-3.5 px-4">Visit Purpose</th>
                <th className="py-3.5 px-4">Check-In Time</th>
                <th className="py-3.5 pr-6 text-right">Status / Exit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No visitor logs recorded.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 pl-6 font-semibold text-slate-800">
                      {l.visitor_name}
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-600">
                      {l.mobile_number}
                    </td>
                    <td className="py-4 px-4 text-xs">
                      <div className="font-semibold text-slate-800">{l.student_name}</div>
                      <div className="text-slate-400">{l.enrollment_no}</div>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600">
                      {l.purpose}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-700">
                      {new Date(l.check_in_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-4 pr-6 text-right">
                      {l.check_out_time ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> Checked Out
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCheckOut(l.id)}
                          className="px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold hover:bg-amber-100 transition-colors"
                        >
                          Mark Check-Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Log Hostel Guest Entry</h3>
            <p className="text-xs text-slate-500 mb-5">Enter visitor identity credentials and host student USN.</p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Visitor Full Name</label>
                <input
                  type="text"
                  required
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Visitor Mobile</label>
                  <input
                    type="text"
                    required
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="+91 98..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Host Student ID</label>
                  <input
                    type="number"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="1"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Visit Purpose</label>
                <input
                  type="text"
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Parents visit / academic materials delivery"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm"
                >
                  Register Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
