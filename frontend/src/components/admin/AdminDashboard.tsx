import React, { useEffect, useState } from 'react';
import { Building2, BedDouble, AlertCircle, Clock, Eye, X } from 'lucide-react';
import { StatCard } from '../common/StatCard';
import type { DashboardStats, GatePassRequest } from '../../types';
import { apiClient } from '../../api/apiClient';
import { formatTime12 } from '../../lib/utils';
import { formatFloorRoom } from '../../utils/formatters';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPasses, setRecentPasses] = useState<GatePassRequest[]>([]);
  const [weeklyTrends, setWeeklyTrends] = useState<{ day: string; count: number; height: string }[]>([]);
  const [trendStats, setTrendStats] = useState({ peakDay: 'N/A', peakCount: 0, average: 0, trendPercent: '+0%' });
  const [selectedReasonPass, setSelectedReasonPass] = useState<GatePassRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh telemetry every 30 seconds dynamically
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (isBackground = false) => {
    try {
      if (!isBackground) setIsLoading(true);
      const [statsRes, passesRes] = await Promise.all([
        apiClient.get<any>('/hms/dashboard/stats/'),
        apiClient.get<GatePassRequest[]>('/hms/gate-passes/'),
      ]);
      // Support both { statistics: {...} } and direct {...} payload
      const statData = statsRes.data.statistics || statsRes.data;
      setStats(statData);
      const allPasses: GatePassRequest[] = Array.isArray(passesRes.data) ? passesRes.data : [];
      
      // Strictly sort gate passes by most recent first (created_at desc -> out_date/out_time desc -> id desc)
      const sortedPasses = [...allPasses].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (timeA && timeB && timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) {
          return timeB - timeA;
        }
        if (a.out_date && b.out_date && a.out_date !== b.out_date) {
          const dtA = new Date(`${a.out_date}T${a.out_time || '00:00:00'}`).getTime();
          const dtB = new Date(`${b.out_date}T${b.out_time || '00:00:00'}`).getTime();
          if (!isNaN(dtA) && !isNaN(dtB) && dtA !== dtB) {
            return dtB - dtA;
          }
        }
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });

      setRecentPasses(sortedPasses.slice(0, 5));

      // Calculate Weekly Trends
      const today = new Date();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const trendArray: { day: string; count: number; height: string }[] = [];
      let totalPasses = 0;
      let peakCount = 0;
      let peakDay = 'N/A';

      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayStr = days[d.getDay()];
        const dateStr = d.toISOString().split('T')[0];

        const dayCount = allPasses.filter(p => p.out_date === dateStr).length;
        totalPasses += dayCount;
        if (dayCount > peakCount) {
          peakCount = dayCount;
          peakDay = dayStr;
        }

        trendArray.push({
          day: dayStr,
          count: dayCount,
          height: '0%' // calculated later
        });
      }

      // Calculate heights relative to peak
      trendArray.forEach(item => {
        item.height = peakCount > 0 ? `${Math.max(10, Math.round((item.count / peakCount) * 100))}%` : '10%';
      });

      setWeeklyTrends(trendArray);
      setTrendStats({
        peakDay: peakCount > 0 ? `${peakDay} (${peakCount} Outpasses)` : 'N/A',
        peakCount,
        average: Number((totalPasses / 7).toFixed(1)),
        trendPercent: totalPasses > 0 ? '+Active Movements' : 'No Movements'
      });
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-4 border-[#0B1437] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 sm:pb-0">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Operations Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time overview of residential occupancy, gate movements, and facilities</p>
        </div>
      </div>

      {/* 4 Pastel Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          variant="primary"
          title="Total Hostels"
          value={stats?.total_hostels || 0}
          change="+2 Blocks Active"
          icon={<Building2 className="w-5 h-5 text-[#0B1437]" />}
        />
        <StatCard
          variant="secondary"
          title="Occupancy Rate"
          value={`${stats?.occupancy_rate || 0}%`}
          change={`${stats?.total_students || stats?.occupied_beds || 0} / ${stats?.total_capacity || 0} Beds`}
          icon={<BedDouble className="w-5 h-5 text-slate-800" />}
        />
        <StatCard
          variant="accent"
          title="Pending Gate Passes"
          value={stats?.pending_gate_passes || 0}
          change="Action Required"
          icon={<Clock className="w-5 h-5 text-sky-950" />}
        />
        <StatCard
          variant="muted"
          title="Active Issues"
          value={stats?.active_issues || 0}
          change="Open Maintenance"
          icon={<AlertCircle className="w-5 h-5 text-slate-800" />}
        />
      </div>

      {/* Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Donut Graph Panel */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">Occupancy Breakdown</h3>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">Total Live</span>
            </div>

            {/* Visual Ring / Donut */}
            <div className="relative flex items-center justify-center my-6">
              <div className="w-44 h-44 rounded-full border-[18px] border-blue-100 flex items-center justify-center relative">
                <div className="w-28 h-28 rounded-full border-[10px] border-blue-50 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{stats?.occupancy_rate || 0}%</span>
                  <span className="text-[10px] text-slate-400 font-medium">Occupied</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0B1437]" />
                  <span className="font-medium text-slate-700">Occupied Beds</span>
                </div>
                <span className="font-bold text-slate-900">{stats?.total_students || stats?.occupied_beds || 0} Beds</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-100" />
                  <span className="font-medium text-slate-700">Vacant Beds</span>
                </div>
                <span className="font-bold text-slate-900">{stats?.vacant_beds || 0} Beds</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Movement Bar Chart Panel */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Weekly Gate Movement Trends</h3>
                <p className="text-xs text-slate-400">Total outpass check-outs recorded over the past 7 days</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-[#0B1437] border border-blue-200">
                {trendStats.trendPercent}
              </span>
            </div>

            <div className="grid grid-cols-7 gap-3 h-48 items-end pt-6 pb-2 border-b border-slate-100">
              {weeklyTrends.map((bar, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900 transition-colors">
                    {bar.count}
                  </div>
                  <div
                    style={{ height: bar.height }}
                    className="w-full max-w-[36px] bg-blue-100 rounded-2xl group-hover:bg-[#0B1437] transition-all"
                  />
                  <span className="text-[11px] font-semibold text-slate-500">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 text-xs text-slate-500">
            <span>Peak Day: <strong>{trendStats.peakDay}</strong></span>
            <span>Average: <strong>{trendStats.average} Passes / Day</strong></span>
          </div>
        </div>
      </div>

      {/* Recent Gate Pass Requests - Responsive (Table on Desktop, Cards on Mobile) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Recent Gate Pass Activity</h3>
            <p className="text-xs text-slate-400">Live requests logged by resident students across hostel blocks</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 self-start sm:self-auto bg-slate-100 sm:bg-transparent px-2.5 py-1 rounded-full sm:p-0">
            Showing Last 5 Requests
          </span>
        </div>

        {/* Mobile View: Cards */}
        <div className="block md:hidden divide-y divide-slate-100">
          {recentPasses.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No recent gate pass requests found.
            </div>
          ) : (
            recentPasses.map((p) => (
              <div key={p.id} className="p-4 space-y-3 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0B1437] font-bold flex items-center justify-center text-sm shrink-0">
                      {p.student_name?.[0] || 'S'}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm leading-snug">{p.student_name || 'Student'}</h4>
                      <p className="font-mono text-xs text-slate-500 font-medium">{p.enrollment_no}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${
                    p.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    p.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    p.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {p.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Hostel & Room</span>
                    <span className="font-medium text-slate-700 truncate block">
                      {p.hostel_name ? `${p.hostel_name} · ${formatFloorRoom(p.floor, p.room_no)}` : (p.room_no ? formatFloorRoom(p.floor, p.room_no) : 'N/A')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Pass Type</span>
                    <span className="font-semibold text-slate-800 uppercase block">
                      {p.pass_type}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Out Date & Time</span>
                    <span className="font-mono text-slate-600 block">
                      {p.out_date} {p.out_time ? `(${formatTime12(p.out_time)})` : ''}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Outpass Reason</span>
                  <button
                    onClick={() => setSelectedReasonPass(p)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-800 hover:bg-teal-100 text-xs font-semibold shrink-0 transition-colors border border-teal-200/70 shadow-2xs active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5 text-teal-700" />
                    <span>View Reason</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pl-6">Student</th>
                <th className="py-3.5 px-4">USN / Enrollment</th>
                <th className="py-3.5 px-4">Hostel Block</th>
                <th className="py-3.5 px-4">Pass Type</th>
                <th className="py-3.5 px-4">Out Date & Time</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 pr-6 text-center">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {recentPasses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No recent gate pass requests found.
                  </td>
                </tr>
              ) : (
                recentPasses.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 pl-6 font-semibold text-slate-800 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0B1437] font-bold flex items-center justify-center text-xs">
                        {p.student_name?.[0] || 'S'}
                      </div>
                      <span>{p.student_name || 'Student'}</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-slate-700 font-semibold">
                      {p.enrollment_no}
                    </td>
                    <td className="py-4 px-4 text-xs font-medium text-slate-600">
                      {p.hostel_name ? `${p.hostel_name} · ${formatFloorRoom(p.floor, p.room_no)}` : (p.room_no ? formatFloorRoom(p.floor, p.room_no) : 'N/A')}
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-slate-700 uppercase">
                      {p.pass_type}
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-600">
                      {p.out_date} {p.out_time ? `(${formatTime12(p.out_time)})` : ''}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        p.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        p.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        p.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 pr-6 text-center">
                      <button
                        onClick={() => setSelectedReasonPass(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-800 hover:bg-teal-100 text-xs font-medium border border-teal-200/70 shadow-xs hover:shadow transition-all group"
                        title="Click to view full reason"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-700 group-hover:scale-110 transition-transform" />
                        <span>View Reason</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reason Details Modal Dialog */}
      {selectedReasonPass && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedReasonPass(null)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-slate-800 font-bold flex items-center justify-center text-sm shadow-xs">
                  {selectedReasonPass.student_name?.[0] || 'S'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    {selectedReasonPass.student_name || 'Student'}
                  </h3>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    {selectedReasonPass.enrollment_no} · {selectedReasonPass.hostel_name ? `${selectedReasonPass.hostel_name} · ${formatFloorRoom(selectedReasonPass.floor, selectedReasonPass.room_no)}` : (selectedReasonPass.room_no ? formatFloorRoom(selectedReasonPass.floor, selectedReasonPass.room_no) : 'N/A')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReasonPass(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metadata Pill Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-0.5">Pass Type</span>
                <span className="font-semibold text-slate-800 uppercase">
                  {selectedReasonPass.pass_type?.replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-0.5">Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  selectedReasonPass.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  selectedReasonPass.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  selectedReasonPass.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {selectedReasonPass.status.toUpperCase()}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-0.5">Out Time</span>
                <span className="font-mono text-slate-700">
                  {selectedReasonPass.out_date} {selectedReasonPass.out_time ? `(${formatTime12(selectedReasonPass.out_time)})` : ''}
                </span>
              </div>
            </div>

            {/* Reason Body */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Reason / Purpose for Outpass
              </label>
              <div className="bg-amber-50/40 border border-amber-200/70 p-4 rounded-2xl text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                {selectedReasonPass.purpose || selectedReasonPass.reason || 'No specific reason provided.'}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedReasonPass(null)}
                className="px-5 py-2.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
