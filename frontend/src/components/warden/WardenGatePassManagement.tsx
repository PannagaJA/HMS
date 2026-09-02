import React, { useEffect, useState } from 'react';
import { Check, X, Building2 } from 'lucide-react';
import type { GatePassRequest, Hostel } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { apiClient } from '../../api/apiClient';
import { formatTime12 } from '../../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const WardenGatePassManagement: React.FC = () => {
  const [passes, setPasses] = useState<GatePassRequest[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [actionModalPass, setActionModalPass] = useState<GatePassRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionNote, setActionNote] = useState('');

  useEffect(() => {
    fetchGatePassesAndHostels();
  }, []);

  const fetchGatePassesAndHostels = async () => {
    try {
      const [passesRes, hostelsRes] = await Promise.all([
        apiClient.get<GatePassRequest[]>('/security/gate-passes/'),
        apiClient.get<Hostel[]>('/hms/hostels/'),
      ]);
      setPasses(passesRes.data);
      setHostels(hostelsRes.data);
    } catch (err) {
      console.error('Failed to load gate passes or hostels', err);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModalPass) return;

    try {
      await apiClient.post(`/security/gate-passes/${actionModalPass.id}/warden_action/`, {
        action: actionType,
        note: actionNote,
      });
      setActionModalPass(null);
      setActionNote('');
      fetchGatePassesAndHostels();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Action failed');
    }
  };

  // 1. Filter by Selected Hostel first
  const hostelFilteredPasses = passes.filter((p) => {
    if (!selectedHostelId) return false;
    if (selectedHostelId === 'ALL') return true;

    const selectedHostelObj = hostels.find((h) => String(h.id) === selectedHostelId);
    return (
      String(p.hostel) === selectedHostelId ||
      String((p as any).hostel_id) === selectedHostelId ||
      (Boolean(selectedHostelObj) && Boolean(p.hostel_name) && p.hostel_name.toLowerCase().includes(selectedHostelObj!.name.toLowerCase()))
    );
  });

  // 2. Filter by Status
  const filteredPasses = hostelFilteredPasses.filter((p) => {
    if (activeFilter === 'all') return true;
    return p.status === activeFilter;
  });

  const pendingCount = hostelFilteredPasses.filter((p) => p.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gate Pass Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review, authorize, or reject student leaves and outpass requests</p>
        </div>
      </div>

      {/* Filter Toolbar with Hostel Block Selector & Status Tabs */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Hostel Selector Dropdown */}
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
                <SelectItem value="ALL">All Hostel Blocks</SelectItem>
                {hostels.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Filter Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              disabled={!selectedHostelId}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                activeFilter === tab && selectedHostelId
                  ? 'bg-[#0D3833] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab} Requests {tab === 'pending' && selectedHostelId && `(${pendingCount})`}
            </button>
          ))}
        </div>
      </div>

      {!selectedHostelId ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-900 flex items-center justify-center mx-auto border border-teal-200">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Select a Hostel Block</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Choose a hostel block from the dropdown above to review and process student gate pass approvals.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredPasses.length === 0 ? (
            <div className="col-span-2 bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400">
              No gate pass requests found for this filter.
            </div>
          ) : (
            filteredPasses.map((pass) => (
              <div
                key={pass.id}
                className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#D1F2EA] text-teal-950 font-bold flex items-center justify-center text-sm">
                        {pass.student_name?.[0] || 'S'}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900">{pass.student_name}</h4>
                        <p className="text-xs text-slate-400">{pass.enrollment_no} · Room {pass.room_no || '101'}</p>
                      </div>
                    </div>
                    <StatusBadge status={pass.status} />
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Leave Type:</span>
                      <span className="font-semibold text-slate-800">{pass.pass_type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Out Time:</span>
                      <span className="font-semibold text-slate-800">{pass.out_date} at {formatTime12(pass.out_time)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Expected Return:</span>
                      <span className="font-semibold text-slate-800">{pass.expected_return_date} at {formatTime12(pass.expected_return_time)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 text-xs">
                      <span className="text-slate-400 font-medium block mb-0.5">Reason:</span>
                      <p className="text-slate-700 italic">"{pass.reason}"</p>
                    </div>
                  </div>
                </div>

                {pass.status === 'pending' ? (
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setActionModalPass(pass);
                        setActionType('reject');
                      }}
                      className="flex-1 py-2.5 rounded-full border border-rose-200 text-rose-700 bg-rose-50 text-xs font-semibold hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => {
                        setActionModalPass(pass);
                        setActionType('approve');
                      }}
                      className="flex-1 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve Pass
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}

      {actionModalPass && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {actionType === 'approve' ? 'Approve Gate Pass' : 'Reject Gate Pass'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              For student: <strong className="text-slate-800">{actionModalPass.student_name}</strong>
            </p>

            <form onSubmit={handleActionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Action Remarks / Notes
                </label>
                <textarea
                  rows={3}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={actionType === 'approve' ? 'e.g. Approved. Return before curfew.' : 'e.g. Insufficient reason.'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionModalPass(null)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-full text-xs font-semibold text-white shadow-sm ${
                    actionType === 'approve' ? 'bg-[#0D3833] hover:bg-[#064E3B]' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
