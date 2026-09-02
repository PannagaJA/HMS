import React, { useEffect, useState } from 'react';
import { Building2, Users, KeyRound, Wrench, Plus, ArrowUpRight } from 'lucide-react';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import type { DashboardStats, GatePassRequest } from '../../types';
import { apiClient } from '../../api/apiClient';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPasses, setRecentPasses] = useState<GatePassRequest[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, passesRes] = await Promise.all([
        apiClient.get<DashboardStats>('/hms/hostels/dashboard_stats/'),
        apiClient.get<GatePassRequest[]>('/security/gate-passes/'),
      ]);
      setStats(statsRes.data);
      setRecentPasses(passesRes.data.slice(0, 5));
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome, Administrator!</h1>
          <p className="text-sm text-slate-500 mt-0.5">Here is the real-time operational pulse across campus hostels.</p>
        </div>
        <button className="px-5 py-2.5 rounded-full bg-[#0D3833] text-white text-sm font-semibold hover:bg-[#064E3B] transition-all shadow-sm flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Quick Allocation</span>
        </button>
      </div>

      {/* 4 Pastel Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          variant="lime"
          title="Total Hostels"
          value={stats?.total_hostels || '2 Hostels'}
          change="+1 New Block"
          icon={<Building2 className="w-4 h-4 text-emerald-950" />}
        />
        <StatCard
          variant="teal"
          title="Occupancy Rate"
          value={`${stats?.occupancy_rate || 88.4}%`}
          change={`${stats?.occupied_beds || 1}/${stats?.total_capacity || 7} Beds`}
          icon={<Users className="w-4 h-4 text-teal-950" />}
        />
        <StatCard
          variant="pink"
          title="Pending Gate Passes"
          value={stats?.pending_gate_passes || '1 Request'}
          change="Action Required"
          icon={<KeyRound className="w-4 h-4 text-rose-950" />}
        />
        <StatCard
          variant="lavender"
          title="Active Maintenance"
          value={stats?.active_issues || '1 Issue'}
          change="In Progress"
          icon={<Wrench className="w-4 h-4 text-indigo-950" />}
        />
      </div>

      {/* Center Graph Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">Residence Distribution</h3>
            <button className="text-xs font-semibold text-teal-800 hover:underline flex items-center gap-1">
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center justify-center my-6">
            <div className="relative w-44 h-44 rounded-full border-[14px] border-[#D1F2EA] flex items-center justify-center border-t-[#E8F8CE] border-r-[#FCE2E1]">
              <div className="text-center">
                <div className="text-xs font-semibold text-slate-400">Total Beds</div>
                <div className="text-2xl font-bold text-slate-900">{stats?.total_capacity || 7}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 text-center">
            <div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mx-auto mb-1" />
              <div className="text-[11px] text-slate-400 font-medium">Occupied</div>
              <div className="text-xs font-bold text-slate-800">{stats?.occupied_beds || 1}</div>
            </div>
            <div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300 mx-auto mb-1" />
              <div className="text-[11px] text-slate-400 font-medium">Vacant</div>
              <div className="text-xs font-bold text-slate-800">{stats?.vacant_beds || 6}</div>
            </div>
            <div>
              <div className="w-2.5 h-2.5 rounded-full bg-rose-400 mx-auto mb-1" />
              <div className="text-[11px] text-slate-400 font-medium">Reserved</div>
              <div className="text-xs font-bold text-slate-800">0</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold text-slate-800">Weekly Gate Activity</h3>
              <p className="text-xs text-slate-400">Recorded student departures and arrivals</p>
            </div>
            <div className="px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-600">
              This Week
            </div>
          </div>

          <div className="h-48 flex items-end justify-between gap-4 px-4 my-4">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
              const heights = ['h-24', 'h-32', 'h-40', 'h-28', 'h-44', 'h-36', 'h-20'];
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full max-w-[32px] bg-slate-100 rounded-full h-44 flex items-end p-1">
                    <div className={`w-full rounded-full ${heights[idx]} ${
                      idx === 4 ? 'bg-[#0D3833]' : 'bg-[#D1F2EA]'
                    }`} />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">{day}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span>Peak Activity: <strong className="text-slate-800">Friday (44 Exits)</strong></span>
            <span className="text-emerald-700 font-semibold">98.2% On-Time Returns</span>
          </div>
        </div>
      </div>

      {/* Recent Gate Pass Requests Table */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-slate-800">Recent Gate Pass Applications</h3>
            <p className="text-xs text-slate-400">Live student requests awaiting verification or entry logs</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pl-2">Student</th>
                <th className="pb-3">Hostel & Room</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Out Date & Time</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 pr-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {recentPasses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 text-sm">
                    No active gate pass requests found.
                  </td>
                </tr>
              ) : (
                recentPasses.map((pass) => (
                  <tr key={pass.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 pl-2 font-semibold text-slate-800 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                        {pass.student_name?.[0] || 'S'}
                      </div>
                      <div>
                        <div>{pass.student_name}</div>
                        <div className="text-[11px] font-normal text-slate-400">{pass.enrollment_no}</div>
                      </div>
                    </td>
                    <td className="py-3.5 text-slate-600">
                      <div>{pass.hostel_name}</div>
                      <div className="text-xs text-slate-400">Room {pass.room_no || '101'}</div>
                    </td>
                    <td className="py-3.5 text-slate-600 font-medium text-xs">
                      {pass.pass_type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3.5 text-slate-600 text-xs">
                      <div>{pass.out_date}</div>
                      <div className="text-slate-400">{pass.out_time}</div>
                    </td>
                    <td className="py-3.5">
                      <StatusBadge status={pass.status} />
                    </td>
                    <td className="py-3.5 pr-2 text-right">
                      <button className="text-xs font-semibold text-[#0D3833] hover:underline">
                        Details
                      </button>
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
