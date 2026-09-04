import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  QrCode, 
  Search, 
  Camera, 
  StopCircle, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import type { GatePassRequest } from '../../types';
import { apiClient } from '../../api/apiClient';
import { formatTime12 } from '../../lib/utils';
import { useNotification } from '../../context/NotificationContext';
import { useDebounce } from '../../hooks/useDebounce';

export const GatePassScanner: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [scannedPass, setScannedPass] = useState<GatePassRequest | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Movement Ledger Records
  const [activeOutsidePasses, setActiveOutsidePasses] = useState<GatePassRequest[]>([]);
  const [recentCompletedPasses, setRecentCompletedPasses] = useState<GatePassRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'outside' | 'completed'>('outside');
  const [filterQuery, setFilterQuery] = useState('');

  // Confirmation Dialog State for Check Out & Check In
  const [pendingConfirmAction, setPendingConfirmAction] = useState<'EXIT' | 'ENTRY' | null>(null);
  const [viewModalPass, setViewModalPass] = useState<GatePassRequest | null>(null);

  // Camera Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cameraViewportRef = useRef<HTMLDivElement>(null);
  const scannedPassCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGatePassRecords();
    return () => {
      stopCameraScanner();
    };
  }, []);

  const fetchGatePassRecords = async () => {
    try {
      const res = await apiClient.get<GatePassRequest[]>('/security/gate-passes/');
      const passes = res.data;

      const outside = passes.filter(
        (p: GatePassRequest) => p.actual_exit_time && !p.actual_entry_time
      );
      const completed = passes.filter(
        (p: GatePassRequest) => p.actual_exit_time && p.actual_entry_time
      );

      setActiveOutsidePasses(outside);
      setRecentCompletedPasses(completed);
    } catch (err) {
      console.error('Failed to load gate pass records', err);
    }
  };

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
      if (res.data.pass?.student_name) {
        setSearchInput(`${res.data.pass.student_name} (${res.data.pass.enrollment_no})`);
      }
      stopCameraScanner();
    } catch (err: any) {
      setScannedPass(null);
      setErrorMsg(err.message || err.response?.data?.message || err.response?.data?.error || 'No approved gate pass found matching this Token or Student ID.');
    } finally {
      setLoading(false);
    }
  };

  const startCameraScanner = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsCameraActive(true);

    setTimeout(async () => {
      try {
        const qrCodeScanner = new Html5Qrcode('qr-reader-container');
        scannerRef.current = qrCodeScanner;

        await qrCodeScanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            setSearchInput(decodedText);
            handleSearch(undefined, decodedText);
          },
          () => {}
        );
      } catch (err: any) {
        setIsCameraActive(false);
        setErrorMsg('Unable to access camera. Ensure camera permissions are allowed in your browser.');
      }
    }, 100);
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping QR scanner', err);
      }
    }
    setIsCameraActive(false);
  };

  const handleConfirmMovementExecution = async () => {
    if (!scannedPass || !pendingConfirmAction) return;
    const movementType = pendingConfirmAction;
    setPendingConfirmAction(null);

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await apiClient.post(`/security/gate-passes/${scannedPass.id}/log_movement/`, {
        movement_type: movementType,
      });
      setSuccessMsg(res.data.message);
      setScannedPass(res.data.pass);
      fetchGatePassRecords();
    } catch (err: any) {
      setErrorMsg(err.message || err.response?.data?.error || err.response?.data?.message || 'Failed to log gate movement');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectFromTable = (pass: GatePassRequest) => {
    setViewModalPass(pass);
  };

  const isExitDone = Boolean(scannedPass?.actual_exit_time);
  const isEntryDone = Boolean(scannedPass?.actual_entry_time);

  const isPassExpired = (() => {
    if (!scannedPass) return false;
    if (scannedPass.status === 'expired') return true;
    if (!isExitDone && scannedPass.expected_return_date && scannedPass.expected_return_time) {
      try {
        const deadlineStr = `${scannedPass.expected_return_date}T${scannedPass.expected_return_time}`;
        const deadline = new Date(deadlineStr);
        if (!isNaN(deadline.getTime()) && new Date() > deadline) {
          return true;
        }
      } catch (e) {
        return false;
      }
    }
    return false;
  })();

  const isOverdueReturn = (() => {
    if (!scannedPass || !isExitDone || isEntryDone) return false;
    if (scannedPass.expected_return_date && scannedPass.expected_return_time) {
      try {
        const deadlineStr = `${scannedPass.expected_return_date}T${scannedPass.expected_return_time}`;
        const deadline = new Date(deadlineStr);
        if (!isNaN(deadline.getTime()) && new Date() > deadline) {
          return true;
        }
      } catch (e) {
        return false;
      }
    }
    return false;
  })();

  const displayedList = activeTab === 'outside' 
    ? activeOutsidePasses 
    : recentCompletedPasses;

  const debouncedFilterQuery = useDebounce(filterQuery, 300);

  const filteredRecords = displayedList.filter((p) => {
    if (!debouncedFilterQuery) return true;
    const q = debouncedFilterQuery.toLowerCase();
    return (
      p.student_name.toLowerCase().includes(q) ||
      p.enrollment_no.toLowerCase().includes(q) ||
      (p.hostel_name && p.hostel_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-7 max-w-6xl mx-auto">
      {/* Top Header & Live Counter Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Students Gate Movement & QR Scanner</h1>
          <p className="text-sm text-slate-500 mt-0.5">Live tracking of students checked out outside campus and gate transit scan terminal</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span>{activeOutsidePasses.length} Currently Outside</span>
          </div>
          <button
            onClick={fetchGatePassRecords}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer shadow-xs"
            title="Refresh Ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SECTION 1: SCANNER & ACTIVE TOKEN VERIFIER */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#0B1437]" />
            <h3 className="text-base font-bold text-slate-900">Scan Student QR Code / Enter USN</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Supports Live Webcam & Barcode Readers</span>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Scan QR token, paste UUID, or enter USN (e.g. STU2026001)..."
              className="w-full bg-slate-50 pl-12 pr-4 py-3.5 rounded-full text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 focus:border-[#0B1437]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="submit"
              disabled={loading || !searchInput.trim()}
              className={`flex-1 sm:flex-none px-6 py-3.5 rounded-full font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
                loading || !searchInput.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  : 'bg-[#0B1437] text-white hover:bg-[#111f54] cursor-pointer shadow-sm'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>{loading ? 'Verifying...' : 'Verify Pass'}</span>
            </button>

            {!isCameraActive ? (
              <button
                type="button"
                onClick={startCameraScanner}
                className="px-5 py-3.5 rounded-full bg-blue-100 text-teal-950 font-bold text-xs hover:bg-teal-200 border border-teal-300 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Camera className="w-4 h-4 text-teal-900" />
                <span>Open Camera</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCameraScanner}
                className="px-5 py-3.5 rounded-full bg-rose-50 text-rose-800 font-bold text-xs hover:bg-rose-100 border border-rose-200 transition-all flex items-center gap-2 cursor-pointer"
              >
                <StopCircle className="w-4 h-4 text-rose-600" />
                <span>Close Camera</span>
              </button>
            )}
          </div>
        </form>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-3 animate-in fade-in">
            <XCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* CAMERA SCANNER MODAL POPUP (For Mobile & Desktop) */}
      {isCameraActive && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-800 flex flex-col items-center animate-in zoom-in-95 duration-150 relative">
            <div className="flex items-center justify-between w-full mb-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white text-xs font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Live QR Code Scanner</span>
              </div>
              <button
                type="button"
                onClick={stopCameraScanner}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full flex items-center justify-center overflow-hidden rounded-2xl bg-black border border-slate-800 relative">
              <div id="qr-reader-container" className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-black" />
            </div>

            <p className="text-slate-400 text-[11px] sm:text-xs text-center mt-3 font-medium">
              Point your camera at the student's gate pass QR code on their mobile screen.
            </p>

            <button
              type="button"
              onClick={stopCameraScanner}
              className="mt-4 w-full py-3 rounded-2xl bg-rose-600/20 text-rose-300 font-bold text-xs hover:bg-rose-600/30 border border-rose-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <StopCircle className="w-4 h-4 text-rose-400" />
              <span>Cancel / Close Camera</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* VERIFIED PASS RESULT MODAL POPUP */}
      {scannedPass && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div ref={scannedPassCardRef} className="bg-white my-auto p-6 sm:p-7 rounded-3xl border-2 border-blue-100 shadow-2xl animate-in zoom-in-95 duration-150 space-y-5 max-w-lg w-full relative">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-teal-950 font-bold flex items-center justify-center text-lg shadow-inner">
                  {scannedPass.student_name?.[0] || 'S'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{scannedPass.student_name}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {scannedPass.enrollment_no} · {scannedPass.hostel_name} (Room {scannedPass.room_no || 'N/A'})
                  </p>
                  <p className="text-[11px] text-teal-900 font-mono mt-0.5 font-bold">
                    PASS: {String(scannedPass.pass_type).replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setScannedPass(null)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
                title="Close Result Modal"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Permitted Departure</span>
                <div className="text-xs font-bold text-slate-800">{scannedPass.out_date} at {formatTime12(scannedPass.out_time) || 'Morning'}</div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Curfew Return Deadline</span>
                <div className="text-xs font-bold text-rose-700">{scannedPass.expected_return_date} at {formatTime12(scannedPass.expected_return_time) || '09:30 PM'}</div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-emerald-200 text-xs text-emerald-950">
              <strong>Approved Purpose:</strong> "{scannedPass.reason || scannedPass.purpose || 'Personal'}"
            </div>

            {isPassExpired && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-start sm:items-center gap-2.5">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-bold text-rose-950 block text-xs">⛔ QR Code Expired</span>
                    <span className="text-[11px] text-rose-800 font-normal">
                      Pass expired on {scannedPass.expected_return_date} at {formatTime12(scannedPass.expected_return_time) || 'curfew'}.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {isOverdueReturn && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-start sm:items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-bold text-amber-950 block text-xs">⚠️ Overdue Curfew Return</span>
                    <span className="text-[11px] text-amber-800 font-normal">
                      Return deadline was {scannedPass.expected_return_date} at {formatTime12(scannedPass.expected_return_time)}.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {isEntryDone && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-start sm:items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-bold text-amber-950 block text-xs">⛔ QR Code Already Used</span>
                    <span className="text-[11px] text-amber-800 font-normal">
                      Student already completed this round-trip pass.
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-1">
              <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-600">
                <span>Transit State:</span>
                <span>
                  {isPassExpired 
                    ? '🔴 EXPIRED' 
                    : isEntryDone 
                    ? '🟢 Completed' 
                    : isOverdueReturn 
                    ? '⚠️ OVERDUE RETURN' 
                    : isExitDone 
                    ? '🟡 Outside Campus' 
                    : '⚪ Inside Hostel'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  onClick={() => setPendingConfirmAction('EXIT')}
                  disabled={isExitDone || isPassExpired || actionLoading}
                  className={`w-full sm:flex-1 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    isPassExpired
                      ? 'bg-rose-100 text-rose-600 border border-rose-200 cursor-not-allowed'
                      : isExitDone
                      ? 'bg-[#0D3833]/10 text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-[#0B1437] text-white hover:bg-[#111f54] shadow-md hover:shadow-lg cursor-pointer'
                  }`}
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>
                    {isPassExpired
                      ? '⛔ Departure Expired'
                      : isExitDone 
                      ? `Exit Done` 
                      : 'Check Out (Exit)'}
                  </span>
                </button>

                <button
                  onClick={() => setPendingConfirmAction('ENTRY')}
                  disabled={!isExitDone || isEntryDone || actionLoading}
                  className={`w-full sm:flex-1 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    !isExitDone || isEntryDone
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-md hover:shadow-lg'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>
                    {isEntryDone 
                      ? `Returned` 
                      : 'Check In (Entry)'}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setScannedPass(null)}
                className="w-full mt-2 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SECTION 3: HOSTEL STUDENTS GATE LEDGER TABLE */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Hostel Students Movement Register</h3>
            <p className="text-xs text-slate-400">All students currently checked out without return entry</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-full">
              <button
                onClick={() => setActiveTab('outside')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'outside'
                    ? 'bg-[#0B1437] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Outside Campus ({activeOutsidePasses.length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'completed'
                    ? 'bg-[#0B1437] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Checked In History ({recentCompletedPasses.length})
              </button>
            </div>
          </div>
        </div>

        {/* Filter search bar */}
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search by student name or USN..."
            className="w-full bg-slate-50 pl-10 pr-3.5 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
          />
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-3">
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs italic">
              {activeTab === 'outside' 
                ? 'No students currently outside campus. All residents are accounted for.' 
                : 'No completed return entries recorded yet today.'}
            </div>
          ) : (
            filteredRecords.map((pass) => (
              <div key={pass.id} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student & Room</span>
                    <div className="font-bold text-slate-900 text-sm">{pass.student_name}</div>
                    <div className="text-xs text-slate-500">{pass.enrollment_no} · Room {pass.room_no || '101'}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-block ${
                      !pass.actual_entry_time 
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}>
                      {!pass.actual_entry_time ? '🟡 OUTSIDE' : '🟢 RETURNED'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pass Type</span>
                    <span className="font-semibold text-slate-800">{String(pass.pass_type).replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gate Exit Time</span>
                    <span className="font-mono text-slate-700">
                      {pass.actual_exit_time ? new Date(pass.actual_exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending Exit'}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Curfew Return</span>
                    <span className="font-semibold text-rose-700 font-mono">
                      {pass.expected_return_time || '09:30 PM'} ({pass.expected_return_date})
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Quick Action</span>
                  <button
                    onClick={() => handleSelectFromTable(pass)}
                    className="w-full py-2.5 rounded-xl bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    {!pass.actual_entry_time ? 'Mark Check-In' : 'View Pass'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pl-2">Student & Room</th>
                <th className="pb-3">Pass Type</th>
                <th className="pb-3">Gate Exit Time</th>
                <th className="pb-3">Curfew Return</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right pr-2">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 text-xs italic">
                    {activeTab === 'outside' 
                      ? 'No students currently outside campus. All residents are accounted for.' 
                      : 'No completed return entries recorded yet today.'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((pass) => (
                  <tr key={pass.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 pl-2">
                      <div className="font-bold text-slate-900 text-xs">{pass.student_name}</div>
                      <div className="text-[11px] text-slate-400">{pass.enrollment_no} · Room {pass.room_no || '101'}</div>
                    </td>
                    <td className="py-3.5 text-xs font-semibold text-slate-700">
                      {String(pass.pass_type).replace(/_/g, ' ')}
                    </td>
                    <td className="py-3.5 text-xs text-slate-600 font-mono">
                      {pass.actual_exit_time ? new Date(pass.actual_exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending Exit'}
                    </td>
                    <td className="py-3.5 text-xs font-semibold text-rose-700 font-mono">
                      {pass.expected_return_time || '09:30 PM'} ({pass.expected_return_date})
                    </td>
                    <td className="py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        !pass.actual_entry_time 
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                      }`}>
                        {!pass.actual_entry_time ? '🟡 OUTSIDE' : '🟢 RETURNED'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right pr-2">
                      <button
                        onClick={() => handleSelectFromTable(pass)}
                        className="px-3.5 py-1.5 rounded-full bg-[#0B1437] text-white text-[11px] font-semibold hover:bg-[#111f54] transition-colors cursor-pointer shadow-2xs"
                      >
                        {!pass.actual_entry_time ? 'Mark Check-In' : 'View Pass'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW GATE PASS DETAILS POP-UP MODAL */}
      {viewModalPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setViewModalPass(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3.5 mb-5 pr-8">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-teal-950 font-bold flex items-center justify-center text-lg shadow-inner shrink-0">
                {viewModalPass.student_name?.[0] || 'S'}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{viewModalPass.student_name}</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {viewModalPass.enrollment_no} · {viewModalPass.hostel_name} (Room {viewModalPass.room_no || 'N/A'})
                </p>
                <p className="text-[11px] text-[#0B1437] font-mono mt-0.5 font-bold">
                  PASS: {String(viewModalPass.pass_type).replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                !viewModalPass.actual_entry_time 
                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
              }`}>
                {!viewModalPass.actual_entry_time ? '🟡 OUTSIDE CAMPUS' : '🟢 RETURNED TO HOSTEL'}
              </span>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>APPROVED BY {viewModalPass.approved_by_name?.toUpperCase() || 'WARDEN'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Permitted Departure</span>
                <div className="text-xs font-bold text-slate-800">{viewModalPass.out_date}</div>
                <div className="text-xs text-slate-600 font-mono">{formatTime12(viewModalPass.out_time) || 'Morning'}</div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Curfew Return Deadline</span>
                <div className="text-xs font-bold text-rose-700">{viewModalPass.expected_return_date}</div>
                <div className="text-xs text-rose-700 font-mono font-bold">{formatTime12(viewModalPass.expected_return_time) || '09:30 PM'}</div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Gate Exit Stamped</span>
                <div className="text-xs font-mono font-bold text-slate-800">
                  {viewModalPass.actual_exit_time ? new Date(viewModalPass.actual_exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not Exited Yet'}
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Gate Entry Stamped</span>
                <div className="text-xs font-mono font-bold text-slate-800">
                  {viewModalPass.actual_entry_time ? new Date(viewModalPass.actual_entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not Checked In Yet'}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 mb-5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Approved Purpose</span>
              <p className="font-medium text-slate-800">"{viewModalPass.reason || viewModalPass.purpose || 'Personal Outing'}"</p>
            </div>

            <div className="flex items-center gap-2.5">
              {!viewModalPass.actual_entry_time && viewModalPass.actual_exit_time && (
                <button
                  type="button"
                  onClick={() => {
                    setScannedPass(viewModalPass);
                    setPendingConfirmAction('ENTRY');
                    setViewModalPass(null);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Mark Check In</span>
                </button>
              )}

              {!viewModalPass.actual_exit_time && (
                <button
                  type="button"
                  onClick={() => {
                    setScannedPass(viewModalPass);
                    setPendingConfirmAction('EXIT');
                    setViewModalPass(null);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-[#0B1437] hover:bg-[#111f54] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Mark Check Out</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setViewModalPass(null)}
                className="px-5 py-3 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION POPUP MODAL FOR CHECK OUT & CHECK IN */}
      {pendingConfirmAction && scannedPass && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-150">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${
              pendingConfirmAction === 'EXIT' 
                ? 'bg-amber-50 text-amber-600 border-amber-200' 
                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
            }`}>
              {pendingConfirmAction === 'EXIT' ? <ArrowRight className="w-7 h-7" /> : <ArrowLeft className="w-7 h-7" />}
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {pendingConfirmAction === 'EXIT' ? 'Confirm Gate Exit (Check Out)' : 'Confirm Gate Entry (Check In)'}
            </h3>
            
            <p className="text-xs text-slate-500 mb-5">
              {pendingConfirmAction === 'EXIT'
                ? `Are you sure you want to log campus departure for ${scannedPass.student_name}?`
                : `Are you sure you want to log campus return for ${scannedPass.student_name}? This will complete their gate pass.`}
            </p>

            <div className="bg-slate-50 p-3.5 rounded-2xl text-left border border-slate-200 text-xs space-y-1.5 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-400">Student:</span>
                <strong className="text-slate-800">{scannedPass.student_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">USN / Enrollment:</span>
                <span className="font-mono font-bold text-teal-950">{scannedPass.enrollment_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hostel & Room:</span>
                <span className="text-slate-700">{scannedPass.hostel_name} (Rm {scannedPass.room_no || '101'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pass Type:</span>
                <span className="text-slate-700 font-semibold">{String(scannedPass.pass_type).replace(/_/g, ' ')}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPendingConfirmAction(null)}
                className="flex-1 py-3 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMovementExecution}
                className={`flex-1 py-3 rounded-full text-white text-xs font-bold shadow-sm cursor-pointer transition-colors ${
                  pendingConfirmAction === 'EXIT'
                    ? 'bg-[#0B1437] hover:bg-[#111f54]'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {pendingConfirmAction === 'EXIT' ? 'Confirm Check Out' : 'Confirm Check In'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
