import React, { useEffect, useState } from 'react';
import { Building2, History, X, Clock, Image, Eye } from 'lucide-react';
import type { HostelIssue, Hostel } from '../../types';
import { apiClient } from '../../api/apiClient';
import { useNotification } from '../../context/NotificationContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const IssueTracking: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [issues, setIssues] = useState<HostelIssue[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [selectedIssue, setSelectedIssue] = useState<HostelIssue | null>(null);
  const [viewingUpdatesIssue, setViewingUpdatesIssue] = useState<HostelIssue | null>(null);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('in_progress');
  const [updateNote, setUpdateNote] = useState<string>('');

  useEffect(() => {
    fetchIssuesAndHostels();
  }, []);

  const fetchIssuesAndHostels = async () => {
    try {
      const [issuesRes, hostelsRes] = await Promise.all([
        apiClient.get<HostelIssue[]>('/hms/issues/'),
        apiClient.get<Hostel[]>('/hms/hostels/'),
      ]);
      setIssues(issuesRes.data);
      setHostels(hostelsRes.data);
      if (hostelsRes.data.length > 0 && !selectedHostelId) {
        setSelectedHostelId(String(hostelsRes.data[0].id));
      }
    } catch (err) {
      console.error('Failed to load issues or hostels', err);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;

    try {
      await apiClient.post(`/hms/issues/${selectedIssue.id}/update_status/`, {
        status: updateStatus,
        note: updateNote,
      });
      showSuccess(`Issue #${selectedIssue.id} status updated to ${updateStatus}.`);
      setSelectedIssue(null);
      setUpdateNote('');
      fetchIssuesAndHostels();
    } catch (err) {
      showError('Failed to update maintenance issue');
    }
  };

  const filtered = issues.filter((i) => {
    if (!selectedHostelId) return false;

    // 1. Filter by Status
    const matchesStatus = activeFilter === 'ALL' || i.status === activeFilter;

    // 2. Filter by Hostel Block
    let matchesHostel = true;
    if (selectedHostelId !== 'ALL') {
      const selectedHostelObj = hostels.find((h) => String(h.id) === selectedHostelId);
      matchesHostel =
        String(i.hostel) === selectedHostelId ||
        String(i.hostel_id) === selectedHostelId ||
        (Boolean(selectedHostelObj) && Boolean(i.hostel_name) && i.hostel_name.toLowerCase().includes(selectedHostelObj!.name.toLowerCase()));
    }

    return matchesStatus && matchesHostel;
  });

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

        {/* Mobile View: Status Filter Dropdown (< 768px) */}
        <div className="block md:hidden w-full">
          <label className="text-xs font-semibold text-slate-500 block mb-1.5">
            Filter Ticket Status:
          </label>
          <Select
            value={activeFilter}
            onValueChange={setActiveFilter}
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
              onClick={() => setActiveFilter(tab.id)}
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

      {!selectedHostelId ? (
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
            {filtered.length === 0 ? (
              <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center text-slate-400 text-sm">
                No maintenance tickets found for this filter.
              </div>
            ) : (
              filtered.map((issue) => (
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
                        {issue.hostel_name || 'Block A'}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 block truncate">
                        Room {issue.room_no}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setViewingUpdatesIssue(issue)}
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
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No maintenance tickets found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((issue) => (
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
                          <span className="font-bold text-slate-800">{issue.hostel_name || 'Block A'}</span>
                          <div className="text-slate-500 font-medium">Room {issue.room_no}</div>
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
                              onClick={() => setViewingUpdatesIssue(issue)}
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
      {viewingUpdatesIssue && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">Warden & Maintenance Updates</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ticket #{viewingUpdatesIssue.id}: <strong className="text-slate-800">{viewingUpdatesIssue.title}</strong>
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
              <div><span className="text-slate-400">Resident:</span> <strong>{viewingUpdatesIssue.student_name}</strong> ({viewingUpdatesIssue.enrollment_no})</div>
              <div><span className="text-slate-400">Location:</span> <strong>{viewingUpdatesIssue.hostel_name} · Room {viewingUpdatesIssue.room_no}</strong></div>
              <div><span className="text-slate-400">Issue:</span> <span className="italic">"{viewingUpdatesIssue.description}"</span></div>
              {viewingUpdatesIssue.image_url && (
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-slate-400 block mb-1">Attached Photo:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedImageModal(viewingUpdatesIssue.image_url || null)}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 inline-block"
                  >
                    <img
                      src={viewingUpdatesIssue.image_url}
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

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {!viewingUpdatesIssue.updates || viewingUpdatesIssue.updates.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs rounded-2xl border border-dashed border-slate-200">
                  No status notes or updates recorded for this ticket yet.
                </div>
              ) : (
                viewingUpdatesIssue.updates.map((up) => (
                  <div key={up.id} className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-200/80 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[10px] px-2 py-0.5 rounded-md bg-teal-100/90 text-teal-950 uppercase">
                        {up.new_status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700">
                        — {up.updated_by_name || 'Hostel Administrator'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 italic bg-white/80 p-2.5 rounded-xl border border-teal-100/80">
                      "{up.note || 'Status updated'}"
                    </p>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 justify-end font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{new Date(up.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                ))
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
      )}

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
