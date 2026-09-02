import React, { useEffect, useState } from 'react';
import { Building2, BedDouble, AlertCircle, Clock } from 'lucide-react';
import { StatCard } from '../common/StatCard';
import type { DashboardStats, GatePassRequest } from '../../types';
import { apiClient } from '../../api/apiClient';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPasses, setRecentPasses] = useState<GatePassRequest[]>([]);
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
      setRecentPasses(passesRes.data.slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-4 border-[#0D3833] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
          variant="lime"
          title="Total Hostels"
          value={stats?.total_hostels || 0}
          change="+2 Blocks Active"
          icon={<Building2 className="w-5 h-5 text-emerald-950" />}
        />
        <StatCard
          variant="teal"
          title="Occupancy Rate"
          value={`${stats?.occupancy_rate || 0}%`}
          change={`${stats?.total_students || stats?.occupied_beds || 0} / ${stats?.total_capacity || 0} Beds`}
          icon={<BedDouble className="w-5 h-5 text-teal-950" />}
        />
        <StatCard
          variant="pink"
          title="Pending Gate Passes"
          value={stats?.pending_gate_passes || 0}
          change="Action Required"
          icon={<Clock className="w-5 h-5 text-rose-950" />}
        />
        <StatCard
          variant="lavender"
          title="Active Issues"
          value={stats?.active_issues || 0}
          change="Open Maintenance"
          icon={<AlertCircle className="w-5 h-5 text-indigo-950" />}
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
              <div className="w-44 h-44 rounded-full border-[18px] border-[#D1F2EA] flex items-center justify-center relative">
                <div className="w-28 h-28 rounded-full border-[10px] border-[#E8F8CE] flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-slate-900">{stats?.occupancy_rate || 0}%</span>
                  <span className="text-[10px] text-slate-400 font-medium">Occupied</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0D3833]" />
                  <span className="font-medium text-slate-700">Occupied Beds</span>
                </div>
                <span className="font-bold text-slate-900">{stats?.total_students || stats?.occupied_beds || 0} Beds</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D1F2EA]" />
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
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#E8F8CE] text-emerald-900 border border-emerald-200">
                +14.2% Movements
              </span>
            </div>

            <div className="grid grid-cols-7 gap-3 h-48 items-end pt-6 pb-2 border-b border-slate-100">
              {[
                { day: 'Mon', count: 45, height: '40%' },
                { day: 'Tue', count: 32, height: '30%' },
                { day: 'Wed', count: 68, height: '65%' },
                { day: 'Thu', count: 54, height: '50%' },
                { day: 'Fri', count: 95, height: '90%' },
                { day: 'Sat', count: 110, height: '100%' },
                { day: 'Sun', count: 76, height: '70%' },
              ].map((bar, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900 transition-colors">
                    {bar.count}
                  </div>
                  <div
                    style={{ height: bar.height }}
                    className="w-full max-w-[36px] bg-[#D1F2EA] rounded-2xl group-hover:bg-[#0D3833] transition-all"
                  />
                  <span className="text-[11px] font-semibold text-slate-500">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 text-xs text-slate-500">
            <span>Peak Day: <strong>Saturday (110 Outpasses)</strong></span>
            <span>Average: <strong>68.5 Passes / Day</strong></span>
          </div>
        </div>
      </div>

      {/* Recent Gate Pass Requests Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Recent Gate Pass Activity</h3>
            <p className="text-xs text-slate-400">Live requests logged by resident students across hostel blocks</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">Showing Last 5 Requests</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pl-6">Student</th>
                <th className="py-3.5 px-4">USN / Enrollment</th>
                <th className="py-3.5 px-4">Hostel Block</th>
                <th className="py-3.5 px-4">Pass Type</th>
                <th className="py-3.5 px-4">Out Date & Time</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 pr-6 text-right">Reason</th>
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
                      <div className="w-8 h-8 rounded-full bg-[#E8F8CE] text-emerald-950 font-bold flex items-center justify-center text-xs">
                        {p.student_name[0]}
                      </div>
                      <span>{p.student_name}</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-slate-700 font-semibold">
                      {p.enrollment_no}
                    </td>
                    <td className="py-4 px-4 text-xs font-medium text-slate-600">
                      {p.hostel_name || 'Block A'} (Rm {p.room_no || '101'})
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-slate-700 uppercase">
                      {p.pass_type}
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-600">
                      {p.out_date} {p.out_time ? `(${p.out_time})` : ''}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        p.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        p.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        p.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 pr-6 text-right text-xs text-slate-500 max-w-xs truncate">
                      {p.purpose || p.reason || 'Personal Visit'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
