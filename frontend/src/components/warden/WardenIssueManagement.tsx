import React, { useEffect, useState } from 'react';
import { Building2, History, X, Clock, Image, Eye, ChevronLeft, ChevronRight, Loader2, UserCheck } from 'lucide-react';
import type { HostelIssue, Hostel } from '../../types';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { wardenService } from '../../services/wardenService';
import { adminService } from '../../services/adminService';
import { supabase } from '../../lib/supabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { formatFloorRoom } from '../../utils/formatters';

export const WardenIssueManagement: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [issues, setIssues] = useState<HostelIssue[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [selectedIssue, setSelectedIssue] = useState<HostelIssue | null>(null);
  const [viewingUpdatesIssue, setViewingUpdatesIssue] = useState<HostelIssue | null>(null);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('in_progress');
  const [updateNote, setUpdateNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchIssuesAndHostels();

    const channel = supabase
      .channel('warden_issues_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, () => {
        refreshIssuesOnly();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issue_updates' }, () => {
        refreshIssuesOnly();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const refreshIssuesOnly = async () => {
    try {
      const allIssues = await wardenService.getIssues();
      setIssues(allIssues);
    } catch (err) {
      console.warn('Realtime refresh issues error:', err);
    }
  };

  const fetchIssuesAndHostels = async () => {
    setLoading(true);
    try {
      let hostList: Hostel[] = [];
      if (user?.role === 'WARDEN') {
        hostList = await wardenService.getAssignedHostels(user.id);
      } else {
        hostList = await adminService.getHostels();
      }

      const allIssues = await wardenService.getIssues();

      setIssues(allIssues);
      setHostels(hostList);
      setSelectedHostelId('');
    } catch (err) {
      console.error('Failed to load issues or hostels', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUpdatesModal = async (issue: HostelIssue) => {
    setViewingUpdatesIssue(issue);
    setLoadingUpdates(true);
    try {
      const freshUpdates = await wardenService.getIssueUpdates(issue.id);
      if (freshUpdates && freshUpdates.length > 0) {
        setViewingUpdatesIssue((prev) => (prev && prev.id === issue.id ? { ...prev, updates: freshUpdates } : prev));
        setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, updates: freshUpdates } : i)));
      }
    } catch (err) {
      console.warn('Failed to refresh updates on modal open:', err);
    } finally {
      setLoadingUpdates(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;

    try {
      const result = await wardenService.updateIssueStatus(selectedIssue.id, updateStatus, updateNote);

      if (result.rpcError) {
        showSuccess(`Status updated to ${updateStatus.replace(/_/g, ' ')}.`);
        console.warn('[WardenIssues] RPC error (optimistic update):', result.rpcError);
      } else {
        showSuccess(`Issue #${selectedIssue.id} status updated to ${updateStatus.replace(/_/g, ' ')}.`);
      }

      // Merge: if RPC succeeded DB returns full history, else prepend optimistic entry to existing
      setIssues((prev) =>
        prev.map((issue) => {
          if (issue.id !== selectedIssue.id) return issue;
          const merged = result.rpcError
            ? [...result.updates, ...(issue.updates || [])]
            : result.updates;
          return { ...issue, status: updateStatus, updates: merged };
        })
      );

      setSelectedIssue(null);
      setUpdateNote('');
    } catch (err: any) {
      showError(err.message || 'Failed to update maintenance issue');
    }
  };

  // Exactly matching admin IssueTracking board filtering logic
  const filtered = issues.filter((i: any) => {
    // 1. Filter by Status
    const matchesStatus = activeFilter === 'ALL' || i.status === activeFilter;

    // 2. Filter by Hostel Block
    let matchesHostel = true;
    if (selectedHostelId && selectedHostelId !== 'ALL') {
      const selectedHostelObj = hostels.find((h) => String(h.id) === selectedHostelId);
      const selectedName = selectedHostelObj?.name ? selectedHostelObj.name.toLowerCase().trim() : '';
      const issHostelName = (i.hostel_name || (i.hostel && typeof i.hostel === 'object' ? i.hostel.name : '') || '').toLowerCase().trim();
      const issHostelId = String(i.hostel_id || i.hostel || (i.hostel && typeof i.hostel === 'object' ? i.hostel.id : '') || '');

      matchesHostel =
        hostels.length <= 1 ||
        issHostelId === selectedHostelId ||
        String(i.hostel) === selectedHostelId ||
        String(i.hostel_id) === selectedHostelId ||
        (Boolean(selectedName) && Boolean(issHostelName) && (
          issHostelName.includes(selectedName) || 
          selectedName.includes(issHostelName) ||
          (selectedName.includes('boys') && (issHostelName.includes('boys') || issHostelName.includes('aryabhata'))) ||
          (selectedName.includes('girls') && issHostelName.includes('girls'))
        ));
    }

    return matchesStatus && matchesHostel;
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedIssues = filtered.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Maintenance & Issue Board</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track plumbing, electrical, Wi-Fi, and cleanliness tickets logged by hostel residents</p>
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
            Filter Ticket Status:
          </label>
          <Select
            value={activeFilter}
            onValueChange={(val) => {
              setActiveFilter(val);
              setCurrentPage(1);
            }}
            disabled={!selectedHostelId}
          >
            <SelectTrigger className="w-full bg-slate-50 border-slate-200 font-semibold text-slate-800 disabled:opacity-50">
              <SelectValue placeholder="Select Status Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Tickets</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="waiting_for_workers">Waiting for Workers</SelectItem>
              <SelectItem value="completed">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop View: Status Filter Pill Tabs (>= 768px) */}
        <div className="hidden md:flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All Tickets' },
            { id: 'pending', label: 'Pending' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'waiting_for_workers', label: 'Waiting for Workers' },
            { id: 'completed', label: 'Resolved' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveFilter(tab.id);
                setCurrentPage(1);
              }}
              disabled={!selectedHostelId}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                activeFilter === tab.id && selectedHostelId
                  ? 'bg-[#0B1437] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 text-sm">
          Loading hostel issues...
        </div>
      ) : !selectedHostelId ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-900 flex items-center justify-center mx-auto border border-teal-200">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Select a Hostel Block</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Choose a hostel block from the dropdown above to view and manage active maintenance tickets.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View (< 768px) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {paginatedIssues.length === 0 ? (
              <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center text-slate-400 text-sm">
                No maintenance tickets found for this filter.
              </div>
            ) : (
              paginatedIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider">
                      {issue.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      issue.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      issue.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      issue.status === 'waiting_for_workers' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {issue.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-base mb-1">{issue.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-3">"{issue.description}"</p>
                  </div>

                  {/* Photo Evidence Thumbnail in Mobile Card */}
                  {issue.image_url && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedImageModal(issue.image_url || null)}
                        className="flex items-center gap-2 p-1.5 pr-3 rounded-2xl bg-teal-50/80 hover:bg-teal-100 border border-teal-200 text-teal-950 text-xs font-semibold cursor-pointer transition-all"
                      >
                        <img
                          src={issue.image_url}
                          alt="Thumbnail"
                          className="w-8 h-8 rounded-xl object-cover"
                        />
                        <span className="flex items-center gap-1 text-[11px]">
                          <Image className="w-3.5 h-3.5 text-teal-700" />
                          View Resident Photo Evidence
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">Resident</span>
                      <span className="font-bold text-slate-800 mt-0.5 block truncate">
                        {issue.student_name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 block truncate">
                        {issue.enrollment_no}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">Location</span>
                      <span className="font-bold text-slate-800 mt-0.5 block truncate">
                        {issue.hostel_name || 'Hostel Block'}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 block truncate">
                        {formatFloorRoom(issue.floor, issue.room_no)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenUpdatesModal(issue)}
                      className="px-3.5 py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      <span>Updates ({issue.updates?.length || 0})</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedIssue(issue);
                        setUpdateStatus(issue.status);
                      }}
                      className="flex-1 px-4 py-2 rounded-full bg-blue-100 text-teal-950 text-xs font-semibold hover:bg-teal-200 transition-colors shadow-sm cursor-pointer text-center"
                    >
                      Update Status / Note
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 pl-6">Issue & Category</th>
                    <th className="py-3.5 px-4">Resident</th>
                    <th className="py-3.5 px-4">Hostel Location</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Attachment</th>
                    <th className="py-3.5 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedIssues.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No maintenance tickets found for this filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedIssues.map((issue) => (
                      <tr key={issue.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 pl-6 min-w-[280px] max-w-md">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider shrink-0">
                              {issue.category}
                            </span>
                            <h4 className="font-bold text-slate-900 text-sm leading-snug break-words">
                              {issue.title}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-600 italic leading-relaxed break-words whitespace-normal bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                            "{issue.description}"
                          </p>
                        </td>
                        <td className="py-4 px-4 text-xs font-semibold text-slate-800">
                          <div>{issue.student_name}</div>
                          <div className="text-[11px] font-mono text-slate-400 font-normal">{issue.enrollment_no}</div>
                        </td>
                        <td className="py-4 px-4 text-xs">
                          <span className="font-bold text-slate-800">{issue.hostel_name || 'Hostel Block'}</span>
                          <div className="text-slate-500 font-medium">{formatFloorRoom(issue.floor, issue.room_no)}</div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            issue.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            issue.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            issue.status === 'waiting_for_workers' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {issue.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {issue.image_url ? (
                            <button
                              type="button"
                              onClick={() => setSelectedImageModal(issue.image_url || null)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-xs font-semibold transition-all cursor-pointer"
                            >
                              <Image className="w-3.5 h-3.5 text-teal-700" />
                              <span>Photo</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs italic">—</span>
                          )}
                        </td>
                        <td className="py-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenUpdatesModal(issue)}
                              className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                            >
                              <History className="w-3.5 h-3.5 text-slate-500" />
                              <span>Updates ({issue.updates?.length || 0})</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedIssue(issue);
                                setUpdateStatus(issue.status);
                              }}
                              className="px-4 py-1.5 rounded-full bg-blue-100 text-teal-950 text-xs font-semibold hover:bg-teal-200 transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                            >
                              Update Status / Note
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="bg-white px-6 py-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                <span>
                  Showing <strong className="text-slate-800 font-bold">{startIndex + 1}</strong> to{' '}
                  <strong className="text-slate-800 font-bold">{endIndex}</strong> of{' '}
                  <strong className="text-slate-800 font-bold">{totalItems}</strong> tickets
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

      {/* Lightbox Preview Modal */}
      {selectedImageModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white max-w-2xl w-full rounded-3xl p-6 border border-slate-200 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Issue Photo Evidence</h3>
              <button
                onClick={() => setSelectedImageModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-hidden rounded-2xl border border-slate-200 flex items-center justify-center bg-slate-950">
              <img
                src={selectedImageModal}
                alt="Issue Attachment"
                className="max-h-[68vh] w-auto max-w-full object-contain"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedImageModal(null)}
                className="px-5 py-2 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54]"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ALL UPDATES / REMARKS MODAL */}
      {viewingUpdatesIssue && (() => {
        const liveIssue = issues.find((i) => i.id === viewingUpdatesIssue.id) || viewingUpdatesIssue;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-lg rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">Warden & Maintenance Updates</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ticket #{liveIssue.id}: <strong className="text-slate-800">{liveIssue.title}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setViewingUpdatesIssue(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-4 text-xs space-y-2">
                <div><span className="text-slate-400">Resident:</span> <strong>{liveIssue.student_name}</strong> ({liveIssue.enrollment_no})</div>
                <div><span className="text-slate-400">Location:</span> <strong>{liveIssue.hostel_name} · {formatFloorRoom(liveIssue.floor, liveIssue.room_no)}</strong></div>
                <div><span className="text-slate-400">Issue:</span> <span className="italic">"{liveIssue.description}"</span></div>
                {liveIssue.image_url && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-slate-400 block mb-1">Attached Photo:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedImageModal(liveIssue.image_url || null)}
                      className="relative group rounded-xl overflow-hidden border border-slate-200 inline-block"
                    >
                      <img
                        src={liveIssue.image_url}
                        alt="Thumbnail"
                        className="w-24 h-24 object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-5 h-5 text-white" />
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-0 max-h-[340px] overflow-y-auto pr-1">
                {loadingUpdates ? (
                  <div className="p-8 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                    <span>Loading latest updates...</span>
                  </div>
                ) : !liveIssue.updates || liveIssue.updates.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs rounded-2xl border border-dashed border-slate-200">
                    No status updates recorded for this ticket yet.
                  </div>
                ) : (
                  <div className="relative">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[18px] top-5 bottom-5 w-px bg-gradient-to-b from-teal-300 via-teal-200 to-slate-200" />
                    <div className="space-y-0">
                      {liveIssue.updates.map((up: any, idx: number) => {
                        const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
                          pending:              { bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-400' },
                          in_progress:          { bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500' },
                          waiting_for_workers:  { bg: 'bg-orange-50',  text: 'text-orange-700', dot: 'bg-orange-400' },
                          completed:            { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
                        };
                        const col = statusColors[up.new_status] || { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-400' };
                        const oldCol = up.old_status ? (statusColors[up.old_status] || { bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-300' }) : null;
                        return (
                          <div key={up.id ?? idx} className="flex gap-3 pb-4 relative">
                            {/* Timeline dot */}
                            <div className="flex-shrink-0 w-9 flex flex-col items-center pt-1 z-10">
                              <div className={`w-4 h-4 rounded-full border-2 border-white shadow ${col.dot}`} />
                            </div>
                            {/* Card */}
                            <div className="flex-1 min-w-0">
                              <div className={`rounded-2xl border border-slate-200/80 p-3 ${col.bg} shadow-sm`}>
                                {/* Status transition */}
                                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                  {oldCol && up.old_status && (
                                    <>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/70 border border-slate-200 text-slate-500 uppercase`}>
                                        {up.old_status.replace(/_/g, ' ')}
                                      </span>
                                      <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                    </>
                                  )}
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/80 border ${col.text} border-current/20 uppercase`}>
                                    {up.new_status.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                {/* Note */}
                                {up.note && (
                                  <p className="text-xs text-slate-700 italic mb-2 bg-white/60 px-2.5 py-1.5 rounded-xl border border-slate-200/60">
                                    "{up.note}"
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                                    <UserCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                    <span>
                                      Updated by: <strong className="text-slate-900 font-semibold">{up.updated_by_name || 'Hostel Warden'}</strong>
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono flex-shrink-0 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {new Date(up.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-end">
                <button
                  onClick={() => setViewingUpdatesIssue(null)}
                  className="px-5 py-2 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedIssue && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Update Ticket Resolution</h3>
            <p className="text-xs text-slate-500 mb-3">
              Ticket: <strong className="text-slate-800">{selectedIssue.title}</strong>
            </p>

            {selectedIssue.image_url && (
              <div className="mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={selectedIssue.image_url}
                    alt="Issue Thumbnail"
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Photo Attached</span>
                    <span className="text-[10px] text-slate-400 block">Uploaded by resident</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedImageModal(selectedIssue.image_url || null)}
                  className="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-teal-700" />
                  <span>Enlarge</span>
                </button>
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Status Workflow Stage</label>
                <Select value={updateStatus} onValueChange={setUpdateStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting_for_workers">Waiting for Workers / Parts</SelectItem>
                    <SelectItem value="completed">Completed / Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution Remarks</label>
                <textarea
                  rows={3}
                  value={updateNote}
                  onChange={(e) => setUpdateNote(e.target.value)}
                  placeholder="e.g. Electrician visited and repaired the ceiling fan socket."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedIssue(null)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-sm cursor-pointer"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
