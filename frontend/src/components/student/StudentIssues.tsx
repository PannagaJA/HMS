import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
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

      <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {issues.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-slate-400 text-xs italic">
              No issues recorded for your room. Everything is operating normally.
            </div>
          ) : (
            issues.map((issue) => (
              <div key={issue.id} className="p-5 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-200 text-slate-800">
                    {issue.category}
                  </span>
                  <StatusBadge status={issue.status} />
                </div>
                <h4 className="text-sm font-bold text-slate-900 leading-tight">{issue.title}</h4>
                <p className="text-xs text-slate-500 line-clamp-2">{issue.description}</p>
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Priority: <strong className="text-slate-700">{issue.priority || 'Normal'}</strong></span>
                  <span>Created: {new Date(issue.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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
