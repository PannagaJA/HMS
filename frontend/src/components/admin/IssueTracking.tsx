import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import type { HostelIssue, Hostel } from '../../types';
import { apiClient } from '../../api/apiClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const IssueTracking: React.FC = () => {
  const [issues, setIssues] = useState<HostelIssue[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [selectedIssue, setSelectedIssue] = useState<HostelIssue | null>(null);
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
      setSelectedIssue(null);
      setUpdateNote('');
      fetchIssuesAndHostels();
    } catch (err) {
      alert('Failed to update maintenance issue');
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

        {/* Status Filter Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
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
                  ? 'bg-[#0D3833] text-white shadow-sm'
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

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => {
                        setSelectedIssue(issue);
                        setUpdateStatus(issue.status);
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-full bg-[#D1F2EA] text-teal-950 text-xs font-semibold hover:bg-teal-200 transition-colors shadow-sm cursor-pointer"
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
                    <th className="py-3.5 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No maintenance tickets found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((issue) => (
                      <tr key={issue.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 pl-6 max-w-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                              {issue.category}
                            </span>
                            <h4 className="font-bold text-slate-900 text-sm truncate">{issue.title}</h4>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2 italic">"{issue.description}"</p>
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
                        <td className="py-4 pr-6 text-right">
                          <button
                            onClick={() => {
                              setSelectedIssue(issue);
                              setUpdateStatus(issue.status);
                            }}
                            className="px-4 py-1.5 rounded-full bg-[#D1F2EA] text-teal-950 text-xs font-semibold hover:bg-teal-200 transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                          >
                            Update Status / Note
                          </button>
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

      {selectedIssue && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Update Ticket Resolution</h3>
            <p className="text-xs text-slate-500 mb-4">
              Ticket: <strong className="text-slate-800">{selectedIssue.title}</strong>
            </p>

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
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
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
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer"
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
