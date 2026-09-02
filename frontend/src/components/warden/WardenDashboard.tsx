import React, { useEffect, useState } from 'react';
import {
  Users,
  Ticket,
  Wrench,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import type { HostelRoom } from '../../types';

interface ManagedHostel {
  id: number;
  name: string;
  gender: string;
  floors: number;
}

interface WardenStats {
  managed_hostels: ManagedHostel[];
  total_residents: number;
  total_rooms: number;
  total_capacity: number;
  pending_gate_passes: number;
  open_issues: number;
  occupancy_rate: number;
}

export const WardenDashboard: React.FC = () => {
  const [stats, setStats] = useState<WardenStats | null>(null);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<number | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<HostelRoom | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (selectedHostelId) {
      fetchRooms(selectedHostelId, selectedFloor);
    }
  }, [selectedHostelId, selectedFloor]);

  const fetchDashboardData = async () => {
    try {
      const res = await apiClient.get<WardenStats>('/warden/dashboard/');
      setStats(res.data);
      if (res.data.managed_hostels.length > 0) {
        setSelectedHostelId(res.data.managed_hostels[0].id);
      }
    } catch (err) {
      console.error('Failed to load warden dashboard', err);
    }
  };

  const fetchRooms = async (hostelId: number, floor: string) => {
    try {
      const url = floor === 'all'
        ? `/warden/rooms/?hostel_id=${hostelId}`
        : `/warden/rooms/?hostel_id=${hostelId}&floor=${floor}`;
      const res = await apiClient.get<HostelRoom[]>(url);
      setRooms(res.data);
    } catch (err) {
      console.error('Failed to load warden rooms', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Warden Control Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time room occupancy, pending outpasses, and hostel maintenance</p>
        </div>

        {/* Hostel Selector */}
        {stats && stats.managed_hostels.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">Hostel Block:</label>
            <select
              value={selectedHostelId || ''}
              onChange={(e) => setSelectedHostelId(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-full px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 cursor-pointer"
            >
              {stats.managed_hostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.gender})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Residents</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats?.total_residents || 0}</h3>
            <span className="text-[11px] text-emerald-600 font-medium">In assigned blocks</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Occupancy Rate</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats?.occupancy_rate || 0}%</h3>
            <span className="text-[11px] text-teal-600 font-medium">{stats?.total_rooms || 0} Total Rooms</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending Passes</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{stats?.pending_gate_passes || 0}</h3>
            <span className="text-[11px] text-slate-400 font-medium">Requires review</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Ticket className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Open Issues</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">{stats?.open_issues || 0}</h3>
            <span className="text-[11px] text-slate-400 font-medium">Maintenance tickets</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center">
            <Wrench className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Interactive Room & Bed Matrix */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Room & Bed Occupancy Matrix</h3>
            <p className="text-xs text-slate-400">Click any room card to view residents and bed allocations</p>
          </div>

          {/* Floor Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {['all', '1', '2', '3', '4'].map((fl) => (
              <button
                key={fl}
                onClick={() => setSelectedFloor(fl)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedFloor === fl
                    ? 'bg-[#0D3833] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {fl === 'all' ? 'All Floors' : `Floor ${fl}`}
              </button>
            ))}
          </div>
        </div>

        {rooms.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No rooms found for the selected filter.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {rooms.map((room) => {
              const occ = room.occupied_count || room.current_occupancy || (room.occupants ? room.occupants.length : 0);
              const isFull = occ >= room.capacity;
              const isEmpty = occ === 0;

              return (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${
                    isFull
                      ? 'bg-rose-50/40 border-rose-200/70 hover:border-rose-400'
                      : isEmpty
                      ? 'bg-emerald-50/40 border-emerald-200/70 hover:border-emerald-400'
                      : 'bg-amber-50/40 border-amber-200/70 hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-900 text-sm">Room {room.no}</span>
                    <span className="text-[10px] font-semibold text-slate-400">Fl {room.floor}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Beds:</span>
                    <span className="font-bold text-slate-800">{occ} / {room.capacity}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isFull ? 'bg-rose-500' : isEmpty ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, (occ / room.capacity) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Room Details Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Room {selectedRoom.no} Details</h3>
                <p className="text-xs text-slate-400">Floor {selectedRoom.floor} · {selectedRoom.hostel_name || 'Hostel Block'}</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                Capacity: {selectedRoom.capacity}
              </span>
            </div>

            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Current Occupants</h4>
              {(!selectedRoom.occupants || selectedRoom.occupants.length === 0) ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-400">
                  Room is currently vacant.
                </div>
              ) : (
                selectedRoom.occupants.map((occ: any, i: number) => (
                  <div key={i} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#0D3833] text-white flex items-center justify-center text-xs font-bold">
                        {occ.student_name?.[0] || 'S'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{occ.student_name}</div>
                        <div className="text-[10px] text-slate-400">{occ.enrollment_no}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Bed {occ.bed_number || i + 1}
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setSelectedRoom(null)}
              className="w-full py-2.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
