import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { GatePassRequest } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { apiClient } from '../../api/apiClient';

export const StudentGatePasses: React.FC = () => {
  const [passes, setPasses] = useState<GatePassRequest[]>([]);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [passType, setPassType] = useState<'DAY_OUT' | 'NIGHT_OUT' | 'HOME_VISIT' | 'EMERGENCY'>('DAY_OUT');
  const [reason, setReason] = useState('');
  const [outDate, setOutDate] = useState('');
  const [outTime, setOutTime] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPasses();
  }, []);

  const fetchPasses = async () => {
    try {
      const res = await apiClient.get<GatePassRequest[]>('/security/gate-passes/my_passes/');
      setPasses(res.data);
    } catch (err) {
      console.error('Failed to load passes', err);
    }
  };

  const handleApplyPass = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post('/security/gate-passes/', {
        pass_type: passType,
        reason,
        out_date: outDate,
        out_time: outTime,
        expected_return_date: returnDate,
        expected_return_time: returnTime,
      });
      setShowApplyModal(false);
      setReason('');
      fetchPasses();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit gate pass');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Gate Passes & Outpasses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Apply for hostel departure permits and view live approvals</p>
        </div>
        <button
          onClick={() => setShowApplyModal(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Apply New Pass</span>
        </button>
      </div>

      <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pl-2">Pass Type</th>
                <th className="pb-3">Out Date & Time</th>
                <th className="pb-3">Expected Return</th>
                <th className="pb-3">Reason / Purpose</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {passes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs italic">
                    No gate passes applied yet. Click "Apply New Pass" above to create one.
                  </td>
                </tr>
              ) : (
                passes.map((pass) => (
                  <tr key={pass.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 pl-2 font-bold text-slate-800 text-xs">
                      {String(pass.pass_type).replace(/_/g, ' ')}
                    </td>
                    <td className="py-4 text-slate-600 text-xs">
                      {pass.out_date} at {pass.out_time || 'N/A'}
                    </td>
                    <td className="py-4 text-slate-600 text-xs">
                      {pass.expected_return_date || pass.return_date} at {pass.expected_return_time || 'N/A'}
                    </td>
                    <td className="py-4 text-slate-600 text-xs italic max-w-xs truncate">
                      "{pass.reason || pass.purpose || 'Personal'}"
                    </td>
                    <td className="py-4">
                      <StatusBadge status={pass.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Pass Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-7 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Apply Gate Pass / Outpass</h3>
                <p className="text-xs text-slate-400">Request warden authorization for leaving hostel</p>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyPass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pass Type</label>
                <select
                  value={passType}
                  onChange={(e: any) => setPassType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                >
                  <option value="DAY_OUT">Day Outing (Return Today)</option>
                  <option value="NIGHT_OUT">Night Out</option>
                  <option value="HOME_VISIT">Home Visit / Multi-Day Leave</option>
                  <option value="EMERGENCY">Emergency Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Out Date</label>
                  <input
                    type="date"
                    required
                    value={outDate}
                    onChange={(e) => setOutDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Out Time</label>
                  <input
                    type="time"
                    required
                    value={outTime}
                    onChange={(e) => setOutTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Expected Return Date</label>
                  <input
                    type="date"
                    required
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Expected Return Time</label>
                  <input
                    type="time"
                    required
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason for Departure</label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State the purpose of your departure..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-5 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
