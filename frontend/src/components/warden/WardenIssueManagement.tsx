import React, { useEffect, useState } from 'react';
import {
  Wrench,
  Search,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { StatusBadge } from '../common/StatusBadge';
import type { HostelIssue } from '../../types';
import { useNotification } from '../../context/NotificationContext';
import { useDebounce } from '../../hooks/useDebounce';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const WardenIssueManagement: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [issues, setIssues] = useState<HostelIssue[]>([]);
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<HostelIssue | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('in_progress');
  const [updateNote, setUpdateNote] = useState('');

  useEffect(() => {
    fetchIssues();
  }, [activeStatus]);

  const fetchIssues = async () => {
    try {
      const query = activeStatus !== 'all' ? `?status=${activeStatus}` : '';
      const res = await apiClient.get<HostelIssue[]>(`/warden/issues/${query}`);
      setIssues(res.data);
    } catch (err) {
      console.error('Failed to load issues', err);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;

    try {
      await apiClient.post(`/warden/issues/${selectedIssue.id}/update_status/`, {
        status: updateStatus,
        note: updateNote,
      });
      showSuccess(`Issue #${selectedIssue.id} status updated to ${updateStatus}.`);
      setSelectedIssue(null);
      setUpdateNote('');
      fetchIssues();
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to update issue');
    }
  };

  const debouncedSearch = useDebounce(search, 300);

  const filteredIssues = issues.filter((iss) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      iss.title.toLowerCase().includes(q) ||
      iss.description.toLowerCase().includes(q) ||
      (iss.student_name && iss.student_name.toLowerCase().includes(q)) ||
      (iss.room_no && iss.room_no.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Maintenance & Issues</h1>
          <p className="text-xs text-slate-500 mt-0.5">Track, assign workers, and resolve resident maintenance tickets</p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tickets by title, student, room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white pl-10 pr-4 py-2.5 rounded-full text-xs border border-slate-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['all', 'pending', 'in_progress', 'completed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setActiveStatus(st)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                activeStatus === st
                  ? 'bg-[#0D3833] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st === 'all' ? 'All Tickets' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Issues Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredIssues.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs">
            No maintenance issues found for the current filter.
          </div>
        ) : (
          filteredIssues.map((iss) => (
            <div
              key={iss.id}
              className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {iss.category}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      Room {iss.room_no || '101'}
                    </span>
                  </div>
                  <StatusBadge status={iss.status} />
                </div>

                <h4 className="text-sm font-bold text-slate-900 mb-1">{iss.title}</h4>
                <p className="text-xs text-slate-600 line-clamp-2 mb-3">{iss.description}</p>

                {/* Resolution Notes History */}
                {iss.updates && iss.updates.length > 0 && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs space-y-2 mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Previous Notes & Actions
                    </span>
                    {iss.updates.map((up) => (
                      <div key={up.id} className="text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/70">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase">
                            {up.new_status.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-700">
                            — {up.updated_by_name || 'Staff Member'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 italic">
                          "{up.note || 'Status modified'}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-[11px] text-slate-400 mb-3">
                  Reported by: <span className="font-semibold text-slate-700">{iss.student_name}</span> ({iss.enrollment_no})
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    setSelectedIssue(iss);
                    setUpdateStatus(iss.status === 'pending' ? 'in_progress' : 'completed');
                  }}
                  className="flex-1 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" /> Action / Update Status
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Dialog */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-1">Update Ticket #{selectedIssue.id}</h3>
            <p className="text-xs text-slate-500 mb-4">{selectedIssue.title} · Room {selectedIssue.room_no}</p>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Change Status</label>
                <Select value={updateStatus} onValueChange={(val) => setUpdateStatus(val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress (Worker Dispatched)</SelectItem>
                    <SelectItem value="waiting_for_workers">Waiting for Workers / Spare Parts</SelectItem>
                    <SelectItem value="completed">Completed / Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Action Remarks / Resolution Note</label>
                <textarea
                  rows={3}
                  value={updateNote}
                  onChange={(e) => setUpdateNote(e.target.value)}
                  placeholder="e.g. Electrician visited and replaced faulty switch."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedIssue(null)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-xs cursor-pointer"
                >
                  Save Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
