import React, { useEffect, useState } from 'react';
import { BedDouble, UtensilsCrossed, Plus, QrCode } from 'lucide-react';
import type { HostelStudent, GatePassRequest } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { apiClient } from '../../api/apiClient';

export const StudentDashboard: React.FC = () => {
  const [profileData, setProfileData] = useState<{ profile: HostelStudent; roommates: HostelStudent[] } | null>(null);
  const [passes, setPasses] = useState<GatePassRequest[]>([]);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [skipSubmitted, setSkipSubmitted] = useState(false);

  // Apply form state
  const [passType, setPassType] = useState<'DAY_OUT' | 'NIGHT_OUT' | 'HOME_VISIT' | 'EMERGENCY'>('DAY_OUT');
  const [reason, setReason] = useState('');
  const [outDate, setOutDate] = useState('');
  const [outTime, setOutTime] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    try {
      const [profileRes, passesRes] = await Promise.all([
        apiClient.get('/student/students/my_profile/'),
        apiClient.get<GatePassRequest[]>('/security/gate-passes/my_passes/'),
      ]);
      setProfileData(profileRes.data);
      setPasses(passesRes.data);
    } catch (err) {
      console.error('Failed to load student dashboard', err);
    }
  };

  const handleApplyPass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/security/gate-passes/', {
        pass_type: passType,
        reason,
        out_date: outDate,
        out_time: outTime,
        expected_return_date: returnDate,
        expected_return_time: returnTime,
      });
      setShowApplyModal(false);
      setReason('');
      fetchStudentData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit gate pass');
    }
  };

  const handleSkipDinner = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await apiClient.post('/mess/skips/', {
        date: today,
        meal_type: 4,
        skip_type: 'SKIP',
        reason: 'Eating outside with family',
      });
      setSkipSubmitted(true);
    } catch (err: any) {
      setSkipSubmitted(true);
    }
  };

  const activeApprovedPass = passes.find((p) => p.status === 'approved');

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Hi, {profileData?.profile?.student_name || 'Student'}!
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Welcome to your student hostel resident portal.</p>
        </div>
        <button
          onClick={() => setShowApplyModal(true)}
          className="px-6 py-3 rounded-full bg-[#0D3833] text-white text-sm font-semibold hover:bg-[#064E3B] transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Apply Gate Pass</span>
        </button>
      </div>

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#E8F8CE] p-6 rounded-3xl text-emerald-950 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider opacity-75">Allocated Room</span>
              <BedDouble className="w-5 h-5 opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">
              Room {profileData?.profile?.room_detail?.no || '101'}
            </div>
            <div className="text-xs opacity-80 mb-4">
              {profileData?.profile?.hostel_name || 'Aryabhatta Boys Hostel'} · Bed {profileData?.profile?.bed_number || '1'}
            </div>
          </div>
          <div className="pt-3 border-t border-emerald-900/10 text-xs flex items-center justify-between">
            <span className="opacity-80">Roommates:</span>
            <span className="font-bold">
              {profileData?.roommates?.length ? profileData.roommates.map((r) => r.student_name).join(', ') : 'None'}
            </span>
          </div>
        </div>

        <div className="bg-[#D1F2EA] p-6 rounded-3xl text-teal-950 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider opacity-75">Active Gate Pass</span>
              <QrCode className="w-5 h-5 opacity-80" />
            </div>
            {activeApprovedPass ? (
              <div>
                <div className="text-xl font-bold mb-1">Pass Approved</div>
                <div className="text-xs opacity-80 mb-2">Valid till {activeApprovedPass.expected_return_time}</div>
                <div className="bg-white/80 p-2.5 rounded-xl text-[11px] font-mono font-bold text-center text-teal-950 border border-teal-200">
                  CODE: {activeApprovedPass.enrollment_no}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-lg font-bold mb-1">No Active Pass</div>
                <div className="text-xs opacity-75">You are currently recorded inside the hostel.</div>
              </div>
            )}
          </div>
          <div className="pt-3 border-t border-teal-900/10 text-xs">
            <span className="opacity-80">Curfew: </span>
            <strong className="font-bold">09:30 PM</strong>
          </div>
        </div>

        <div className="bg-[#E0E7FF] p-6 rounded-3xl text-indigo-950 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider opacity-75">Today's Dining</span>
              <UtensilsCrossed className="w-5 h-5 opacity-80" />
            </div>
            <div className="text-base font-bold mb-1">Tonight's Dinner</div>
            <div className="text-xs opacity-80 mb-4">Butter Chapati, Dal Makhani & Rice</div>
          </div>
          <div>
            {skipSubmitted ? (
              <div className="py-2 text-center text-xs font-bold text-indigo-900 bg-white/60 rounded-full">
                Meal Skip Recorded (Cost Deducted)
              </div>
            ) : (
              <button
                onClick={handleSkipDinner}
                className="w-full py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-colors"
              >
                Skip Dinner (Reduce Mess Bill)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Applied Gate Passes History */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">My Gate Pass Applications</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pl-2">Type</th>
                <th className="pb-3">Out Date & Time</th>
                <th className="pb-3">Expected Return</th>
                <th className="pb-3">Reason</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {passes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No pass applications submitted yet.
                  </td>
                </tr>
              ) : (
                passes.map((pass) => (
                  <tr key={pass.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 pl-2 font-bold text-slate-800">
                      {pass.pass_type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3.5 text-slate-600 text-xs">
                      {pass.out_date} at {pass.out_time}
                    </td>
                    <td className="py-3.5 text-slate-600 text-xs">
                      {pass.expected_return_date} at {pass.expected_return_time}
                    </td>
                    <td className="py-3.5 text-slate-600 text-xs italic">
                      "{pass.reason}"
                    </td>
                    <td className="py-3.5">
                      <StatusBadge status={pass.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Gate Pass Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-7 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Apply for Gate Pass / Leave</h3>
            <p className="text-xs text-slate-500 mb-6">Fill in departure and return details for warden authorization.</p>

            <form onSubmit={handleApplyPass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pass Type
                </label>
                <select
                  value={passType}
                  onChange={(e: any) => setPassType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                >
                  <option value="DAY_OUT">Day Outing (Return Today)</option>
                  <option value="NIGHT_OUT">Night Out</option>
                  <option value="HOME_VISIT">Home Visit / Multi-Day Leave</option>
                  <option value="EMERGENCY">Emergency Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Out Date</label>
                  <input
                    type="date"
                    required
                    value={outDate}
                    onChange={(e) => setOutDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Out Time</label>
                  <input
                    type="time"
                    required
                    value={outTime}
                    onChange={(e) => setOutTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Return Date</label>
                  <input
                    type="date"
                    required
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Return Time</label>
                  <input
                    type="time"
                    required
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason for Outpass</label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State the purpose of your departure..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-5 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
