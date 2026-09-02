import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BedDouble, 
  Ticket, 
  Wrench, 
  UtensilsCrossed, 
  ArrowRight
} from 'lucide-react';
import type { HostelStudent, GatePassRequest, IssueTicket } from '../../types';
import { apiClient } from '../../api/apiClient';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<{ profile: HostelStudent; roommates: HostelStudent[] } | null>(null);
  const [passes, setPasses] = useState<GatePassRequest[]>([]);
  const [issues, setIssues] = useState<IssueTicket[]>([]);

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    try {
      const [profileRes, passesRes, issuesRes] = await Promise.all([
        apiClient.get('/student/students/my_profile/'),
        apiClient.get<GatePassRequest[]>('/security/gate-passes/my_passes/'),
        apiClient.get<IssueTicket[]>('/hms/issues/'),
      ]);
      setProfileData(profileRes.data);
      setPasses(passesRes.data);
      setIssues(issuesRes.data);
    } catch (err) {
      console.error('Failed to load student dashboard', err);
    }
  };

  const student = profileData?.profile;
  const activeApprovedPass = passes.find((p) => p.status === 'approved');
  const pendingPassesCount = passes.filter((p) => p.status === 'pending').length;
  const openIssuesCount = issues.filter((i) => i.status !== 'completed' && i.status !== 'resolved').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#0D3833] to-[#082925] p-6 sm:p-8 rounded-3xl text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
              Hostel Resident Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Hi, {student?.student_name || 'Resident Student'}!
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/70 mt-1">
            {student?.hostel_name || 'Aryabhatta Boys Hostel'} · Room {student?.room_detail?.no || '101'} (Bed {student?.bed_number || '1'})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate('/student/passes')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-400 text-teal-950 font-bold text-xs hover:bg-emerald-300 transition-all shadow-sm cursor-pointer"
          >
            <Ticket className="w-4 h-4" />
            <span>Gate Passes ({passes.length})</span>
          </button>
          <button
            onClick={() => navigate('/student/issues')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs transition-all cursor-pointer"
          >
            <Wrench className="w-4 h-4" />
            <span>Report Issue ({issues.length})</span>
          </button>
          <button
            onClick={() => navigate('/student/meals')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs transition-all cursor-pointer"
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Mess & Dining</span>
          </button>
        </div>
      </div>

      {/* Main Top 3 Resident Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Room & Bed Card */}
        <div className="bg-[#E8F8CE] p-6 rounded-3xl text-emerald-950 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider opacity-75">Allotted Room</span>
              <BedDouble className="w-5 h-5 opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">
              Room {student?.room_detail?.no || '101'}
            </div>
            <div className="text-xs opacity-80 mb-4">
              {student?.hostel_name || 'Aryabhatta Boys Hostel'} · Bed #{student?.bed_number || '1'}
            </div>
          </div>
          <div className="pt-3 border-t border-emerald-900/10 text-xs flex items-center justify-between">
            <span className="opacity-80">Room Status:</span>
            <span className="font-bold">Active Allotment</span>
          </div>
        </div>

        {/* Active Gate Pass Card - Clickable to /student/passes */}
        <div 
          onClick={() => navigate('/student/passes')}
          className="bg-[#D1F2EA] p-6 rounded-3xl text-teal-950 flex flex-col justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider opacity-75">Active Gate Pass</span>
              <Ticket className="w-5 h-5 opacity-80 group-hover:scale-110 transition-transform" />
            </div>
            {activeApprovedPass ? (
              <div>
                <div className="text-xl font-bold mb-1">Pass Approved</div>
                <div className="text-xs opacity-80 mb-2">Valid till {activeApprovedPass.expected_return_time} ({activeApprovedPass.expected_return_date})</div>
                <div className="bg-white/80 p-2.5 rounded-xl text-xs font-mono font-bold text-center text-teal-950 border border-teal-200">
                  TOKEN: {activeApprovedPass.enrollment_no}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-lg font-bold mb-1">Inside Hostel</div>
                <div className="text-xs opacity-75">No outpass active. Curfew at 09:30 PM.</div>
              </div>
            )}
          </div>
          <div className="pt-3 border-t border-teal-900/10 text-xs flex items-center justify-between font-semibold">
            <span>{pendingPassesCount > 0 ? `${pendingPassesCount} Pending Approval` : `${passes.length} Total Applied`}</span>
            <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform text-teal-900">
              Manage Passes <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Support & Issues Card - Clickable to /student/issues */}
        <div 
          onClick={() => navigate('/student/issues')}
          className="bg-[#E0E7FF] p-6 rounded-3xl text-indigo-950 flex flex-col justify-between shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider opacity-75">Maintenance Support</span>
              <Wrench className="w-5 h-5 opacity-80 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold mb-1">
              {openIssuesCount} Open Tickets
            </div>
            <div className="text-xs opacity-80 mb-4">
              Report plumbing, electrical, internet, or room cleanliness tickets.
            </div>
          </div>
          <div className="pt-3 border-t border-indigo-900/10 text-xs flex items-center justify-between font-semibold">
            <span>{issues.length} Total Tickets</span>
            <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform text-indigo-900">
              Open Board <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Action Grid (Redirects to particular pages) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Gate Passes Quick Action */}
        <div 
          onClick={() => navigate('/student/passes')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:border-[#0D3833]/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#D1F2EA] text-teal-950 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <Ticket className="w-6 h-6 text-teal-900" />
          </div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0D3833] transition-colors">
            Gate Passes & Outpasses
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Apply for night out, home visit, emergency leave, and show live gate QR permits.
          </p>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0D3833] group-hover:translate-x-1 transition-transform">
            <span>Go to Gate Passes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Maintenance Issues Quick Action */}
        <div 
          onClick={() => navigate('/student/issues')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:border-[#0D3833]/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#E0E7FF] text-indigo-950 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <Wrench className="w-6 h-6 text-indigo-900" />
          </div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0D3833] transition-colors">
            Maintenance & Repairs
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Report electrical, carpentry, plumbing, or hygiene issues for prompt repair.
          </p>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0D3833] group-hover:translate-x-1 transition-transform">
            <span>Go to Issue Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Mess & Dining Quick Action */}
        <div 
          onClick={() => navigate('/student/meals')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:border-[#0D3833]/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#E8F8CE] text-emerald-950 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <UtensilsCrossed className="w-6 h-6 text-emerald-900" />
          </div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0D3833] transition-colors">
            Mess & Dining Schedule
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Inspect today's breakfast, lunch, snacks, and dinner or skip meals for rebates.
          </p>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0D3833] group-hover:translate-x-1 transition-transform">
            <span>Go to Mess & Dining</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Roommates Directory */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Roommates & Shared Quarters</h3>
            <p className="text-xs text-slate-400">Co-residents allotted in Room {student?.room_detail?.no || '101'}</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
            {profileData?.roommates?.length || 0} Roommates
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {profileData?.roommates?.length ? (
            profileData.roommates.map((roommate, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0D3833] text-white flex items-center justify-center font-bold text-sm">
                  {roommate.student_name[0]}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{roommate.student_name}</p>
                  <p className="text-xs text-slate-400">Bed #{roommate.bed_number || 'N/A'} · {roommate.enrollment_no}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-6 text-slate-400 text-xs italic">
              Single occupancy or no other roommates currently allotted in this room.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
