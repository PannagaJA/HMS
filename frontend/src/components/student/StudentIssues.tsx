import React, { useEffect, useState } from 'react';
import { Plus, X, History, Clock } from 'lucide-react';
import type { IssueTicket } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { apiClient } from '../../api/apiClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const StudentIssues: React.FC = () => {
  const [issues, setIssues] = useState<IssueTicket[]>([]);
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [selectedUpdatesIssue, setSelectedUpdatesIssue] = useState<IssueTicket | null>(null);
  const [issueCategory, setIssueCategory] = useState<string>('ELECTRICAL');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [issuePriority, setIssuePriority] = useState<string>('MEDIUM');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    try {
      const res = await apiClient.get<IssueTicket[]>('/hms/issues/');
      setIssues(res.data);
    } catch (err) {
      console.error('Failed to load issues', err);
    }
  };

  const handleRaiseIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post('/hms/issues/', {
        title: issueTitle,
        category: issueCategory,
        description: issueDesc,
        priority: issuePriority,
      });
      setShowRaiseModal(false);
      setIssueTitle('');
      setIssueDesc('');
      fetchIssues();
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail 
        || (typeof err.response?.data === 'object' ? JSON.stringify(err.response?.data) : err.response?.data)
        || 'Failed to report maintenance issue';
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Maintenance & Room Support</h1>
          <p className="text-sm text-slate-500 mt-0.5">Report room repairs, plumbing, electrical, and facility issues</p>
        </div>
        <button
          onClick={() => setShowRaiseModal(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Report New Issue</span>
        </button>
      </div>

      {/* Mobile Card View (< 768px) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {issues.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs italic">
            No issues recorded for your room. Everything is operating normally.
          </div>
        ) : (
          issues.map((issue) => (
            <div key={issue.id} className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-800 uppercase tracking-wider">
                  {issue.category}
                </span>
                <StatusBadge status={issue.status} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 leading-tight mb-1">{issue.title}</h4>
                <p className="text-xs text-slate-500 line-clamp-2">{issue.description}</p>
              </div>

              {/* Staff / Warden Resolution Notes Preview */}
              {issue.updates && issue.updates.length > 0 && (
                <div className="bg-teal-50/60 p-3 rounded-2xl border border-teal-200/70 text-xs space-y-1.5">
                  <span className="text-[10px] font-bold text-teal-900 uppercase tracking-wider block">
                    Latest Warden Update
                  </span>
                  <div className="text-slate-700">
                    <span className="font-semibold text-teal-950">[{issue.updates[issue.updates.length - 1].new_status.replace(/_/g, ' ').toUpperCase()}]</span>
                    {issue.updates[issue.updates.length - 1].note ? ` "${issue.updates[issue.updates.length - 1].note}"` : ' Status updated'}
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                      — {issue.updates[issue.updates.length - 1].updated_by_name || 'Hostel Staff'}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Priority: <strong className="text-slate-700">{issue.priority || 'Normal'}</strong></span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedUpdatesIssue(issue)}
                    className="px-3 py-1.5 rounded-full bg-slate-50 border border-teal-200 text-teal-950 font-semibold text-xs hover:bg-teal-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <History className="w-3.5 h-3.5 text-teal-800" />
                    <span>View Updates ({issue.updates?.length || 0})</span>
                  </button>
                  <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                </div>
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
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Reported On</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Latest Staff Remark</th>
                <th className="py-3.5 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {issues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                    No issues recorded for your room. Everything is operating normally.
                  </td>
                </tr>
              ) : (
                issues.map((issue) => {
                  const latestUpdate = issue.updates && issue.updates.length > 0 ? issue.updates[issue.updates.length - 1] : null;
                  return (
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
                      <td className="py-4 px-4 text-xs font-semibold text-slate-700">
                        {issue.priority || 'Normal'}
                      </td>
                      <td className="py-4 px-4 text-xs font-mono text-slate-500">
                        {new Date(issue.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <StatusBadge status={issue.status} />
                      </td>
                      <td className="py-4 px-4 text-xs max-w-xs">
                        {latestUpdate ? (
                          <div>
                            <span className="font-bold text-[10px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-950 uppercase border border-teal-200">
                              {latestUpdate.new_status.replace(/_/g, ' ')}
                            </span>
                            <p className="text-slate-700 italic truncate mt-1">"{latestUpdate.note || 'Updated'}"</p>
                            <span className="text-[10px] text-slate-400 font-medium">— {latestUpdate.updated_by_name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Awaiting review</span>
                        )}
                      </td>
                      <td className="py-4 pr-6 text-right">
                        <button
                          onClick={() => setSelectedUpdatesIssue(issue)}
                          className="px-3.5 py-1.5 rounded-full bg-[#D1F2EA] text-teal-950 font-bold text-xs hover:bg-teal-200 transition-all border border-teal-300 flex items-center gap-1.5 ml-auto cursor-pointer shadow-2xs whitespace-nowrap"
                        >
                          <History className="w-3.5 h-3.5 text-teal-900" />
                          <span>View Updates ({issue.updates?.length || 0})</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* STUDENT: VIEW ALL UPDATES / REMARKS MODAL */}
      {selectedUpdatesIssue && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">Warden & Maintenance Updates</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ticket: <strong className="text-slate-800">{selectedUpdatesIssue.title}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedUpdatesIssue(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-4 text-xs space-y-1">
              <div><span className="text-slate-400">Category:</span> <strong>{selectedUpdatesIssue.category}</strong></div>
              <div><span className="text-slate-400">Description:</span> <span className="italic">"{selectedUpdatesIssue.description}"</span></div>
            </div>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {!selectedUpdatesIssue.updates || selectedUpdatesIssue.updates.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs rounded-2xl border border-dashed border-slate-200">
                  No warden or maintenance updates recorded for this ticket yet.
                </div>
              ) : (
                selectedUpdatesIssue.updates.map((up) => (
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
                onClick={() => setSelectedUpdatesIssue(null)}
                className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT ISSUE MODAL */}
      {showRaiseModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-7 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Report Maintenance Issue</h3>
                <p className="text-xs text-slate-400">Notify the hostel warden & maintenance team</p>
              </div>
              <button
                onClick={() => setShowRaiseModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRaiseIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Issue Category</label>
                <Select value={issueCategory} onValueChange={(val) => setIssueCategory(val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ELECTRICAL">Electrical (Lights, Fan, Switchboard)</SelectItem>
                    <SelectItem value="PLUMBING">Plumbing (Tap, Pipe, Drainage)</SelectItem>
                    <SelectItem value="CARPENTRY">Carpentry (Bed, Desk, Door, Cupboard)</SelectItem>
                    <SelectItem value="WIFI">Wi-Fi & Internet</SelectItem>
                    <SelectItem value="CLEANLINESS">Cleanliness & Hygiene</SelectItem>
                    <SelectItem value="OTHER">Other Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Issue Title</label>
                <input
                  type="text"
                  required
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  placeholder="e.g. Ceiling fan making loud noise in room"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Detailed Description</label>
                <textarea
                  rows={3}
                  required
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  placeholder="Describe the exact problem and location..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Priority Level</label>
                <Select value={issuePriority} onValueChange={(val) => setIssuePriority(val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low - Can wait a few days</SelectItem>
                    <SelectItem value="MEDIUM">Medium - Normal resolution</SelectItem>
                    <SelectItem value="HIGH">High - Urgent attention needed</SelectItem>
                    <SelectItem value="URGENT">Urgent - Emergency breakdown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRaiseModal(false)}
                  className="px-5 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Issue Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
