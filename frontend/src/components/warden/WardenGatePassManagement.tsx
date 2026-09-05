import React, { useEffect, useState } from 'react';
import { Check, X, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { GatePassRequest, Hostel } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { apiClient } from '../../api/apiClient';
import { formatTime12 } from '../../lib/utils';
import { useNotification } from '../../context/NotificationContext';
import { supabase } from '../../lib/supabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

import { useAuth } from '../../context/AuthContext';
import { wardenService } from '../../services/wardenService';
import { adminService } from '../../services/adminService';
import { formatFloorRoom } from '../../utils/formatters';

export const WardenGatePassManagement: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [passes, setPasses] = useState<GatePassRequest[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [actionModalPass, setActionModalPass] = useState<GatePassRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionNote, setActionNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchGatePassesAndHostels();

    const channel = supabase
      .channel('warden_gate_passes_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gate_passes' }, () => {
        refreshGatePassesOnly();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const refreshGatePassesOnly = async () => {
    try {
      const allPasses = await wardenService.getGatePasses();
      let scopedPasses = allPasses;
      if (user?.role === 'WARDEN' && hostels.length > 0) {
        const assignedIds = hostels.map((h) => String(h.id));
        const assignedNames = hostels.map((h) => h.name.toLowerCase().trim());
        scopedPasses = allPasses.filter((p: any) => {
          const passHostelId = String(p.hostel_id || (p.hostel && typeof p.hostel === 'object' ? p.hostel.id : p.hostel) || '');
          const passHostelName = (p.hostel_name || (p.hostel && typeof p.hostel === 'object' ? p.hostel.name : '') || '').toLowerCase().trim();
          return assignedIds.includes(passHostelId) || assignedNames.some(name => passHostelName.includes(name) || name.includes(passHostelName));
        });
      }
      setPasses(scopedPasses);
    } catch (err) {
      console.warn('Realtime refresh gate passes error:', err);
    }
  };

  const fetchGatePassesAndHostels = async () => {
    setLoading(true);
    try {
      let hostList: Hostel[] = [];
      if (user?.role === 'WARDEN') {
        hostList = await wardenService.getAssignedHostels(user.id);
      } else {
        hostList = await adminService.getHostels();
      }

      // Fetch gate passes directly using wardenService backed by Supabase
      const allPasses = await wardenService.getGatePasses();

      // If user is a warden, strictly scope gate passes to their assigned hostels only
      let scopedPasses = allPasses;
      if (user?.role === 'WARDEN') {
        const assignedIds = hostList.map((h) => String(h.id));
        const assignedNames = hostList.map((h) => h.name.toLowerCase().trim());
        scopedPasses = allPasses.filter((p: any) => {
          const passHostelId = String(p.hostel_id || (p.hostel && typeof p.hostel === 'object' ? p.hostel.id : p.hostel) || '');
          const passHostelName = (p.hostel_name || (p.hostel && typeof p.hostel === 'object' ? p.hostel.name : '') || '').toLowerCase().trim();
          return assignedIds.includes(passHostelId) || assignedNames.some(name => passHostelName.includes(name) || name.includes(passHostelName));
        });
      }

      setPasses(scopedPasses);
      setHostels(hostList);
      setSelectedHostelId('');
    } catch (err) {
      console.error('Failed to load gate passes or hostels', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModalPass) return;

    try {
      await wardenService.actionGatePass(actionModalPass.id, actionType, actionNote);
      showSuccess(`Gate pass for ${actionModalPass.student_name} ${actionType === 'approve' ? 'approved' : 'rejected'}.`);
      setActionModalPass(null);
      setActionNote('');
      fetchGatePassesAndHostels();
    } catch (err: any) {
      showError(err.message || err.response?.data?.error || 'Action failed');
    }
  };

  // 1. Filter by Selected Hostel first
  const hostelFilteredPasses = passes.filter((p: any) => {
    if (!selectedHostelId) return false;
    if (selectedHostelId === 'ALL') {
      return true;
    }

    const passHostelId = String(p.hostel_id || (p.hostel && typeof p.hostel === 'object' ? p.hostel.id : p.hostel) || '');
    const passHostelName = (p.hostel_name || (p.hostel && typeof p.hostel === 'object' ? p.hostel.name : '') || '').toLowerCase().trim();
    const selectedHostelObj = hostels.find((h) => String(h.id) === selectedHostelId);
    const selectedName = (selectedHostelObj?.name || '').toLowerCase().trim();

    return (
      passHostelId === selectedHostelId ||
      (selectedName && (passHostelName.includes(selectedName) || selectedName.includes(passHostelName)))
    );
  });

  // 2. Filter by Status
  const filteredPasses = hostelFilteredPasses.filter((p) => {
    if (activeFilter === 'all') return true;
    return p.status === activeFilter;
  });

  const totalItems = filteredPasses.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedPasses = filteredPasses.slice(startIndex, startIndex + pageSize);

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
            <Select
              value={selectedHostelId}
              onValueChange={(val) => {
                setSelectedHostelId(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full bg-slate-50 border-slate-200 font-semibold text-slate-800">
                <SelectValue placeholder="-- Select Hostel Block --" />
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
                    {h.name} ({h.gender === 'M' ? 'Boys' : h.gender === 'F' ? 'Girls' : 'Co-ed'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile View: Status Filter Dropdown (< 768px) */}
        <div className="block md:hidden w-full">
          <label className="text-xs font-semibold text-slate-500 block mb-1.5">
            Filter Status:
          </label>
          <Select
            value={activeFilter}
            onValueChange={(val: any) => {
              setActiveFilter(val);
              setCurrentPage(1);
            }}
            disabled={!selectedHostelId}
          >
            <SelectTrigger className="w-full bg-slate-50 border-slate-200 font-semibold text-slate-800 disabled:opacity-50">
              <SelectValue placeholder="Select Status Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending Requests {selectedHostelId ? `(${pendingCount})` : ''}</SelectItem>
              <SelectItem value="approved">Approved Requests</SelectItem>
              <SelectItem value="rejected">Rejected Requests</SelectItem>
              <SelectItem value="all">All Requests</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop View: Status Filter Pill Tabs (>= 768px) */}
        <div className="hidden md:flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveFilter(tab);
                setCurrentPage(1);
              }}
              disabled={!selectedHostelId}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                activeFilter === tab && selectedHostelId
                  ? 'bg-[#0B1437] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab} Requests {tab === 'pending' && selectedHostelId && `(${pendingCount})`}
            </button>
          ))}
        </div>
      </div>

      {hostels.length === 0 ? (
        <div className="bg-amber-50 p-12 rounded-3xl border border-amber-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto border border-amber-300">
            <Building2 className="w-6 h-6 text-amber-700" />
          </div>
          <h3 className="text-base font-bold text-amber-950">No Hostels Assigned</h3>
          <p className="text-xs text-amber-800 max-w-sm mx-auto">
            {user?.role === 'WARDEN' 
              ? 'You are not assigned to any hostel block yet. Please contact the administrator to assign your block.'
              : 'No hostel blocks found. Please create a hostel block first.'}
          </p>
        </div>
      ) : !selectedHostelId ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-900 flex items-center justify-center mx-auto border border-teal-200">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Select an Assigned Hostel Block</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Choose one of your assigned hostel blocks from the dropdown above to review student gate pass approvals.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {paginatedPasses.length === 0 ? (
              <div className="col-span-2 bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400">
                No gate pass requests found for this filter.
              </div>
            ) : (
              paginatedPasses.map((pass) => (
                <div
                  key={pass.id}
                  className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-teal-950 font-bold flex items-center justify-center text-sm">
                          {pass.student_name?.[0] || 'S'}
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-900">{pass.student_name}</h4>
                          <p className="text-xs text-slate-400">{pass.enrollment_no} · {formatFloorRoom(pass.floor, pass.room_no || '101')}</p>
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
                        className="flex-1 py-2.5 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve Pass
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {filteredPasses.length > 0 && (
            <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                <span>
                  Showing <strong className="text-slate-800 font-bold">{startIndex + 1}</strong> to{' '}
                  <strong className="text-slate-800 font-bold">{endIndex}</strong> of{' '}
                  <strong className="text-slate-800 font-bold">{totalItems}</strong> requests
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0B1437] cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .map((pageNum, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <React.Fragment key={pageNum}>
                            {prev && pageNum - prev > 1 && (
                              <span className="px-1 text-slate-400 font-bold">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                currentPage === pageNum
                                  ? 'bg-[#0B1437] text-white shadow-2xs'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
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
                    actionType === 'approve' ? 'bg-[#0B1437] hover:bg-[#111f54]' : 'bg-rose-600 hover:bg-rose-700'
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
