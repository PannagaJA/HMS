import React, { useEffect, useState } from 'react';
import { Check, X, Building2, ChevronLeft, ChevronRight, Search, FileText, CheckCircle2 } from 'lucide-react';
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
import { Pagination } from '../common/Pagination';

import { useAuth } from '../../context/AuthContext';
import { wardenService } from '../../services/wardenService';
import { adminService } from '../../services/adminService';
import { formatFloorRoom } from '../../utils/formatters';

export const WardenGatePassManagement: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [passes, setPasses] = useState<GatePassRequest[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('ALL');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionModalPass, setActionModalPass] = useState<GatePassRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionNote, setActionNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!user?.id) return;
    fetchHostels();
    fetchGatePasses();

    const channel = supabase
      .channel('warden_gate_passes_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gate_passes' }, () => {
        fetchGatePasses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.role]);

  const fetchHostels = async () => {
    try {
      let hostList: Hostel[] = [];
      if (user?.role === 'WARDEN') {
        hostList = await wardenService.getAssignedHostels(user.id);
      } else {
        hostList = await adminService.getHostelsList();
      }
      setHostels(hostList);
      setSelectedHostelId((prev) => {
        if (prev) return prev;
        if (user?.role === 'ADMIN') return 'ALL';
        if (user?.role === 'WARDEN') return hostList.length === 1 ? String(hostList[0].id) : 'ALL';
        return hostList.length > 0 ? String(hostList[0].id) : 'ALL';
      });
    } catch (err) {
      console.error('Failed to load hostels for gate passes', err);
    }
  };

  const fetchGatePasses = async () => {
    setLoading(true);
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
      console.error('Failed to load gate passes', err);
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
      await fetchGatePasses();
    } catch (err: any) {
      showError(err.message || err.response?.data?.error || 'Action failed');
    }
  };

  // 1. Filter by Selected Hostel first
  const hostelFilteredPasses = passes.filter((p: any) => {
    if (!selectedHostelId || selectedHostelId === 'ALL') {
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

  // 2. Filter by Status and Search
  const filteredPasses = hostelFilteredPasses.filter((p) => {
    const matchesStatus = activeFilter === 'all' || p.status === activeFilter;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term ||
      (p.student_name || '').toLowerCase().includes(term) ||
      (p.enrollment_no || '').toLowerCase().includes(term) ||
      (p.reason || '').toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const totalItems = filteredPasses.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

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

      {/* Filter Toolbar with Hostel Block Selector, Search, & Status Tabs */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
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

          {/* Search bar */}
          <div className="relative flex-1 min-w-0 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, USN, reason..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 rounded-full border border-slate-200 focus:outline-none focus:border-slate-300 transition-colors"
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
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

          <div className="text-xs text-slate-400 font-semibold hidden sm:block">
            {filteredPasses.length} {filteredPasses.length === 1 ? 'Record' : 'Records'} Found
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px] bg-white rounded-3xl border border-slate-200/80">
          <div className="w-8 h-8 rounded-full border-4 border-[#0B1437] border-t-transparent animate-spin" />
        </div>
      ) : hostels.length === 0 ? (
        <div className="bg-white p-14 rounded-3xl border border-slate-200/80 text-center space-y-4 shadow-sm animate-in fade-in">
          <div className="w-16 h-16 rounded-3xl bg-blue-100 text-teal-950 flex items-center justify-center mx-auto shadow-inner">
            <Building2 className="w-8 h-8 text-[#0B1437]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {user?.role === 'WARDEN' ? 'No Hostels Assigned' : 'No Hostels Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {user?.role === 'WARDEN' 
                ? 'You are not assigned to any hostel block yet. Please contact the administrator to assign your block.'
                : 'No hostel blocks found. Please create a hostel block first.'}
            </p>
          </div>
        </div>
      ) : !selectedHostelId ? (
        <div className="bg-white p-14 rounded-3xl border border-slate-200/80 text-center space-y-4 shadow-sm animate-in fade-in">
          <div className="w-16 h-16 rounded-3xl bg-blue-100 text-teal-950 flex items-center justify-center mx-auto shadow-inner">
            <Building2 className="w-8 h-8 text-[#0B1437]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Select a Hostel Block</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Choose one of your assigned hostel blocks from the dropdown above to review student gate pass approvals.
            </p>
          </div>
        </div>
      ) : paginatedPasses.length === 0 ? (
        activeFilter === 'pending' && !searchTerm ? (
          <div className="bg-white p-14 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">All Caught Up!</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                There are no pending gate pass requests requiring your approval right now.
              </p>
            </div>
          </div>
        ) : searchTerm ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-3 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">No Matching Gate Passes Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                No gate pass records matched your search query "{searchTerm}".
              </p>
            </div>
            <div>
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-all cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-14 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-3xl bg-blue-100 text-teal-950 flex items-center justify-center mx-auto shadow-inner">
              <FileText className="w-8 h-8 text-[#0B1437]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">No Gate Passes Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                No gate pass requests found for the selected status and hostel block.
              </p>
            </div>
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {paginatedPasses.map((pass) => (
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
            ))}
          </div>

          {/* Pagination Controls */}
          {filteredPasses.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
              itemName="requests"
              variant="card"
            />
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
