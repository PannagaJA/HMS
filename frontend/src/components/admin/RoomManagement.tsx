import React, { useEffect, useState } from 'react';
import { BedDouble, Plus, X, Layers, Building2, Pencil, Trash2 } from 'lucide-react';
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
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSingleRoomModal, setShowSingleRoomModal] = useState(false);
  const [showEditRoomModal, setShowEditRoomModal] = useState(false);
  const [showOccupantsDrawer, setShowOccupantsDrawer] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<HostelRoom | null>(null);
  const [editingRoom, setEditingRoom] = useState<HostelRoom | null>(null);

  // Single Room Form State (Add / Create)
  const [singleHostelId, setSingleHostelId] = useState<string>('');
  const [singleFloor, setSingleFloor] = useState<string>('0');
  const [singleRoomNo, setSingleRoomNo] = useState<string>('');
  const [singleRoomName, setSingleRoomName] = useState<string>('');
  const [singleRoomType, setSingleRoomType] = useState<string>('S');
  const [singleCapacity, setSingleCapacity] = useState<number>(1);
  const [isSubmittingSingle, setIsSubmittingSingle] = useState<boolean>(false);

  // Edit Room Form State
  const [editHostelId, setEditHostelId] = useState<string>('');
  const [editFloor, setEditFloor] = useState<string>('0');
  const [editRoomNo, setEditRoomNo] = useState<string>('');
  const [editRoomName, setEditRoomName] = useState<string>('');
  const [editRoomType, setEditRoomType] = useState<string>('S');
  const [editCapacity, setEditCapacity] = useState<number>(1);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

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
      setSelectedFloor(''); // Reset floor selection on block change
    } else {
      setRooms([]);
      setSelectedFloor('');
    }
  }, [selectedHostelId]);

  const fetchHostels = async () => {
    try {
      const res = await apiClient.get<Hostel[]>('/hms/hostels/');
      setHostels(res.data);
      if (res.data.length > 0 && !selectedHostelId) {
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

  const handleOpenAddSingleRoom = () => {
    setSingleHostelId(selectedHostelId || (hostels[0] ? String(hostels[0].id) : ''));
    setSingleFloor('0');
    setSingleRoomNo('');
    setSingleRoomName('');
    setSingleRoomType('S');
    setSingleCapacity(1);
    setShowSingleRoomModal(true);
  };

  const handleSingleRoomTypeChange = (type: string) => {
    setSingleRoomType(type);
    if (type === 'S') setSingleCapacity(1);
    else if (type === 'D') setSingleCapacity(2);
    else if (type === 'T') setSingleCapacity(3);
    else if (type === 'P') setSingleCapacity(4);
  };

  const handleCreateSingleRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleRoomNo.trim() || !singleHostelId) {
      alert('Please fill in room number and select a hostel');
      return;
    }

    setIsSubmittingSingle(true);
    try {
      await apiClient.post('/hms/rooms/', {
        hostel: Number(singleHostelId),
        no: singleRoomNo.trim(),
        name: singleRoomName.trim() || `Room ${singleRoomNo.trim()}`,
        floor: Number(singleFloor),
        capacity: Number(singleCapacity),
        room_type: singleRoomType,
        vacant: true,
      });

      setShowSingleRoomModal(false);
      fetchRooms(singleHostelId);
    } catch (err: any) {
      console.error('Failed to create room:', err);
      alert('Failed to create room: ' + (err.response?.data?.detail || err.response?.data?.no?.[0] || err.message));
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  const handleOpenEditRoom = (e: React.MouseEvent, room: HostelRoom) => {
    e.stopPropagation(); // prevent opening occupants drawer
    setEditingRoom(room);
    setEditHostelId(String(room.hostel));
    setEditFloor(String(room.floor));
    setEditRoomNo(room.no || room.room_no || '');
    setEditRoomName(room.name || '');
    setEditRoomType(room.room_type || 'S');
    setEditCapacity(room.capacity || 1);
    setShowEditRoomModal(true);
  };

  const handleEditRoomTypeChange = (type: string) => {
    setEditRoomType(type);
    if (type === 'S') setEditCapacity(1);
    else if (type === 'D') setEditCapacity(2);
    else if (type === 'T') setEditCapacity(3);
    else if (type === 'P') setEditCapacity(4);
  };

  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !editRoomNo.trim() || !editHostelId) return;

    setIsSubmittingEdit(true);
    try {
      await apiClient.patch(`/hms/rooms/${editingRoom.id}/`, {
        hostel: Number(editHostelId),
        no: editRoomNo.trim(),
        name: editRoomName.trim() || `Room ${editRoomNo.trim()}`,
        floor: Number(editFloor),
        capacity: Number(editCapacity),
        room_type: editRoomType,
      });

      setShowEditRoomModal(false);
      setEditingRoom(null);
      fetchRooms(selectedHostelId);
    } catch (err: any) {
      console.error('Failed to update room:', err);
      alert('Failed to update room: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteRoom = async (e: React.MouseEvent, roomId: number, roomNo: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete Room ${roomNo}?`)) return;

    try {
      await apiClient.delete(`/hms/rooms/${roomId}/`);
      fetchRooms(selectedHostelId);
    } catch (err: any) {
      console.error('Failed to delete room:', err);
      alert('Failed to delete room: ' + (err.response?.data?.detail || err.message));
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
  const filteredRooms = rooms.filter((r) => {
    if (!selectedFloor || selectedFloor === 'ALL') return true;
    return String(r.floor) === String(selectedFloor);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Room Matrix & Bed Allocation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visualize room occupancy, bed slots, and residential allocations per floor</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleOpenAddSingleRoom}
            className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-[#0D3833] text-white text-xs sm:text-sm font-semibold hover:bg-[#064E3B] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Room</span>
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Bulk Generate</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1">
          {/* Block Selector Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1 max-w-md">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Select Block:</span>
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
                <SelectTrigger className="w-full">
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

          {/* Floor Selector Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:w-64">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Floor:</span>
            <div className="flex-1">
              <Select
                value={selectedFloor}
                onValueChange={(val) => setSelectedFloor(val)}
                disabled={!selectedHostelId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select floor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Floors</SelectItem>
                  {floors.map((f) => (
                    <SelectItem key={f} value={String(f)}>
                      {f === 0 ? 'Ground Floor' : `Floor ${f}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          {selectedHostelId && selectedFloor && (
            <span className="px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700">
              {filteredRooms.length} {filteredRooms.length === 1 ? 'Room' : 'Rooms'} Shown
            </span>
          )}
        </div>
      </div>

      {!selectedHostelId ? (
        <div className="bg-white p-14 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-3xl bg-[#D1F2EA] text-teal-950 flex items-center justify-center mx-auto shadow-inner">
            <Building2 className="w-8 h-8 text-[#0D3833]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Select a Hostel Block</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Please choose a hostel block and floor from the dropdowns above to view room matrices, bed occupancies, and resident distributions.
            </p>
          </div>
        </div>
      ) : !selectedFloor ? (
        <div className="bg-white p-14 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-3xl bg-[#D1F2EA] text-teal-950 flex items-center justify-center mx-auto shadow-inner">
            <Layers className="w-8 h-8 text-[#0D3833]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Select a Floor</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Please choose a floor (or "All Floors") from the floor dropdown to view the room cards and bed slots.
            </p>
          </div>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-3xl bg-[#D1F2EA] text-teal-950 flex items-center justify-center mx-auto shadow-inner">
            <BedDouble className="w-8 h-8 text-[#0D3833]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">No Rooms Configured for this Block</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              There are currently no room allocations setup for the selected floor or hostel block. Create a room manually or generate slots in bulk.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleOpenAddSingleRoom}
              className="px-6 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Single Room</span>
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-6 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-slate-500" />
              <span>Bulk Generate</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredRooms.map((room) => {
            const isFull = room.occupied_count >= room.capacity;
            const isPartiallyOccupied = room.occupied_count > 0 && !isFull;

            return (
              <div
                key={room.id}
                onClick={() => handleViewRoom(room)}
                className={`group p-4 rounded-3xl border transition-all cursor-pointer relative overflow-hidden hover:shadow-md ${
                  isFull
                    ? 'bg-rose-50/60 border-rose-200 hover:border-rose-400'
                    : isPartiallyOccupied
                    ? 'bg-amber-50/60 border-amber-200 hover:border-amber-400'
                    : 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-400'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">
                    {room.floor === 0 ? 'GF' : `Fl ${room.floor}`}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isFull ? 'bg-rose-100 text-rose-800' : isPartiallyOccupied ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isFull ? 'FULL' : isPartiallyOccupied ? 'PARTIAL' : 'VACANT'}
                    </span>

                    {/* Edit Room Quick Icon Button */}
                    <button
                      onClick={(e) => handleOpenEditRoom(e, room)}
                      className="p-1 rounded-lg bg-white/80 hover:bg-white text-slate-500 hover:text-[#0D3833] transition-colors border border-slate-200 shadow-2xs cursor-pointer opacity-90 group-hover:opacity-100"
                      title="Edit Room Details"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
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
      )}

      {/* Edit Room Modal Popup */}
      {showEditRoomModal && editingRoom && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#D1F2EA] text-[#0D3833] flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">Edit Room {editingRoom.no}</h3>
                  <p className="text-xs text-slate-400">Update room configuration, floor, or bed slots</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditRoomModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hostel Block</label>
                <Select value={editHostelId} onValueChange={setEditHostelId}>
                  <SelectTrigger className="w-full bg-slate-50">
                    <SelectValue placeholder="Select hostel" />
                  </SelectTrigger>
                  <SelectContent>
                    {hostels.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Floor</label>
                  <Select value={editFloor} onValueChange={setEditFloor}>
                    <SelectTrigger className="w-full bg-slate-50">
                      <SelectValue placeholder="Select floor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Ground Floor</SelectItem>
                      <SelectItem value="1">1st Floor</SelectItem>
                      <SelectItem value="2">2nd Floor</SelectItem>
                      <SelectItem value="3">3rd Floor</SelectItem>
                      <SelectItem value="4">4th Floor</SelectItem>
                      <SelectItem value="5">5th Floor</SelectItem>
                      <SelectItem value="6">6th Floor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Room Number</label>
                  <input
                    type="text"
                    required
                    value={editRoomNo}
                    onChange={(e) => setEditRoomNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Room Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deluxe Suite"
                  value={editRoomName}
                  onChange={(e) => setEditRoomName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Room Type</label>
                  <Select value={editRoomType} onValueChange={handleEditRoomTypeChange}>
                    <SelectTrigger className="w-full bg-slate-50">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S">Single</SelectItem>
                      <SelectItem value="D">Double</SelectItem>
                      <SelectItem value="T">Triple</SelectItem>
                      <SelectItem value="P">Scholar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bed Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={(e) => handleDeleteRoom(e, editingRoom.id, editingRoom.no || '')}
                  className="px-3.5 py-2 rounded-full border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditRoomModal(false)}
                    className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEdit}
                    className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Occupants Centered Modal Popup */}
      {showOccupantsDrawer && selectedRoom && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200/80 shadow-2xl p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#D1F2EA] text-teal-950 flex items-center justify-center font-bold shadow-xs">
                  <BedDouble className="w-6 h-6 text-[#0D3833]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Room {selectedRoom.no}</h3>
                  <p className="text-xs text-slate-500">
                    {selectedRoom.hostel_name || 'Hostel Block'} · {selectedRoom.floor === 0 ? 'Ground Floor' : `Floor ${selectedRoom.floor}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOccupantsDrawer(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Room Info Cards */}
            <div className="grid grid-cols-2 gap-3 my-5">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="block text-[11px] font-medium text-slate-400">Room Category</span>
                <span className="text-sm font-bold text-slate-800">{selectedRoom.room_type_display || 'Standard'}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="block text-[11px] font-medium text-slate-400">Total Capacity</span>
                <span className="text-sm font-bold text-slate-800">{selectedRoom.capacity} Beds</span>
              </div>
            </div>

            {/* Current Occupants List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Current Occupants ({selectedRoom.occupants?.length || 0} / {selectedRoom.capacity})
                </h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  (selectedRoom.occupants?.length || 0) >= selectedRoom.capacity ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {(selectedRoom.occupants?.length || 0) >= selectedRoom.capacity ? 'No Vacancy' : `${selectedRoom.capacity - (selectedRoom.occupants?.length || 0)} Beds Open`}
                </span>
              </div>

              {selectedRoom.occupants && selectedRoom.occupants.length > 0 ? (
                <div className="space-y-2.5">
                  {selectedRoom.occupants.map((occ) => (
                    <div
                      key={occ.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                          {occ.student_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{occ.student_name}</div>
                          <div className="text-xs text-slate-400 font-mono">{occ.enrollment_no}</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        {occ.course_name || 'Enrolled'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400">No students currently assigned to this room.</p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={(e) => handleOpenEditRoom(e, selectedRoom)}
                className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Pencil className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Room Configuration</span>
              </button>

              <button
                type="button"
                onClick={() => setShowOccupantsDrawer(false)}
                className="px-6 py-2.5 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] transition-colors cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Single Room Modal Popup */}
      {showSingleRoomModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#D1F2EA] text-[#0D3833] flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">Add Room</h3>
                  <p className="text-xs text-slate-400">Configure a single room slot in the hostel</p>
                </div>
              </div>
              <button
                onClick={() => setShowSingleRoomModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSingleRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hostel</label>
                <Select value={singleHostelId} onValueChange={setSingleHostelId}>
                  <SelectTrigger className="w-full bg-slate-50">
                    <SelectValue placeholder="Select hostel" />
                  </SelectTrigger>
                  <SelectContent>
                    {hostels.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Floor</label>
                  <Select value={singleFloor} onValueChange={setSingleFloor}>
                    <SelectTrigger className="w-full bg-slate-50">
                      <SelectValue placeholder="Select floor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Ground Floor</SelectItem>
                      <SelectItem value="1">1st Floor</SelectItem>
                      <SelectItem value="2">2nd Floor</SelectItem>
                      <SelectItem value="3">3rd Floor</SelectItem>
                      <SelectItem value="4">4th Floor</SelectItem>
                      <SelectItem value="5">5th Floor</SelectItem>
                      <SelectItem value="6">6th Floor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Room Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 101, G02"
                    value={singleRoomNo}
                    onChange={(e) => setSingleRoomNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Room Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deluxe Room 101"
                  value={singleRoomName}
                  onChange={(e) => setSingleRoomName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Room Type</label>
                  <Select value={singleRoomType} onValueChange={handleSingleRoomTypeChange}>
                    <SelectTrigger className="w-full bg-slate-50">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S">Single</SelectItem>
                      <SelectItem value="D">Double</SelectItem>
                      <SelectItem value="T">Triple</SelectItem>
                      <SelectItem value="P">Scholar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bed Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={singleCapacity}
                    onChange={(e) => setSingleCapacity(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSingleRoomModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSingle}
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingSingle ? 'Adding...' : 'Add Room'}
                </button>
              </div>
            </form>
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
