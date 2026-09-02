import React, { useEffect, useState } from 'react';
import { Search, Plus, Trash2 } from 'lucide-react';
import type { HostelOutsideStudent, Hostel, HostelRoom } from '../../types';
import { apiClient } from '../../api/apiClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const OutsideStudentManagement: React.FC = () => {
  const [students, setStudents] = useState<HostelOutsideStudent[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [usn, setUsn] = useState('');
  const [college, setCollege] = useState('');
  const [course, setCourse] = useState('');
  const [phone, setPhone] = useState('');
  const [hostelId, setHostelId] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('none');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (hostelId) {
      apiClient.get<HostelRoom[]>(`/hms/rooms/?hostel=${hostelId}`).then((res) => {
        setRooms(res.data.filter((r) => r.vacant || r.occupied_count < r.capacity));
      });
    }
  }, [hostelId]);

  const fetchData = async () => {
    try {
      const [studentsRes, hostelsRes] = await Promise.all([
        apiClient.get<HostelOutsideStudent[]>('/student/outside-students/'),
        apiClient.get<Hostel[]>('/hms/hostels/'),
      ]);
      setStudents(studentsRes.data);
      setHostels(hostelsRes.data);
      if (hostelsRes.data.length > 0) setHostelId(String(hostelsRes.data[0].id));
    } catch (err) {
      console.error('Failed to load outside students data', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/student/outside-students/', {
        name,
        usn,
        outside_college_name: college,
        outside_course_name: course,
        phone,
        gender: 'M',
        hostel: hostelId ? Number(hostelId) : null,
        room: roomId !== 'none' ? Number(roomId) : null,
        room_allotted: roomId !== 'none',
      });
      setShowModal(false);
      setName('');
      setUsn('');
      setCollege('');
      setCourse('');
      setPhone('');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.usn?.[0] || 'Failed to register outside resident');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this outside resident record?')) return;
    try {
      await apiClient.delete(`/student/outside-students/${id}/`);
      fetchData();
    } catch (err) {
      alert('Failed to delete outside student');
    }
  };

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.usn.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.outside_college_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Outside & Guest Residents</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage non-institutional students, interns, and researchers staying in hostel guest rooms</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-full bg-[#0D3833] text-white text-sm font-semibold hover:bg-[#064E3B] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register Outside Student</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name, college, or ID..."
            className="w-full bg-slate-50 pl-10 pr-4 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pl-6">Student</th>
                <th className="py-3.5 px-4">College / University</th>
                <th className="py-3.5 px-4">Course</th>
                <th className="py-3.5 px-4">Contact Phone</th>
                <th className="py-3.5 px-4">Allotted Room</th>
                <th className="py-3.5 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No outside students registered yet.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 pl-6 font-semibold text-slate-800">
                      <div>{s.name}</div>
                      <div className="text-[11px] font-normal text-slate-400">ID: {s.usn}</div>
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-slate-700">
                      {s.outside_college_name}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600">
                      {s.outside_course_name}
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-700">
                      {s.phone}
                    </td>
                    <td className="py-4 px-4 text-xs">
                      {s.room ? (
                        <span className="font-bold text-slate-800">Room {s.room_no || 'Guest'}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-4 pr-6 text-right">
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded-full hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Register Outside Student</h3>
            <p className="text-xs text-slate-500 mb-5">Enter academic institution details and assign a guest bed.</p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Henderson"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">USN / Roll No</label>
                  <input
                    type="text"
                    required
                    value={usn}
                    onChange={(e) => setUsn(e.target.value)}
                    placeholder="e.g. GUEST-2026"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">College / University Name</label>
                <input
                  type="text"
                  required
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="e.g. National Institute of Design"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course / Research Area</label>
                <input
                  type="text"
                  required
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g. Summer Research Internship"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Hostel</label>
                  <Select value={hostelId} onValueChange={setHostelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose hostel" />
                    </SelectTrigger>
                    <SelectContent>
                      {hostels.map((h) => (
                        <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Room</label>
                  <Select value={roomId} onValueChange={setRoomId}>
                    <SelectTrigger>
                      <SelectValue placeholder="-- Assign Later --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Assign Later --</SelectItem>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.name} (Floor {r.floor})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer"
                >
                  Register Resident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
