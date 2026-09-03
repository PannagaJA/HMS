import React, { useEffect, useState } from 'react';
import {
  Users,
  Ticket,
  Wrench,
  TrendingUp,
  Layers,
  DoorClosed,
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import type { HostelRoom } from '../../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

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
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<HostelRoom | null>(null);

  const currentHostel = stats?.managed_hostels?.find((h) => h.id === selectedHostelId);

  useEffect(() => {
    fetchDashboardData(selectedHostelId);
  }, [selectedHostelId]);

  useEffect(() => {
    if (selectedHostelId && selectedFloor) {
      fetchRooms(selectedHostelId, selectedFloor);
    } else {
      setRooms([]);
    }
  }, [selectedHostelId, selectedFloor]);

  const handleHostelChange = (hostelId: number) => {
    setSelectedHostelId(hostelId);
    setSelectedFloor('all');
  };

  const fetchDashboardData = async (hostelId?: number | null) => {
    try {
      const url = hostelId ? `/warden/dashboard/?hostel_id=${hostelId}` : '/warden/dashboard/';
      const res = await apiClient.get<WardenStats>(url);
      setStats(res.data);
      if (!selectedHostelId && res.data?.managed_hostels?.length > 0) {
        setSelectedHostelId(res.data.managed_hostels[0].id);
        setSelectedFloor('all');
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
            <div className="w-56">
              <Select
                value={selectedHostelId ? String(selectedHostelId) : ''}
                onValueChange={(val) => handleHostelChange(Number(val))}
              >
                <SelectTrigger className="h-9 rounded-full bg-white text-xs font-semibold shadow-xs">
                  <SelectValue placeholder="Select Hostel Block" />
                </SelectTrigger>
                <SelectContent>
                  {stats.managed_hostels.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>
                      {h.name} ({h.gender})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Metric Cards Grid: 2 columns on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Residents</p>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{stats?.total_residents || 0}</h3>
            <span className="text-[10px] sm:text-[11px] text-emerald-600 font-medium truncate block">In assigned blocks</span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 self-end sm:self-auto">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Occupancy Rate</p>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{stats?.occupancy_rate || 0}%</h3>
            <span className="text-[10px] sm:text-[11px] text-teal-600 font-medium truncate block">{stats?.total_rooms || 0} Total Rooms</span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 self-end sm:self-auto">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending Passes</p>
            <h3 className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">{stats?.pending_gate_passes || 0}</h3>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate block">Requires review</span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 self-end sm:self-auto">
            <Ticket className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Open Issues</p>
            <h3 className="text-xl sm:text-2xl font-bold text-rose-600 mt-1">{stats?.open_issues || 0}</h3>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate block">Maintenance tickets</span>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 self-end sm:self-auto">
            <Wrench className="w-5 h-5 sm:w-6 sm:h-6" />
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

          {/* Dynamic Floor Selector based on selected Hostel Block */}
          <div className="flex items-center gap-2">
            <div className="w-[170px]">
              <Select
                value={selectedFloor}
                onValueChange={setSelectedFloor}
                disabled={!selectedHostelId}
              >
                <SelectTrigger className="w-full bg-slate-50 border-slate-200 text-xs font-semibold text-slate-800 disabled:opacity-50">
                  <SelectValue placeholder="Select Floor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Floors ({currentHostel ? `${currentHostel.floors || 4} Floors` : 'All'})
                  </SelectItem>
                  {Array.from({ length: currentHostel?.floors || 4 }, (_, i) => i + 1).map((fl) => (
                    <SelectItem key={fl} value={String(fl)}>
                      Floor {fl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {!selectedFloor ? (
          <div className="bg-slate-50/70 p-10 rounded-3xl border border-dashed border-slate-200 text-center space-y-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-900 flex items-center justify-center mx-auto border border-teal-200">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Select a Floor</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Choose a floor level or "All Floors" from the dropdown above to view the live room & bed matrix.
            </p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-slate-50/70 p-10 rounded-3xl border border-dashed border-slate-200 text-center space-y-2.5">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto border border-slate-200">
              <DoorClosed className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No Rooms Found</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              No rooms are registered for this floor in the selected hostel block.
            </p>
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
