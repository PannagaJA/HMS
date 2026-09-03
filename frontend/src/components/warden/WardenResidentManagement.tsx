import React, { useEffect, useState } from 'react';
import {
  Search,
  Eye,
  X,
  Building2
} from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import type { Hostel, HostelStudent } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { wardenService } from '../../services/wardenService';
import { useDebounce } from '../../hooks/useDebounce';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const WardenResidentManagement: React.FC = () => {
  const { user } = useAuth();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('ALL');
  const [residents, setResidents] = useState<HostelStudent[]>([]);
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<HostelStudent | null>(null);

  useEffect(() => {
    loadAssignedHostels();
  }, [user]);

  const loadAssignedHostels = async () => {
    try {
      const assigned = await wardenService.getAssignedHostels(user?.id);
      setHostels(assigned);
      if (assigned.length === 1) {
        setSelectedHostelId(String(assigned[0].id));
      } else if (assigned.length > 1) {
        setSelectedHostelId('ALL');
      }
    } catch (e) {
      console.error('Failed to load assigned hostels', e);
    }
  };

  useEffect(() => {
    fetchResidents();
  }, [floorFilter, selectedHostelId]);

  const fetchResidents = async () => {
    try {
      const params = new URLSearchParams();
      if (floorFilter && floorFilter !== 'all') {
        params.set('floor', floorFilter);
      }
      if (selectedHostelId && selectedHostelId !== 'ALL') {
        params.set('hostel_id', selectedHostelId);
      }
      const qs = params.toString();
      const url = qs ? `/warden/students/?${qs}` : '/warden/students/';
      const res = await apiClient.get<HostelStudent[]>(url);
      setResidents(res.data || []);
    } catch (err) {
      console.error('Failed to load residents', err);
    }
  };

  const debouncedSearch = useDebounce(search, 300);

  const currentHostel = hostels.find((h) => String(h.id) === selectedHostelId);
  const assignedIds = hostels.map((h) => String(h.id));

  const filteredResidents = residents.filter((st) => {
    if (selectedHostelId !== 'ALL') {
      const stHostelId = String(st.hostel || (st.room_detail as any)?.hostel_id || '');
      if (stHostelId !== selectedHostelId) return false;
    } else if (hostels.length > 0) {
      const stHostelId = String(st.hostel || (st.room_detail as any)?.hostel_id || '');
      if (!assignedIds.includes(stHostelId)) return false;
    }

    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    const roomNo = (st.room_detail?.no || st.room_no || st.room_number || '').toLowerCase();
    const hostelName = (st.hostel_name || '').toLowerCase();
    return (
      st.student_name.toLowerCase().includes(q) ||
      st.enrollment_no.toLowerCase().includes(q) ||
      roomNo.includes(q) ||
      hostelName.includes(q) ||
      (st.guardian_phone && st.guardian_phone.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Residents Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">View and manage resident students allotted in your block</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {hostels.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Hostel:</span>
              </span>
              <div className="w-56">
                <Select
                  value={selectedHostelId}
                  onValueChange={(val) => {
                    setSelectedHostelId(val);
                    setFloorFilter('all');
                  }}
                >
                  <SelectTrigger className="h-9 rounded-full bg-white text-xs font-semibold shadow-xs border-slate-200">
                    <SelectValue placeholder="Select Hostel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All My Assigned Hostels</SelectItem>
                    {hostels.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>
                        {h.name} ({h.gender})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
            {filteredResidents.length} Active Residents
          </div>
        </div>
      </div>

      {/* Search & Floor Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student name, USN / ID, room number, or guardian phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white pl-10 pr-4 py-2.5 rounded-full text-xs border border-slate-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
          />
        </div>

        <div className="w-full sm:w-[170px]">
          <Select value={floorFilter} onValueChange={setFloorFilter}>
            <SelectTrigger className="w-full bg-white border-slate-200 text-xs font-semibold text-slate-800">
              <SelectValue placeholder="Select Floor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All Floors {currentHostel ? `(${currentHostel.floor_count || (currentHostel as any).floors || 4} Floors)` : ''}
              </SelectItem>
              {Array.from(
                { length: currentHostel ? (currentHostel.floor_count || (currentHostel as any).floors || 4) : 4 },
                (_, i) => i + 1
              ).map((fl) => (
                <SelectItem key={fl} value={String(fl)}>
                  Floor {fl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resident Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredResidents.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 text-xs">
            No resident students found matching the criteria.
          </div>
        ) : (
          filteredResidents.map((st) => {
            const roomNo = st.room_detail?.no || st.room_no || st.room_number || 'N/A';
            return (
              <div
                key={st.id}
                className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0D3833] text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        {st.student_name[0]}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">{st.student_name}</h4>
                        <p className="text-[11px] text-slate-400 font-medium">{st.enrollment_no}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Room {roomNo}
                      </span>
                      {st.hostel_name && (
                        <span className="text-[9px] font-semibold text-slate-500 truncate max-w-[120px]">
                          {st.hostel_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1.5 text-xs text-slate-600 mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Gender & Bed:</span>
                      <span className="font-semibold text-slate-800">{st.gender} · Bed {st.bed_number || '1'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Guardian Phone:</span>
                      <span className="font-semibold text-slate-800">{st.guardian_phone || 'Not recorded'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Emergency Contact:</span>
                      <span className="font-semibold text-slate-800">{st.emergency_contact || 'None'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedStudent(st)}
                  className="w-full py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> View Resident Profile
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Resident Details Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#0D3833] text-white font-bold flex items-center justify-center text-lg shadow-xs">
                  {selectedStudent.student_name[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedStudent.student_name}</h3>
                  <p className="text-xs text-slate-400">{selectedStudent.enrollment_no} · {selectedStudent.gender}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Room & Bed</span>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    Room {selectedStudent.room_detail?.no || selectedStudent.room_no || '101'} (Bed {selectedStudent.bed_number || '1'})
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Dues Clearance</span>
                  <p className="text-sm font-bold text-emerald-700 mt-0.5">{selectedStudent.no_dues !== false ? 'Clear (No Dues)' : 'Pending Bills'}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Emergency & Parent Contact Info</h4>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Father / Guardian Name:</span>
                  <span className="font-semibold text-slate-800">{selectedStudent.father_name || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Primary Guardian Mobile:</span>
                  <span className="font-semibold text-slate-800">{selectedStudent.guardian_phone || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Emergency Phone:</span>
                  <span className="font-semibold text-rose-700">{selectedStudent.emergency_contact || 'N/A'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedStudent(null)}
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
