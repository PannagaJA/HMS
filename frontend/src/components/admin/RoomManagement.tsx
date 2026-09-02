import React, { useEffect, useState } from 'react';
import { BedDouble, Plus, Building2 } from 'lucide-react';
import type { Hostel, HostelRoom, HostelStudent } from '../../types';
import { apiClient } from '../../api/apiClient';

export const RoomManagement: React.FC = () => {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<number | null>(null);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [students, setStudents] = useState<HostelStudent[]>([]);

  // Allocate modal state
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [targetRoom, setTargetRoom] = useState<HostelRoom | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [bedNumber, setBedNumber] = useState('1');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedHostel) {
      fetchRooms(selectedHostel);
    }
  }, [selectedHostel]);

  const fetchInitialData = async () => {
    try {
      const [hostelsRes, studentsRes] = await Promise.all([
        apiClient.get<Hostel[]>('/hms/hostels/'),
        apiClient.get<HostelStudent[]>('/student/students/'),
      ]);
      setHostels(hostelsRes.data);
      setStudents(studentsRes.data);
      if (hostelsRes.data.length > 0) {
        setSelectedHostel(hostelsRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load room matrix data', err);
    }
  };

  const fetchRooms = async (hostelId: number) => {
    try {
      const res = await apiClient.get<HostelRoom[]>(`/hms/rooms/?hostel=${hostelId}`);
      setRooms(res.data);
    } catch (err) {
      console.error('Failed to load rooms', err);
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRoom || !selectedStudentId) return;

    try {
      await apiClient.post('/student/students/allocate_room/', {
        student_id: Number(selectedStudentId),
        room_id: targetRoom.id,
        bed_number: bedNumber,
      });
      setShowAllocateModal(false);
      setSelectedStudentId('');
      if (selectedHostel) fetchRooms(selectedHostel);
      // refresh students list
      const studentsRes = await apiClient.get<HostelStudent[]>('/student/students/');
      setStudents(studentsRes.data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Allocation failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Room & Bed Occupancy Matrix</h1>
          <p className="text-sm text-slate-500 mt-0.5">Floor-by-floor view of room capacity and resident bed assignments</p>
        </div>
      </div>

      {/* Hostel Selection Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {hostels.map((h) => (
          <button
            key={h.id}
            onClick={() => setSelectedHostel(h.id)}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm flex items-center gap-2 ${
              selectedHostel === h.id
                ? 'bg-[#0D3833] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{h.name}</span>
          </button>
        ))}
      </div>

      {/* Room Matrix Grid */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded-md bg-[#E8F8CE] border border-emerald-300" /> Vacant Bed
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 rounded-md bg-[#0D3833]" /> Occupied Bed
            </span>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            Total {rooms.length} Rooms in selected hostel
          </div>
        </div>

        {rooms.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            No rooms created for this hostel yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {rooms.map((room) => {
              const isFull = room.occupied_count >= room.capacity;
              return (
                <div
                  key={room.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isFull
                      ? 'bg-slate-50/60 border-slate-200'
                      : 'bg-white border-slate-200 hover:border-teal-500 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-base font-bold text-slate-900">{room.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Floor {room.floor}
                    </span>
                  </div>

                  {/* Bed Slots */}
                  <div className="flex items-center gap-2 mb-4">
                    {Array.from({ length: room.capacity }).map((_, idx) => {
                      const isOccupied = idx < room.occupied_count;
                      return (
                        <div
                          key={idx}
                          className={`flex-1 py-2 px-2 rounded-xl text-center text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                            isOccupied
                              ? 'bg-[#0D3833] text-white border-transparent'
                              : 'bg-[#E8F8CE] text-emerald-950 border-emerald-200'
                          }`}
                        >
                          <BedDouble className="w-3.5 h-3.5" />
                          <span>Bed {idx + 1}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-400">
                      {room.occupied_count} / {room.capacity} Occupied
                    </span>
                    {!isFull && (
                      <button
                        onClick={() => {
                          setTargetRoom(room);
                          setShowAllocateModal(true);
                        }}
                        className="font-semibold text-teal-800 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Allocate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Allocation Modal */}
      {showAllocateModal && targetRoom && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Allocate Bed in {targetRoom.name}</h3>
            <p className="text-xs text-slate-500 mb-5">Select a student to assign to this vacant bed slot.</p>

            <form onSubmit={handleAllocate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Unallotted Student
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                >
                  <option value="">-- Choose Student --</option>
                  {students.filter((s) => !s.room_allotted).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.student_name} ({s.enrollment_no})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Bed Number / Slot
                </label>
                <select
                  value={bedNumber}
                  onChange={(e) => setBedNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                >
                  <option value="1">Bed 1</option>
                  <option value="2">Bed 2</option>
                  <option value="3">Bed 3</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm"
                >
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
