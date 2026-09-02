import React, { useEffect, useState } from 'react';
import { BedDouble, Plus, X } from 'lucide-react';
import type { HostelRoom, Hostel } from '../../types';
import { apiClient } from '../../api/apiClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const RoomManagement: React.FC = () => {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<number | 'ALL'>('ALL');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showOccupantsDrawer, setShowOccupantsDrawer] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<HostelRoom | null>(null);

  // Bulk room generator state
  const [bulkFloor, setBulkFloor] = useState(1);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkCapacity, setBulkCapacity] = useState(2);
  const [bulkRoomType, setBulkRoomType] = useState('D');

  useEffect(() => {
    fetchHostels();
  }, []);

  useEffect(() => {
    if (selectedHostelId) {
      fetchRooms(selectedHostelId);
    }
  }, [selectedHostelId]);

  const fetchHostels = async () => {
    try {
      const res = await apiClient.get<Hostel[]>('/hms/hostels/');
      setHostels(res.data);
      if (res.data.length > 0) {
        setSelectedHostelId(String(res.data[0].id));
      }
    } catch (err) {
      console.error('Failed to load hostels', err);
    }
  };

  const fetchRooms = async (hostelId: string) => {
    try {
      const res = await apiClient.get<HostelRoom[]>(`/hms/rooms/?hostel=${hostelId}`);
      setRooms(res.data);
    } catch (err) {
      console.error('Failed to load rooms', err);
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/hms/rooms/bulk_create_rooms/', {
        hostel_id: Number(selectedHostelId),
        floor: bulkFloor,
        room_count: bulkCount,
        capacity: bulkCapacity,
        room_type: bulkRoomType,
      });
      setShowBulkModal(false);
      fetchRooms(selectedHostelId);
    } catch (err) {
      alert('Failed to generate rooms');
    }
  };

  const handleViewRoom = (room: HostelRoom) => {
    setSelectedRoom(room);
    setShowOccupantsDrawer(true);
  };

  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);
  const filteredRooms = rooms.filter((r) => selectedFloor === 'ALL' || r.floor === selectedFloor);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Room Matrix & Bed Allocation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visualize room occupancy, bed slots, and residential allocations per floor</p>
        </div>
        <button
          onClick={() => setShowBulkModal(true)}
          className="px-5 py-2.5 rounded-full bg-[#0D3833] text-white text-sm font-semibold hover:bg-[#064E3B] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Bulk Generate Rooms</span>
        </button>
      </div>

      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Select Block:</span>
          <div className="w-64">
            <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose hostel block" />
              </SelectTrigger>
              <SelectContent>
                {hostels.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedFloor('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              selectedFloor === 'ALL'
                ? 'bg-[#0D3833] text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Floors
          </button>
          {floors.map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFloor(f)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                selectedFloor === f
                  ? 'bg-[#0D3833] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Floor {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredRooms.map((room) => {
          const isFull = room.occupied_count >= room.capacity;
          const isPartiallyOccupied = room.occupied_count > 0 && !isFull;

          return (
            <div
              key={room.id}
              onClick={() => handleViewRoom(room)}
              className={`p-4 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
                isFull
                  ? 'bg-rose-50/60 border-rose-200 hover:border-rose-400'
                  : isPartiallyOccupied
                  ? 'bg-amber-50/60 border-amber-200 hover:border-amber-400'
                  : 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-400'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">Fl {room.floor}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isFull ? 'bg-rose-100 text-rose-800' : isPartiallyOccupied ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {isFull ? 'FULL' : isPartiallyOccupied ? 'PARTIAL' : 'VACANT'}
                </span>
              </div>

              <div className="text-lg font-bold text-slate-900 mb-1">
                Room {room.no}
              </div>

              <div className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                <BedDouble className="w-3.5 h-3.5 text-slate-400" />
                <span>{room.room_type_display || `${room.capacity}-Bed`}</span>
              </div>

              <div className="flex items-center gap-1 pt-2 border-t border-slate-200/60">
                {Array.from({ length: room.capacity }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full ${
                      i < room.occupied_count ? 'bg-[#0D3833]' : 'bg-white border border-slate-300'
                    }`}
                    title={`Bed ${i + 1}: ${i < room.occupied_count ? 'Occupied' : 'Vacant'}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Room Occupants Centered Modal Popup */}
      {showOccupantsDrawer && selectedRoom && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-7 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Room {selectedRoom.no} Details</h3>
                  <p className="text-xs text-slate-500">Floor {selectedRoom.floor} · {selectedRoom.room_type_display || 'Standard'}</p>
                </div>
                <button
                  onClick={() => setShowOccupantsDrawer(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Total Capacity</span>
                    <span className="font-bold text-slate-800 text-sm">{selectedRoom.capacity} Beds</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Occupied Slots</span>
                    <span className="font-bold text-slate-800 text-sm">{selectedRoom.occupied_count} Students</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">Allocated Bed Slots</h4>
                  <div className="space-y-2.5">
                    {Array.from({ length: selectedRoom.capacity }).map((_, idx) => {
                      const isOccupied = idx < selectedRoom.occupied_count;
                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-colors ${
                            isOccupied
                              ? 'bg-white border-slate-200/80 shadow-xs'
                              : 'bg-slate-50/60 border-dashed border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                              isOccupied ? 'bg-[#0D3833] text-white shadow-xs' : 'bg-slate-200 text-slate-500'
                            }`}>
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">
                                {isOccupied ? `Occupant on Bed ${idx + 1}` : `Bed Slot ${idx + 1}`}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {isOccupied ? 'Active Resident' : 'Available for Allocation'}
                              </div>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isOccupied ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            {isOccupied ? 'OCCUPIED' : 'VACANT'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowOccupantsDrawer(false)}
                className="px-6 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-colors cursor-pointer shadow-sm"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Room Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Bulk Room Generator</h3>
            <p className="text-xs text-slate-500 mb-5">Automatically create numbered room slots on a floor.</p>

            <form onSubmit={handleBulkGenerate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Floor Number</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    required
                    value={bulkFloor}
                    onChange={(e) => setBulkFloor(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Number of Rooms</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={bulkCount}
                    onChange={(e) => setBulkCount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bed Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    required
                    value={bulkCapacity}
                    onChange={(e) => setBulkCapacity(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Room Type</label>
                  <Select value={bulkRoomType} onValueChange={setBulkRoomType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Room Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S">Single</SelectItem>
                      <SelectItem value="D">Double</SelectItem>
                      <SelectItem value="T">Triple</SelectItem>
                      <SelectItem value="P">Scholar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer"
                >
                  Generate Matrix
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
