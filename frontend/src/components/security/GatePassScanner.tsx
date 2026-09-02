import React, { useState } from 'react';
import { Search, QrCode, CheckCircle2, XCircle, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';
import type { GatePassRequest } from '../../types';
import { apiClient } from '../../api/apiClient';

export const GatePassScanner: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [scannedPass, setScannedPass] = useState<GatePassRequest | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await apiClient.get<{ valid: boolean; pass: GatePassRequest }>(
        `/security/gate-passes/verify_token/?code=${searchInput.trim()}`
      );
      setScannedPass(res.data.pass);
    } catch (err: any) {
      setScannedPass(null);
      setErrorMsg(err.response?.data?.message || 'No valid approved gate pass found for this ID/Code.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogMovement = async (movementType: 'EXIT' | 'ENTRY') => {
    if (!scannedPass) return;

    try {
      const res = await apiClient.post(`/security/gate-passes/${scannedPass.id}/log_movement/`, {
        movement_type: movementType,
      });
      setSuccessMsg(res.data.message);
      setScannedPass(res.data.pass);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to log movement');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Security Gate Pass Terminal</h1>
        <p className="text-sm text-slate-500 mt-1">Scan QR token or enter student enrollment number to verify outpass</p>
      </div>

      {/* Search Input Box */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm">
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter Student Enrollment No (e.g. STU2026001) or Token..."
              className="w-full bg-slate-50 pl-12 pr-4 py-3.5 rounded-full text-base border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3.5 rounded-full bg-[#0D3833] text-white font-semibold text-sm hover:bg-[#064E3B] transition-all shadow-sm flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>Verify Pass</span>
          </button>
        </form>

        {errorMsg && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
            <XCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Scanned Pass Card Details */}
      {scannedPass && (
        <div className="bg-white p-8 rounded-3xl border-2 border-[#D1F2EA] shadow-md animate-in fade-in zoom-in duration-150">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#D1F2EA] text-teal-950 font-bold flex items-center justify-center text-xl">
                {scannedPass.student_name?.[0] || 'S'}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{scannedPass.student_name}</h3>
                <p className="text-xs text-slate-400 font-medium">{scannedPass.enrollment_no} · {scannedPass.hostel_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>OFFICIAL APPROVED PASS</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 my-6">
            <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Permitted Departure</span>
              <div className="text-sm font-bold text-slate-800">{scannedPass.out_date} at {scannedPass.out_time}</div>
            </div>
            <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Expected Return By</span>
              <div className="text-sm font-bold text-slate-800">{scannedPass.expected_return_date} at {scannedPass.expected_return_time}</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#E8F8CE]/50 border border-emerald-200 text-xs text-emerald-950 mb-6">
            <strong>Approved Reason:</strong> "{scannedPass.reason}"
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
            <button
              onClick={() => handleLogMovement('EXIT')}
              disabled={!!scannedPass.actual_exit_time}
              className={`flex-1 py-3.5 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                scannedPass.actual_exit_time
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-[#0D3833] text-white hover:bg-[#064E3B] shadow-sm'
              }`}
            >
              <ArrowRight className="w-4 h-4" />
              <span>{scannedPass.actual_exit_time ? 'Exit Recorded' : 'Mark Gate Exit (Check Out)'}</span>
            </button>

            <button
              onClick={() => handleLogMovement('ENTRY')}
              disabled={!scannedPass.actual_exit_time || !!scannedPass.actual_entry_time}
              className={`flex-1 py-3.5 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                !scannedPass.actual_exit_time || scannedPass.actual_entry_time
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{scannedPass.actual_entry_time ? 'Entry Completed' : 'Mark Gate Entry (Check In)'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
