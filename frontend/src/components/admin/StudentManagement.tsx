import React, { useEffect, useState, useRef } from 'react';
import { Search, Download, UserPlus, UploadCloud, FileText, CheckCircle2, AlertTriangle, X, Check } from 'lucide-react';
import type { HostelStudent, Hostel, HostelRoom } from '../../types';
import { apiClient } from '../../api/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { useDebounce } from '../../hooks/useDebounce';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface ParsedStudentRow {
  student_name: string;
  enrollment_no: string;
  gender: 'M' | 'F';
  phone?: string;
  father_name?: string;
  guardian_phone?: string;
  emergency_contact?: string;
  isValid: boolean;
  errorReason?: string;
}

export const StudentManagement: React.FC = () => {
  const { showSuccess, showError, confirm } = useNotification();
  const [students, setStudents] = useState<HostelStudent[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAllotted, setFilterAllotted] = useState<'ALL' | 'ALLOTTED' | 'UNALLOTTED'>('ALL');
  
  // Allocate Modal State
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<HostelStudent | null>(null);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [bedNo, setBedNo] = useState('1');

  // Single Student Admission Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [addName, setAddName] = useState('');
  const [addUsn, setAddUsn] = useState('');
  const [addGender, setAddGender] = useState<'M' | 'F'>('M');
  const [addPhone, setAddPhone] = useState('');
  const [addFatherName, setAddFatherName] = useState('');
  const [addGuardianPhone, setAddGuardianPhone] = useState('');
  const [addEmergencyContact, setAddEmergencyContact] = useState('');
  const [addAllotDirectly, setAddAllotDirectly] = useState(false);
  const [addHostelId, setAddHostelId] = useState('');
  const [addRoomId, setAddRoomId] = useState('');
  const [addBedNo, setAddBedNo] = useState('1');
  const [addAvailableRooms, setAddAvailableRooms] = useState<HostelRoom[]>([]);

  // Bulk Import Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sRes, hRes] = await Promise.all([
        apiClient.get<HostelStudent[]>('/hms/students/'),
        apiClient.get<Hostel[]>('/hms/hostels/'),
      ]);
      setStudents(sRes.data || []);
      setHostels(hRes.data || []);
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  };

  const handleOpenAllocate = async (student: HostelStudent) => {
    setSelectedStudent(student);
    setSelectedHostelId('');
    setSelectedRoomId('');
    setRooms([]);
    setShowAllocateModal(true);
  };

  const handleHostelChange = async (hostelId: string) => {
    setSelectedHostelId(hostelId);
    setSelectedRoomId('');
    if (hostelId) {
      try {
        const res = await apiClient.get<HostelRoom[]>(`/hms/hostels/${hostelId}/rooms/`);
        setRooms(res.data.filter((r) => r.vacant));
      } catch (err) {
        console.error('Failed to fetch rooms', err);
      }
    } else {
      setRooms([]);
    }
  };

  const handleAddHostelChange = async (hostelId: string) => {
    setAddHostelId(hostelId);
    setAddRoomId('');
    if (hostelId) {
      try {
        const res = await apiClient.get<HostelRoom[]>(`/hms/hostels/${hostelId}/rooms/`);
        setAddAvailableRooms(res.data.filter((r) => r.vacant));
      } catch (err) {
        console.error('Failed to fetch available rooms', err);
      }
    } else {
      setAddAvailableRooms([]);
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedRoomId) return;

    try {
      await apiClient.post('/hms/students/allocate_room/', {
        student_id: selectedStudent.id,
        room_id: Number(selectedRoomId),
        bed_number: bedNo,
      });
      showSuccess(`Room allocated successfully to ${selectedStudent.student_name}.`);
      setShowAllocateModal(false);
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to allocate room');
    }
  };

  const handleVacate = async (studentId: number) => {
    const isConfirmed = await confirm({
      title: 'Vacate Resident',
      message: 'Are you sure you want to vacate this student from their assigned room? This will release their physical bed slot.',
      confirmText: 'Vacate Room',
      isDestructive: true
    });
    if (!isConfirmed) return;

    try {
      await apiClient.post(`/hms/students/${studentId}/vacate_room/`);
      showSuccess('Student room vacated successfully.');
      fetchData();
    } catch (err) {
      showError('Failed to vacate student');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleOpenAddStudent = () => {
    setAddName('');
    setAddUsn('');
    setAddGender('M');
    setAddPhone('');
    setAddFatherName('');
    setAddGuardianPhone('');
    setAddEmergencyContact('');
    setAddAllotDirectly(false);
    setAddHostelId('');
    setAddRoomId('');
    setAddBedNo('1');
    setAddAvailableRooms([]);
    setShowAddModal(true);
  };

  const handleSingleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addUsn.trim()) {
      showError('Please provide both Student Name and USN / Enrollment number.');
      return;
    }

    setIsSubmittingSingle(true);
    try {
      await apiClient.post('/hms/students/create/', {
        student_name: addName.trim(),
        enrollment_no: addUsn.trim().toUpperCase(),
        gender: addGender,
        phone: addPhone.trim(),
        father_name: addFatherName.trim(),
        guardian_phone: addGuardianPhone.trim(),
        emergency_contact: addEmergencyContact.trim(),
        room_id: addAllotDirectly && addRoomId ? Number(addRoomId) : undefined,
        bed_number: addAllotDirectly && addRoomId ? addBedNo : undefined
      });

      showSuccess(`Student resident "${addName}" registered successfully.`);
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      console.error('Failed to add student:', err);
      showError(err.message || 'Failed to register student resident.');
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (csvContent: string) => {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) {
      setParsedRows([]);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]+/g, ''));
    const rows: ParsedStudentRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i];
      if (!currentLine.trim()) continue;

      const values = currentLine.split(',').map(v => v.trim().replace(/['"]+/g, ''));
      const rowObj: any = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] || '';
      });

      const studentName = rowObj.student_name || rowObj.name || values[0] || '';
      const enrollmentNo = rowObj.enrollment_no || rowObj.usn || rowObj.roll_no || values[1] || '';
      const rawGender = (rowObj.gender || values[2] || 'M').toUpperCase();
      const gender: 'M' | 'F' = rawGender.startsWith('F') ? 'F' : 'M';
      const phone = rowObj.phone || rowObj.mobile || values[3] || '';
      const fatherName = rowObj.father_name || values[4] || '';
      const guardianPhone = rowObj.guardian_phone || values[5] || '';
      const emergencyContact = rowObj.emergency_contact || values[6] || '';

      const isValid = Boolean(studentName && enrollmentNo);
      const errorReason = !studentName ? 'Missing Name' : !enrollmentNo ? 'Missing USN' : undefined;

      rows.push({
        student_name: studentName,
        enrollment_no: enrollmentNo.toUpperCase(),
        gender,
        phone,
        father_name: fatherName,
        guardian_phone: guardianPhone,
        emergency_contact: emergencyContact,
        isValid,
        errorReason
      });
    }

    setParsedRows(rows);
  };

  const handleDownloadSampleCSV = () => {
    const sampleHeaders = 'student_name,enrollment_no,gender,phone,father_name,guardian_phone,emergency_contact\n';
    const sampleRows = 'Arjun Sharma,1AM23CS001,M,9876543210,Ramesh Sharma,9876543211,9876543212\nPriya Patel,1AM23EC042,F,9812345678,Suresh Patel,9812345679,9812345680\n';
    const blob = new Blob([sampleHeaders + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'hms_student_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCommitBulkImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      showError('No valid student rows found in the uploaded file to import.');
      return;
    }

    setIsImporting(true);
    try {
      await apiClient.post('/hms/students/bulk/', {
        students: validRows.map(r => ({
          student_name: r.student_name,
          enrollment_no: r.enrollment_no,
          gender: r.gender,
          phone: r.phone,
          father_name: r.father_name,
          guardian_phone: r.guardian_phone,
          emergency_contact: r.emergency_contact
        }))
      });

      showSuccess(`Successfully imported ${validRows.length} students into the Resident Directory.`);
      setShowBulkModal(false);
      setBulkFile(null);
      setParsedRows([]);
      fetchData();
    } catch (err: any) {
      console.error('Bulk import failed:', err);
      showError(err.message || 'Failed to import student records.');
    } finally {
      setIsImporting(false);
    }
  };

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.student_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                          s.enrollment_no.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    if (filterAllotted === 'ALLOTTED') return matchesSearch && s.room_allotted;
    if (filterAllotted === 'UNALLOTTED') return matchesSearch && !s.room_allotted;
    return matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12 sm:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Resident Directory</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage student enrollments, room allotments, and resident records</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenAddStudent}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </button>

          <button
            onClick={() => {
              setBulkFile(null);
              setParsedRows([]);
              setShowBulkModal(true);
            }}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#0B1437] text-xs font-semibold hover:bg-emerald-100 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <UploadCloud className="w-4 h-4 text-emerald-700" />
            <span>Bulk Import CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Roster</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name or USN..."
            className="w-full bg-slate-50 pl-10 pr-4 py-2.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(['ALL', 'ALLOTTED', 'UNALLOTTED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterAllotted(tab)}
              className={`flex-1 sm:flex-initial text-center px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filterAllotted === tab
                  ? 'bg-[#0B1437] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab === 'ALL' ? `All Residents (${students.length})` : tab === 'ALLOTTED' ? `Allotted (${students.filter(s => s.room_allotted).length})` : `Unallotted (${students.filter(s => !s.room_allotted).length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
        {/* Mobile View: Cards */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No resident students match your criteria.
            </div>
          ) : (
            filteredStudents.map((s) => (
              <div key={s.id} className="p-4 space-y-3 hover:bg-slate-50/70 transition-colors">
                {/* Header: Student Name, Avatar, Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-teal-950 font-bold flex items-center justify-center text-sm shrink-0 border border-teal-200">
                      {s.student_name?.[0] || 'S'}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-snug">{s.student_name}</h4>
                      {s.father_name && (
                        <p className="text-xs text-slate-400">Guardian: {s.father_name}</p>
                      )}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                    s.room_allotted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.room_allotted ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {s.room_allotted ? 'Allotted' : 'Pending'}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">USN / Enrollment</span>
                    <span className="font-mono text-slate-700 font-semibold truncate block mt-0.5">{s.enrollment_no}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Gender</span>
                    <span className="mt-0.5 inline-block">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        s.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {s.gender === 'F' ? 'Female' : 'Male'}
                      </span>
                    </span>
                  </div>
                  <div className="col-span-2 pt-1.5 border-t border-slate-200/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Contact Phone</span>
                    <span className="font-medium text-slate-700 block mt-0.5">{s.phone || 'N/A'}</span>
                  </div>
                  <div className="col-span-2 pt-1.5 border-t border-slate-200/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Room & Bed Slot</span>
                    {s.room_allotted ? (
                      <div className="mt-0.5">
                        <span className="font-semibold text-slate-900 block">{s.hostel_name || 'Block'}</span>
                        <span className="text-xs text-slate-500">Room {s.room_no} · Bed {s.bed_number || '1'}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700 font-medium bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 inline-block mt-0.5">
                        Unassigned Bed
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-1">
                  {s.room_allotted ? (
                    <button
                      onClick={() => handleVacate(s.id)}
                      className="w-full text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 py-2.5 rounded-full transition-colors border border-rose-200 cursor-pointer shadow-2xs"
                    >
                      Vacate Bed
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenAllocate(s)}
                      className="w-full text-xs font-semibold text-teal-900 bg-blue-100 hover:bg-teal-200 py-2.5 rounded-full transition-colors cursor-pointer shadow-2xs"
                    >
                      Allocate Room
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-blue-100/40 text-xs font-bold uppercase text-slate-700 tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Student Details</th>
                <th className="px-6 py-4">USN / Enrollment</th>
                <th className="px-6 py-4">Gender</th>
                <th className="px-6 py-4">Contact Phone</th>
                <th className="px-6 py-4">Room & Bed Slot</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No resident students match your criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{s.student_name}</div>
                      {s.father_name && <div className="text-xs text-slate-400">Guardian: {s.father_name}</div>}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-700">{s.enrollment_no}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        s.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {s.gender === 'F' ? 'Female' : 'Male'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-700">
                      {s.phone || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      {s.room_allotted ? (
                        <div>
                          <span className="font-semibold text-slate-900 block">{s.hostel_name || 'Block'}</span>
                          <span className="text-xs text-slate-500">Room {s.room_no} · Bed {s.bed_number || '1'}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          Unassigned Bed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        s.room_allotted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.room_allotted ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {s.room_allotted ? 'Allotted' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {s.room_allotted ? (
                        <button
                          onClick={() => handleVacate(s.id)}
                          className="text-xs font-semibold text-rose-700 bg-rose-50 px-3.5 py-1.5 rounded-full hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer border border-rose-200"
                        >
                          Vacate Bed
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenAllocate(s)}
                          className="text-xs font-semibold text-teal-900 bg-blue-100 px-4 py-1.5 rounded-full hover:bg-teal-200 transition-colors shadow-2xs cursor-pointer"
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Student Admission & Registration</h3>
                <p className="text-xs text-slate-500 mt-0.5">Enroll a student resident into the hostel directory</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSingleStudentSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    USN / Enrollment No <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addUsn}
                    onChange={(e) => setAddUsn(e.target.value)}
                    placeholder="e.g. 1AM22CS045"
                    className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                  <Select value={addGender} onValueChange={(val: 'M' | 'F') => setAddGender(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male (Boys Hostel)</SelectItem>
                      <SelectItem value="F">Female (Girls Hostel)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Mobile Number</label>
                  <input
                    type="tel"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Father / Guardian Name</label>
                  <input
                    type="text"
                    value={addFatherName}
                    onChange={(e) => setAddFatherName(e.target.value)}
                    placeholder="e.g. Suresh Kumar"
                    className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Guardian Contact Phone</label>
                  <input
                    type="tel"
                    value={addGuardianPhone}
                    onChange={(e) => setAddGuardianPhone(e.target.value)}
                    placeholder="e.g. 9811223344"
                    className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact</label>
                <input
                  type="text"
                  value={addEmergencyContact}
                  onChange={(e) => setAddEmergencyContact(e.target.value)}
                  placeholder="e.g. 9899001122 (Local Guardian / Relative)"
                  className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={addAllotDirectly}
                    onChange={(e) => setAddAllotDirectly(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0B1437] focus:ring-[#0B1437] border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Immediately allocate a hostel room & bed slot upon admission
                  </span>
                </label>
              </div>

              {addAllotDirectly && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hostel Block</label>
                      <Select value={addHostelId} onValueChange={handleAddHostelChange}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Choose block" />
                        </SelectTrigger>
                        <SelectContent>
                          {hostels.map((h) => (
                            <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Available Room</label>
                      <Select value={addRoomId} onValueChange={setAddRoomId}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select room" />
                        </SelectTrigger>
                        <SelectContent>
                          {addAvailableRooms.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              {r.name} ({r.occupied_count}/{r.capacity} occ)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bed Slot</label>
                      <Select value={addBedNo} onValueChange={setAddBedNo}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Bed No" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Bed 1</SelectItem>
                          <SelectItem value="2">Bed 2</SelectItem>
                          <SelectItem value="3">Bed 3</SelectItem>
                          <SelectItem value="4">Bed 4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSingle}
                  className="px-5 py-2 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingSingle ? 'Registering...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-150 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Bulk Import Students (CSV)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Upload a CSV file containing multiple student records</p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 gap-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-slate-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">CSV Template Format</h4>
                    <p className="text-[11px] text-slate-500">Columns: student_name, enrollment_no, gender, phone, father_name, guardian_phone</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadSampleCSV}
                  className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center"
              >
                <UploadCloud className="w-8 h-8 text-emerald-700" />
                <div className="text-xs font-bold text-slate-800">
                  {bulkFile ? bulkFile.name : 'Click to select CSV File or drag and drop here'}
                </div>
                <div className="text-[11px] text-slate-400">Supports standard UTF-8 .csv files</div>
              </div>

              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Parsed Rows Preview ({parsedRows.filter(r => r.isValid).length} valid of {parsedRows.length} total)
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Student Name</th>
                          <th className="px-3 py-2">USN</th>
                          <th className="px-3 py-2">Gender</th>
                          <th className="px-3 py-2">Phone</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedRows.map((r, i) => (
                          <tr key={i} className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                            <td className="px-3 py-1.5">
                              {r.isValid ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] text-rose-600 font-semibold">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {r.errorReason}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 font-medium text-slate-900">{r.student_name || '-'}</td>
                            <td className="px-3 py-1.5 font-mono">{r.enrollment_no || '-'}</td>
                            <td className="px-3 py-1.5">{r.gender === 'F' ? 'Female' : 'Male'}</td>
                            <td className="px-3 py-1.5">{r.phone || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitBulkImport}
                disabled={isImporting || parsedRows.filter(r => r.isValid).length === 0}
                className="px-5 py-2 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {isImporting
                    ? 'Importing Records...'
                    : `Import ${parsedRows.filter(r => r.isValid).length} Students`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showAllocateModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Allocate Bed to Resident</h3>
            <p className="text-xs text-slate-500 mb-5">
              Assigning room for: <strong className="text-slate-800">{selectedStudent.student_name}</strong> ({selectedStudent.enrollment_no})
            </p>

            <form onSubmit={handleAllocate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Hostel Block</label>
                <Select value={selectedHostelId} onValueChange={handleHostelChange}>
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
                    <SelectItem value="4">Bed 4</SelectItem>
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
                  className="px-5 py-2 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-sm cursor-pointer"
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
