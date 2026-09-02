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
  const [actionLoading, setActionLoading] = useState(false);

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = customQuery || searchInput.trim();
    if (!query) return;

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await apiClient.get<{ valid: boolean; pass: GatePassRequest }>(
        `/security/gate-passes/verify_token/?code=${encodeURIComponent(query)}`
      );
      setScannedPass(res.data.pass);
    } catch (err: any) {
      setScannedPass(null);
      setErrorMsg(err.response?.data?.message || 'No approved gate pass found matching this Token or Student ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogMovement = async (movementType: 'EXIT' | 'ENTRY') => {
    if (!scannedPass) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await apiClient.post(`/security/gate-passes/${scannedPass.id}/log_movement/`, {
        movement_type: movementType,
      });
      setSuccessMsg(res.data.message);
      setScannedPass(res.data.pass);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to log gate movement');
    } finally {
      setActionLoading(false);
    }
  };

  const isExitDone = Boolean(scannedPass?.actual_exit_time);
  const isEntryDone = Boolean(scannedPass?.actual_entry_time);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Main Campus Security Gate Terminal</h1>
        <p className="text-sm text-slate-500 mt-1">Scan student digital QR code or enter USN / Enrollment Number for Departure & Return verification</p>
      </div>

      {/* Verification Input Box */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm">
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Scan QR token or enter Enrollment No (e.g. STU2026001)..."
              className="w-full bg-slate-50 pl-12 pr-4 py-3.5 rounded-full text-base border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3.5 rounded-full bg-[#0D3833] text-white font-semibold text-sm hover:bg-[#064E3B] transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <QrCode className="w-4 h-4" />
            <span>{loading ? 'Verifying...' : 'Verify Pass'}</span>
          </button>
        </form>

        {errorMsg && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-3 animate-in fade-in">
            <XCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Scanned Pass Digital Passport Card */}
      {scannedPass && (
        <div className="bg-white p-8 rounded-3xl border-2 border-[#D1F2EA] shadow-md animate-in fade-in zoom-in-95 duration-150 space-y-6">
          {/* Top Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#D1F2EA] text-teal-950 font-bold flex items-center justify-center text-2xl shadow-inner">
                {scannedPass.student_name?.[0] || 'S'}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{scannedPass.student_name}</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {scannedPass.enrollment_no} · {scannedPass.hostel_name} (Room {scannedPass.room_no || 'N/A'})
                </p>
                <p className="text-[11px] text-teal-900 font-mono mt-0.5">
                  PASS: {String(scannedPass.pass_type).replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold w-fit">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>APPROVED BY {scannedPass.approved_by_name?.toUpperCase() || 'WARDEN'}</span>
            </div>
          </div>

          {/* Departure & Curfew Return Windows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Permitted Departure</span>
              <div className="text-sm font-bold text-slate-800">{scannedPass.out_date} at {scannedPass.out_time || 'Morning'}</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Curfew Return Deadline</span>
              <div className="text-sm font-bold text-rose-700">{scannedPass.expected_return_date} at {scannedPass.expected_return_time || '09:30 PM'}</div>
            </div>
          </div>

          {/* Reason */}
          <div className="p-4 rounded-2xl bg-[#E8F8CE]/50 border border-emerald-200 text-xs text-emerald-950">
            <strong>Approved Purpose:</strong> "{scannedPass.reason || scannedPass.purpose || 'Personal'}"
          </div>

          {/* Live Gate Stage Actions: Dual Scanning (Check Out on Exit -> Check In on Return) */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-600">
              <span>Gate Transit Workflow:</span>
              <span>
                {isEntryDone ? '🟢 Full Movement Cycle Completed' : isExitDone ? '🟡 Student Outside Campus' : '⚪ Inside Hostel (Awaiting Departure)'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* STAGE 1: EXIT / CHECK OUT */}
              <button
                onClick={() => handleLogMovement('EXIT')}
                disabled={isExitDone || actionLoading}
                className={`w-full sm:flex-1 py-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isExitDone
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-[#0D3833] text-white hover:bg-[#064E3B] shadow-md hover:shadow-lg'
                }`}
              >
                <ArrowRight className="w-4 h-4" />
                <span>
                  {isExitDone 
                    ? `Exit Done (${new Date(scannedPass.actual_exit_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` 
                    : '1. Scan & Mark Gate Exit (Check Out)'}
                </span>
              </button>

              {/* STAGE 2: RETURN ENTRY / CHECK IN */}
              <button
                onClick={() => handleLogMovement('ENTRY')}
                disabled={!isExitDone || isEntryDone || actionLoading}
                className={`w-full sm:flex-1 py-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  !isExitDone || isEntryDone
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-md hover:shadow-lg animate-pulse'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>
                  {isEntryDone 
                    ? `Returned & Completed (${new Date(scannedPass.actual_entry_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` 
                    : '2. Scan & Mark Gate Entry (Check In)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
