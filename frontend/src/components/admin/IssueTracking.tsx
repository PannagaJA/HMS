import React, { useEffect, useState } from 'react';
import type { HostelIssue } from '../../types';
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
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [selectedIssue, setSelectedIssue] = useState<HostelIssue | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('in_progress');
  const [updateNote, setUpdateNote] = useState<string>('');

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    try {
      const res = await apiClient.get<HostelIssue[]>('/hms/issues/');
      setIssues(res.data);
    } catch (err) {
      console.error('Failed to load issues', err);
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
      fetchIssues();
    } catch (err) {
      alert('Failed to update maintenance issue');
    }
  };

  const filtered = issues.filter((i) => {
    if (activeFilter === 'ALL') return true;
    return i.status === activeFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Maintenance & Issue Board</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track plumbing, electrical, Wi-Fi, and cleanliness tickets logged by hostel residents</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
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
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeFilter === tab.id
                ? 'bg-[#0D3833] text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.length === 0 ? (
          <div className="col-span-3 bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400">
            No maintenance tickets found for this filter.
          </div>
        ) : (
          filtered.map((issue) => (
            <div
              key={issue.id}
              className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 uppercase">
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

                <h3 className="font-bold text-slate-900 text-base mb-1">{issue.title}</h3>
                <p className="text-xs text-slate-500 mb-4 line-clamp-3">"{issue.description}"</p>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Resident:</span>
                    <span className="font-semibold text-slate-800">{issue.student_name} ({issue.enrollment_no})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Location:</span>
                    <span className="font-semibold text-slate-800">{issue.hostel_name} · Room {issue.room_no}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => {
                    setSelectedIssue(issue);
                    setUpdateStatus(issue.status);
                  }}
                  className="px-4 py-2 rounded-full bg-[#D1F2EA] text-teal-950 text-xs font-semibold hover:bg-teal-200 transition-colors shadow-sm cursor-pointer"
                >
                  Update Status / Note
                </button>
              </div>
            </div>
          ))
        )}
      </div>

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
