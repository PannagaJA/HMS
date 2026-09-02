import React, { useEffect, useState } from 'react';
import { Search, Download } from 'lucide-react';
import type { HostelStudent, Hostel, HostelRoom } from '../../types';
import { apiClient } from '../../api/apiClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<HostelStudent[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAllotted, setFilterAllotted] = useState<'ALL' | 'ALLOTTED' | 'UNALLOTTED'>('ALL');
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<HostelStudent | null>(null);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [bedNo, setBedNo] = useState('1');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedHostelId) {
      apiClient.get<HostelRoom[]>(`/hms/rooms/?hostel=${selectedHostelId}`).then((res) => {
        setRooms(res.data.filter((r: HostelRoom) => r.vacant || (r.occupied_count ?? 0) < r.capacity));
      });
    }
  }, [selectedHostelId]);

  const fetchData = async () => {
    try {
      const [studentsRes, hostelsRes] = await Promise.all([
        apiClient.get<HostelStudent[]>('/hms/students/'),
        apiClient.get<Hostel[]>('/hms/hostels/'),
      ]);
      setStudents(studentsRes.data);
      setHostels(hostelsRes.data);
    } catch (err) {
      console.error('Failed to load students data', err);
    }
  };

  const handleOpenAllocate = (student: HostelStudent) => {
    setSelectedStudent(student);
    const initialHostel = hostels[0]?.id ? String(hostels[0].id) : '';
    setSelectedHostelId(initialHostel);
    setSelectedRoomId('');
    setBedNo('1');
    setShowAllocateModal(true);
  };

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedRoomId) return;

    try {
      await apiClient.post('/hms/students/allocate_room/', {
        student_id: selectedStudent.id,
        room_id: Number(selectedRoomId),
        bed_number: bedNo,
      });
      setShowAllocateModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to allocate room');
    }
  };

  const handleVacate = async (studentId: number) => {
    if (!confirm('Are you sure you want to vacate this student from their assigned room?')) return;
    try {
      await apiClient.post(`/hms/students/${studentId}/vacate_room/`);
      fetchData();
    } catch (err) {
      alert('Failed to vacate student');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.enrollment_no.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterAllotted === 'ALLOTTED') return matchesSearch && s.room_allotted;
    if (filterAllotted === 'UNALLOTTED') return matchesSearch && !s.room_allotted;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Resident Directory</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage student enrollments, room allotments, and resident records</p>
        </div>
        <button
          onClick={handleExportPDF}
          className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Resident Roster</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name or USN..."
            className="w-full bg-slate-50 pl-10 pr-4 py-2.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(['ALL', 'ALLOTTED', 'UNALLOTTED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterAllotted(tab)}
              className={`flex-1 sm:flex-initial text-center px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filterAllotted === tab
                  ? 'bg-[#0D3833] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'ALL' ? 'All Students' : tab === 'ALLOTTED' ? 'Room Allotted' : 'Unallotted'}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Card View (< 768px) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredStudents.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl border border-slate-200/80 text-center text-slate-400 text-sm">
            No resident students found.
          </div>
        ) : (
          filteredStudents.map((s) => (
            <div
              key={s.id}
              className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#E8F8CE] text-emerald-950 font-bold flex items-center justify-center text-xs shadow-2xs">
                    {s.student_name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{s.student_name}</h3>
                    <div className="text-xs font-mono text-slate-500">{s.enrollment_no}</div>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  s.gender === 'M' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {s.gender === 'M' ? 'Male' : 'Female'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="block text-[10px] font-semibold text-slate-400 uppercase">Room Allocation</span>
                  {s.room_allotted && s.room_detail ? (
                    <div className="mt-0.5">
                      <span className="font-bold text-slate-800">{s.hostel_name || 'Block A'}</span>
                      <div className="text-slate-500 font-medium">Room {s.room_detail.no} (Bed {s.bed_number || '1'})</div>
                    </div>
                  ) : (
                    <span className="text-amber-600 font-semibold mt-0.5 block">Unallocated</span>
                  )}
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="block text-[10px] font-semibold text-slate-400 uppercase">Guardian Contact</span>
                  <span className="font-mono text-slate-700 mt-0.5 block truncate">
                    {s.guardian_phone || s.emergency_contact || 'N/A'}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">Father: {s.father_name || 'N/A'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                  s.room_allotted
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {s.room_allotted ? 'RESIDENT' : 'PENDING'}
                </span>

                <div>
                  {s.room_allotted ? (
                    <button
                      onClick={() => handleVacate(s.id)}
                      className="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-3.5 py-1.5 rounded-full border border-rose-200 transition-colors cursor-pointer"
                    >
                      Vacate Bed
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenAllocate(s)}
                      className="text-xs font-semibold text-teal-900 bg-[#D1F2EA] px-4 py-1.5 rounded-full hover:bg-teal-200 transition-colors shadow-2xs cursor-pointer"
                    >
                      Allocate Room
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (>= 768px) */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 pl-6">Student</th>
                <th className="py-3.5 px-4">USN / Enrollment</th>
                <th className="py-3.5 px-4">Gender</th>
                <th className="py-3.5 px-4">Hostel & Room</th>
                <th className="py-3.5 px-4">Guardian Contact</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No resident students found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 pl-6 font-semibold text-slate-800 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#E8F8CE] text-emerald-950 font-bold flex items-center justify-center text-xs">
                        {s.student_name[0]}
                      </div>
                      <div>
                        <div>{s.student_name}</div>
                        <div className="text-[11px] font-normal text-slate-400">Father: {s.father_name || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-slate-700 font-semibold">
                      {s.enrollment_no}
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold">
                      <span className={`px-2 py-0.5 rounded-full ${s.gender === 'M' ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'}`}>
                        {s.gender === 'M' ? 'Male' : 'Female'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs">
                      {s.room_allotted && s.room_detail ? (
                        <div>
                          <span className="font-bold text-slate-800">{s.hostel_name || 'Block A'}</span>
                          <div className="text-slate-400">Room {s.room_detail.no} (Bed {s.bed_number || '1'})</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No Room Allotted</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600">
                      {s.guardian_phone || s.emergency_contact || 'N/A'}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        s.room_allotted
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {s.room_allotted ? 'RESIDENT' : 'PENDING ALLOTMENT'}
                      </span>
                    </td>
                    <td className="py-4 pr-6 text-right">
                      {s.room_allotted ? (
                        <button
                          onClick={() => handleVacate(s.id)}
                          className="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                        >
                          Vacate Bed
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenAllocate(s)}
                          className="text-xs font-semibold text-teal-800 bg-[#D1F2EA] px-3.5 py-1.5 rounded-full hover:bg-teal-200 transition-colors shadow-sm cursor-pointer"
                        >
                          Allocate Room
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAllocateModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Allocate Bed to Resident</h3>
            <p className="text-xs text-slate-500 mb-5">
              Assigning room for: <strong className="text-slate-800">{selectedStudent.student_name}</strong> ({selectedStudent.enrollment_no})
            </p>

            <form onSubmit={handleAllocateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Hostel Block</label>
                <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Vacant Room</label>
                <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Choose Available Room --" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name} (Floor {r.floor} · {r.occupied_count}/{r.capacity} Occupied)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bed Number</label>
                <Select value={bedNo} onValueChange={setBedNo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Bed" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Bed 1</SelectItem>
                    <SelectItem value="2">Bed 2</SelectItem>
                    <SelectItem value="3">Bed 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer"
                >
                  Confirm Allotment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
