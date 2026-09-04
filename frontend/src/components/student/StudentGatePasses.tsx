import React, { useEffect, useState } from 'react';
import { Plus, X, QrCode, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { GatePassRequest } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { apiClient } from '../../api/apiClient';
import { useNotification } from '../../context/NotificationContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { formatTime12 } from '../../lib/utils';

export const StudentGatePasses: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [passes, setPasses] = useState<GatePassRequest[]>([]);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedQRPass, setSelectedQRPass] = useState<GatePassRequest | null>(null);

  // Form State
  const [passType, setPassType] = useState<string>('DAY_OUT');
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
      showSuccess('Gate pass application submitted for warden review.');
      setShowApplyModal(false);
      setReason('');
      fetchPasses();
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to submit gate pass');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">My Gate Passes & Outpasses</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Apply for hostel departure permits, view warden approvals, and present your Security QR Pass</p>
        </div>
        <button
          onClick={() => setShowApplyModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] transition-all shadow-sm cursor-pointer w-full sm:w-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Apply New Pass</span>
        </button>
      </div>

      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        {/* Mobile View: Cards */}
        <div className="block md:hidden space-y-3.5">
          {passes.length === 0 ? (
            <div className="py-10 px-4 text-center text-slate-400 text-xs italic bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
              No gate passes applied yet. Click "Apply New Pass" above to create one.
            </div>
          ) : (
            passes.map((pass) => (
              <div key={pass.id} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pass Type</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {String(pass.pass_type).replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</span>
                    <StatusBadge status={pass.status} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Out Date & Time</span>
                    <span className="font-semibold text-slate-800 block">
                      {pass.out_date}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px] block">
                      {formatTime12(pass.out_time) || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expected Return</span>
                    <span className="font-semibold text-rose-700 block">
                      {pass.expected_return_date || pass.return_date}
                    </span>
                    <span className="text-rose-600 font-mono text-[11px] font-bold block">
                      {formatTime12(pass.expected_return_time) || 'N/A'}
                    </span>
                  </div>

                  <div className="col-span-2 pt-1 border-t border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reason / Purpose</span>
                    <span className="text-slate-700 italic">
                      "{pass.reason || pass.purpose || 'Personal'}"
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  {pass.status === 'approved' ? (
                    <button
                      onClick={() => setSelectedQRPass(pass)}
                      className="w-full py-2.5 rounded-xl bg-blue-100 text-teal-950 font-bold text-xs hover:bg-teal-200 transition-all border border-teal-300 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <QrCode className="w-4 h-4 text-teal-900" />
                      <span>Show Security QR Pass</span>
                    </button>
                  ) : pass.status === 'completed' ? (
                    <div className="py-2 text-[11px] font-semibold text-slate-500 flex items-center justify-center gap-1.5 bg-slate-100 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed Movement
                    </div>
                  ) : (
                    <div className="py-2 text-[11px] text-slate-400 italic text-center bg-slate-100/60 rounded-xl">
                      Pending Warden Review
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pl-2">Pass Type</th>
                <th className="pb-3">Out Date & Time</th>
                <th className="pb-3">Expected Return</th>
                <th className="pb-3">Reason / Purpose</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right pr-2">Security QR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {passes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs italic">
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
                      {pass.out_date} at {formatTime12(pass.out_time) || 'N/A'}
                    </td>
                    <td className="py-4 text-slate-600 text-xs">
                      {pass.expected_return_date || pass.return_date} at {formatTime12(pass.expected_return_time) || 'N/A'}
                    </td>
                    <td className="py-4 text-slate-600 text-xs italic max-w-xs truncate">
                      "{pass.reason || pass.purpose || 'Personal'}"
                    </td>
                    <td className="py-4">
                      <StatusBadge status={pass.status} />
                    </td>
                    <td className="py-4 text-right pr-2">
                      {pass.status === 'approved' ? (
                        <button
                          onClick={() => setSelectedQRPass(pass)}
                          className="px-4 py-1.5 rounded-full bg-blue-100 text-teal-950 font-bold text-xs hover:bg-teal-200 transition-all border border-teal-300 flex items-center gap-1.5 ml-auto cursor-pointer shadow-xs"
                        >
                          <QrCode className="w-3.5 h-3.5 text-teal-900" />
                          <span>Show QR</span>
                        </button>
                      ) : pass.status === 'completed' ? (
                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 justify-end">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Completed
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Pending Approval</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DYNAMIC QR CODE MODAL FOR APPROVED GATE PASS */}
      {selectedQRPass && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl p-7 border border-slate-200 shadow-2xl text-center relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setSelectedQRPass(null)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 leading-tight">Official Campus Outpass</h3>
            <p className="text-xs text-slate-500 mb-5">Present this QR code to the Security Guard at the main gate</p>

            {/* High-Resolution SVG QR Code */}
            <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-teal-400 inline-block shadow-sm mb-4">
              <QRCodeSVG
                value={selectedQRPass.token || selectedQRPass.enrollment_no}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

            {/* Pass Token & Student Details */}
            <div className="bg-slate-50 p-4 rounded-2xl text-left border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Student:</span>
                <strong className="text-slate-800">{selectedQRPass.student_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Enrollment / USN:</span>
                <span className="font-mono font-bold text-teal-950">{selectedQRPass.enrollment_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Permitted Out:</span>
                <span className="text-slate-700 font-semibold">{selectedQRPass.out_date} ({formatTime12(selectedQRPass.out_time)})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Curfew Return:</span>
                <span className="text-rose-700 font-bold">{selectedQRPass.expected_return_date} ({formatTime12(selectedQRPass.expected_return_time)})</span>
              </div>
              {selectedQRPass.actual_exit_time && (
                <div className="flex justify-between pt-1 border-t border-slate-200 text-emerald-800 font-medium">
                  <span>Exit Scanned:</span>
                  <span>{new Date(selectedQRPass.actual_exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400 mt-4">
              Security token is digitally authenticated. Misuse is strictly punishable.
            </p>
          </div>
        </div>
      )}

      {/* APPLY PASS MODAL */}
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
                <Select value={passType} onValueChange={(val) => setPassType(val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Pass Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAY_OUT">Day Outing (Return Today)</SelectItem>
                    <SelectItem value="NIGHT_OUT">Night Out</SelectItem>
                    <SelectItem value="HOME_VISIT">Home Visit / Multi-Day Leave</SelectItem>
                    <SelectItem value="EMERGENCY">Emergency Leave</SelectItem>
                  </SelectContent>
                </Select>
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
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
                  className="px-6 py-2.5 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-sm cursor-pointer disabled:opacity-50"
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
