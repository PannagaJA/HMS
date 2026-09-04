import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BedDouble, 
  Ticket, 
  Wrench, 
  UtensilsCrossed, 
  ArrowRight,
  QrCode,
  ShieldCheck,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { HostelStudent, GatePassRequest, IssueTicket } from '../../types';
import { apiClient } from '../../api/apiClient';
import { formatTime12 } from '../../lib/utils';

export const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<{ profile: HostelStudent; roommates: HostelStudent[] } | null>(null);
  const [passes, setPasses] = useState<GatePassRequest[]>([]);
  const [issues, setIssues] = useState<IssueTicket[]>([]);
  const [showQRModal, setShowQRModal] = useState(false);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#0B1437] to-[#082925] p-6 sm:p-8 rounded-3xl text-white shadow-lg">
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
            {student?.hostel_name || 'Aryabhatta Boys Hostel'} · Room {student?.room_detail?.no || '101'} (Bed #{student?.bed_number || '1'})
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
        <div className="bg-blue-50 p-6 rounded-3xl text-emerald-950 flex flex-col justify-between shadow-sm">
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

        {/* Active Gate Pass Card with Direct QR Popover */}
        <div className="bg-blue-100 p-6 rounded-3xl text-teal-950 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider opacity-75">Active Gate Pass</span>
              <Ticket className="w-5 h-5 opacity-80" />
            </div>
            {activeApprovedPass ? (
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold mb-1">Pass Approved</div>
                  <button
                    onClick={() => setShowQRModal(true)}
                    className="px-3 py-1 bg-teal-900 text-white rounded-full text-xs font-bold flex items-center gap-1 hover:bg-teal-950 cursor-pointer shadow-xs"
                  >
                    <QrCode className="w-3 h-3" />
                    <span>View QR</span>
                  </button>
                </div>
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
          <div 
            onClick={() => navigate('/student/passes')}
            className="pt-3 border-t border-teal-900/10 text-xs flex items-center justify-between font-semibold cursor-pointer group"
          >
            <span>{pendingPassesCount > 0 ? `${pendingPassesCount} Pending Approval` : `${passes.length} Total Applied`}</span>
            <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform text-teal-900">
              Manage Passes <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Support & Issues Card */}
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

      {/* Quick Navigation Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => navigate('/student/passes')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:border-[#0B1437]/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-teal-950 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <Ticket className="w-6 h-6 text-teal-900" />
          </div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0B1437] transition-colors">
            Gate Passes & Outpasses
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Apply for night out, home visit, emergency leave, and show live gate QR permits.
          </p>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B1437] group-hover:translate-x-1 transition-transform">
            <span>Go to Gate Passes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div 
          onClick={() => navigate('/student/issues')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:border-[#0B1437]/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#E0E7FF] text-indigo-950 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <Wrench className="w-6 h-6 text-indigo-900" />
          </div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0B1437] transition-colors">
            Maintenance & Repairs
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Report electrical, carpentry, plumbing, or hygiene issues for prompt repair.
          </p>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B1437] group-hover:translate-x-1 transition-transform">
            <span>Go to Issue Board</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div 
          onClick={() => navigate('/student/meals')}
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:border-[#0B1437]/40 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-emerald-950 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <UtensilsCrossed className="w-6 h-6 text-emerald-900" />
          </div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0B1437] transition-colors">
            Mess & Dining Schedule
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Inspect today's breakfast, lunch, snacks, and dinner or skip meals for rebates.
          </p>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B1437] group-hover:translate-x-1 transition-transform">
            <span>Go to Mess & Dining</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Roommates Directory */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Roommates & Shared Quarters</h3>
            <p className="text-xs text-slate-400">Co-residents allotted in Room {student?.room_detail?.no || '101'}</p>
          </div>
          <span className="w-fit px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
            {profileData?.roommates?.length || 0} Roommates
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {profileData?.roommates?.length ? (
            profileData.roommates.map((roommate, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0B1437] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {roommate.student_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 truncate">{roommate.student_name}</p>
                  <p className="text-xs text-slate-400 truncate">Bed #{roommate.bed_number || 'N/A'} · {roommate.enrollment_no}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-1 sm:col-span-2 md:col-span-3 text-center py-6 px-4 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs italic">
              Single occupancy or no other roommates currently allotted in this room.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: QR PASSPORT */}
      {showQRModal && activeApprovedPass && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl p-7 border border-slate-200 shadow-2xl text-center relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 leading-tight">Official Campus Outpass</h3>
            <p className="text-xs text-slate-500 mb-5">Present this QR code to the Security Guard at the main gate</p>

            <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-teal-400 inline-block shadow-sm mb-4">
              <QRCodeSVG
                value={activeApprovedPass.token || activeApprovedPass.enrollment_no}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl text-left border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Student:</span>
                <strong className="text-slate-800">{activeApprovedPass.student_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Enrollment / USN:</span>
                <span className="font-mono font-bold text-teal-950">{activeApprovedPass.enrollment_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Permitted Out:</span>
                <span className="text-slate-700 font-semibold">{activeApprovedPass.out_date} ({formatTime12(activeApprovedPass.out_time)})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Curfew Return:</span>
                <span className="text-rose-700 font-bold">{activeApprovedPass.expected_return_date} ({formatTime12(activeApprovedPass.expected_return_time)})</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
