import React, { useEffect, useState, useRef } from 'react';
import { Search, Download, UserPlus, UploadCloud, FileText, CheckCircle2, AlertTriangle, X, Check, Building2, Pencil, Mail, Phone, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { HostelStudent, Hostel, HostelRoom } from '../../types';
import { apiClient } from '../../api/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import { wardenService } from '../../services/wardenService';
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
  email?: string;
  gender: 'M' | 'F';
  phone?: string;
  father_name?: string;
  guardian_phone?: string;
  emergency_contact?: string;
  isValid: boolean;
  errorReason?: string;
}

export const StudentManagement: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError, confirm } = useNotification();
  const [students, setStudents] = useState<HostelStudent[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHostelFilter, setSelectedHostelFilter] = useState<string>('');
  const [filterAllotted, setFilterAllotted] = useState<'ALL' | 'ALLOTTED' | 'UNALLOTTED'>('ALL');
  
  // Pagination State (50 items per page by default)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Allocate Modal State
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<HostelStudent | null>(null);
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [allocateFloor, setAllocateFloor] = useState<string>('');
  const [allocateHostelAllRooms, setAllocateHostelAllRooms] = useState<HostelRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [bedNo, setBedNo] = useState('');

  // Edit Student Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsn, setEditUsn] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editGender, setEditGender] = useState<'M' | 'F'>('M');
  const [editPhone, setEditPhone] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editGuardianPhone, setEditGuardianPhone] = useState('');
  const [editEmergencyContact, setEditEmergencyContact] = useState('');

  // Single Student Admission Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [addName, setAddName] = useState('');
  const [addUsn, setAddUsn] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addGender, setAddGender] = useState<'M' | 'F'>('M');
  const [addPhone, setAddPhone] = useState('');
  const [addFatherName, setAddFatherName] = useState('');
  const [addGuardianPhone, setAddGuardianPhone] = useState('');
  const [addEmergencyContact, setAddEmergencyContact] = useState('');
  const [addAllotDirectly, setAddAllotDirectly] = useState(false);
  const [addHostelId, setAddHostelId] = useState('');
  const [addFloor, setAddFloor] = useState('');
  const [addHostelAllRooms, setAddHostelAllRooms] = useState<HostelRoom[]>([]);
  const [addRoomId, setAddRoomId] = useState('');
  const [addBedNo, setAddBedNo] = useState('');

  // Bulk Import Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      let hList: Hostel[] = [];
      let sList: HostelStudent[] = [];

      if (user?.role === 'WARDEN') {
        hList = await wardenService.getAssignedHostels(user?.id);
        const assignedIds = hList.map(h => String(h.id));
        const sRes = await apiClient.get<HostelStudent[]>('/hms/students/');
        sList = (sRes.data || []).filter(st => {
          const stHostelId = String(st.hostel || (st.room_detail as any)?.hostel_id || (st.allocations as any)?.[0]?.bed?.room?.hostel_id || '');
          return !stHostelId || assignedIds.length === 0 || assignedIds.includes(stHostelId);
        });
      } else {
        const [sRes, hRes] = await Promise.all([
          apiClient.get<HostelStudent[]>('/hms/students/'),
          apiClient.get<Hostel[]>('/hms/hostels/'),
        ]);
        sList = sRes.data || [];
        hList = hRes.data || [];
      }

      setStudents(sList);
      setHostels(hList);
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  };

  const handleOpenAllocate = async (student: HostelStudent) => {
    setSelectedStudent(student);
    const initialHostel = student.hostel ? String(student.hostel) : (selectedHostelFilter && selectedHostelFilter !== 'ALL' ? selectedHostelFilter : '');
    setSelectedHostelId(initialHostel);
    setAllocateFloor('');
    setSelectedRoomId('');
    setBedNo('');
    if (initialHostel) {
      handleHostelChange(initialHostel);
    } else {
      setAllocateHostelAllRooms([]);
    }
    setShowAllocateModal(true);
  };

  const handleOpenEdit = (student: HostelStudent) => {
    setEditingStudentId(student.id);
    setEditName(student.student_name || '');
    setEditUsn(student.enrollment_no || '');
    setEditEmail(student.email || '');
    setEditGender(student.gender || 'M');
    setEditPhone(student.phone || '');
    setEditFatherName(student.father_name || '');
    setEditGuardianPhone(student.guardian_phone || '');
    setEditEmergencyContact(student.emergency_contact || '');
    setShowEditModal(true);
  };

  const handleEditStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudentId) return;

    if (!editName.trim() || !editUsn.trim()) {
      showError('Please provide both student name and USN.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (editEmail.trim() && !emailRegex.test(editEmail.trim())) {
      showError('Please enter a valid Email address.');
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (editPhone.trim() && !phoneRegex.test(editPhone.trim())) {
      showError('Please enter a valid 10-digit Student Mobile Number starting with 6-9.');
      return;
    }

    if (editGuardianPhone.trim() && !phoneRegex.test(editGuardianPhone.trim())) {
      showError('Please enter a valid 10-digit Guardian Contact Phone starting with 6-9.');
      return;
    }

    if (editEmergencyContact.trim() && !phoneRegex.test(editEmergencyContact.trim())) {
      showError('Please enter a valid 10-digit Emergency Contact number starting with 6-9.');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      await apiClient.patch(`/hms/students/${editingStudentId}/`, {
        student_name: editName.trim(),
        enrollment_no: editUsn.trim().toUpperCase(),
        email: editEmail.trim() || undefined,
        gender: editGender,
        phone: editPhone.trim(),
        father_name: editFatherName.trim(),
        guardian_phone: editGuardianPhone.trim(),
        emergency_contact: editEmergencyContact.trim()
      });

      showSuccess(`Resident record for "${editName}" updated successfully.`);
      setShowEditModal(false);
      fetchData();
    } catch (err: any) {
      console.error('Failed to update student:', err);
      showError(err.message || 'Failed to update student details.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleHostelChange = async (hostelId: string) => {
    setSelectedHostelId(hostelId);
    setAllocateFloor('');
    setSelectedRoomId('');
    setBedNo('');
    if (hostelId) {
      try {
        const res = await apiClient.get<HostelRoom[]>(`/hms/hostels/${hostelId}/rooms/`);
        setAllocateHostelAllRooms(res.data || []);
      } catch (err) {
        console.error('Failed to fetch rooms', err);
        setAllocateHostelAllRooms([]);
      }
    } else {
      setAllocateHostelAllRooms([]);
    }
  };

  const handleAllocateFloorChange = (floor: string) => {
    setAllocateFloor(floor);
    setSelectedRoomId('');
    setBedNo('');
  };

  const handleAllocateRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    const rm = allocateHostelAllRooms.find((r) => String(r.id) === String(roomId));
    const occupied = new Set((rm?.occupants || []).map((o: any) => String(o.bed_number)));
    const vacantBeds = rm
      ? Array.from({ length: rm.capacity || 1 }, (_, i) => String(i + 1)).filter(
          (b) => !occupied.has(b)
        )
      : [];
    setBedNo(vacantBeds[0] || '');
  };

  const handleAddHostelChange = async (hostelId: string) => {
    setAddHostelId(hostelId);
    setAddFloor('');
    setAddRoomId('');
    setAddBedNo('');
    if (hostelId) {
      try {
        const res = await apiClient.get<HostelRoom[]>(`/hms/hostels/${hostelId}/rooms/`);
        setAddHostelAllRooms(res.data || []);
      } catch (err) {
        console.error('Failed to fetch available rooms', err);
        setAddHostelAllRooms([]);
      }
    } else {
      setAddHostelAllRooms([]);
    }
  };

  const handleAddFloorChange = (floor: string) => {
    setAddFloor(floor);
    setAddRoomId('');
    setAddBedNo('');
  };

  const handleAddRoomChange = (roomId: string) => {
    setAddRoomId(roomId);
    const rm = addHostelAllRooms.find((r) => String(r.id) === String(roomId));
    const occupied = new Set((rm?.occupants || []).map((o: any) => String(o.bed_number)));
    const vacantBeds = rm
      ? Array.from({ length: rm.capacity || 1 }, (_, i) => String(i + 1)).filter(
          (b) => !occupied.has(b)
        )
      : [];
    setAddBedNo(vacantBeds[0] || '');
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!selectedHostelId) {
      showError('Please select a Hostel Block.');
      return;
    }
    if (!allocateFloor) {
      showError('Please select a Floor.');
      return;
    }
    if (!selectedRoomId) {
      showError('Please select an Available Room.');
      return;
    }
    if (!bedNo) {
      showError('Please select a Bed Slot.');
      return;
    }

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
    setAddEmail('');
    setAddGender('M');
    setAddPhone('');
    setAddFatherName('');
    setAddGuardianPhone('');
    setAddEmergencyContact('');
    setAddAllotDirectly(false);
    setAddHostelId('');
    setAddFloor('');
    setAddHostelAllRooms([]);
    setAddRoomId('');
    setAddBedNo('');
    setShowAddModal(true);
  };

  const handleSingleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addUsn.trim()) {
      showError('Please provide both Student Name and USN / Enrollment number.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!addEmail.trim() || !emailRegex.test(addEmail.trim())) {
      showError('Please enter a valid Student Email address.');
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!addPhone.trim() || !phoneRegex.test(addPhone.trim())) {
      showError('Please enter a valid 10-digit Student Mobile Number starting with 6-9.');
      return;
    }

    if (!addGuardianPhone.trim() || !phoneRegex.test(addGuardianPhone.trim())) {
      showError('Please enter a valid 10-digit Guardian Contact Phone starting with 6-9.');
      return;
    }

    if (!addEmergencyContact.trim() || !phoneRegex.test(addEmergencyContact.trim())) {
      showError('Please enter a valid 10-digit Emergency Contact Number starting with 6-9.');
      return;
    }

    if (addAllotDirectly) {
      if (!addHostelId) {
        showError('Please select a Hostel Block for allocation.');
        return;
      }
      if (!addFloor) {
        showError('Please select a Floor.');
        return;
      }
      if (!addRoomId) {
        showError('Please select an Available Room.');
        return;
      }
      if (!addBedNo) {
        showError('Please select a Bed Slot.');
        return;
      }
    }

    setIsSubmittingSingle(true);
    try {
      await apiClient.post('/hms/students/create/', {
        student_name: addName.trim(),
        enrollment_no: addUsn.trim().toUpperCase(),
        email: addEmail.trim(),
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
      const email = rowObj.email || rowObj.email_id || rowObj.mail || '';
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
        email: email || undefined,
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHostelFilter, filterAllotted]);

  const filteredStudents = !selectedHostelFilter ? [] : students.filter((s) => {
    if (selectedHostelFilter && selectedHostelFilter !== 'ALL') {
      const stHostelId = String(s.hostel || (s.room_detail as any)?.hostel_id || (s.allocations as any)?.[0]?.bed?.room?.hostel_id || '');
      if (stHostelId) {
        if (stHostelId !== selectedHostelFilter) return false;
      } else {
        const currentHostel = hostels.find(h => String(h.id) === selectedHostelFilter);
        if (currentHostel && currentHostel.gender && currentHostel.gender !== 'C' && s.gender) {
          if (s.gender !== currentHostel.gender) return false;
        }
      }
    }
    const matchesSearch = s.student_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                          s.enrollment_no.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filterAllotted === 'ALLOTTED') return s.room_allotted;
    if (filterAllotted === 'UNALLOTTED') return !s.room_allotted;
    return true;
  });

  // Pagination calculation (50 records per page)
  const totalStudents = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalStudents);
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + pageSize);

  const getFloorDisplay = (student: any) => {
    const f = student.floor ?? student.room_detail?.floor ?? student.room?.floor;
    if (f !== undefined && f !== null && f !== '') {
      const num = Number(f);
      return num === 0 ? 'Ground Floor' : `Floor ${num}`;
    }
    const rNo = String(student.room_no || student.room_number || '').trim();
    if (rNo.toUpperCase().startsWith('G')) return 'Ground Floor';
    if (/^\d{3,4}$/.test(rNo)) {
      const inferred = Math.floor(Number(rNo) / 100);
      if (inferred === 0) return 'Ground Floor';
      return `Floor ${inferred}`;
    }
    return null;
  };

  // Computed helpers for Add Student modal allocation hierarchy
  const addAvailableFloors = Array.from(
    new Set(addHostelAllRooms.map((r) => r.floor))
  ).sort((a, b) => Number(a) - Number(b));

  const addFloorRooms = addHostelAllRooms.filter(
    (r) => String(r.floor) === String(addFloor) && (r.occupied_count || 0) < (r.capacity || 1)
  );

  const addSelectedRoom = addHostelAllRooms.find((r) => String(r.id) === String(addRoomId));
  const addOccupiedBeds = new Set((addSelectedRoom?.occupants || []).map((o: any) => String(o.bed_number)));
  const addVacantBeds = addSelectedRoom
    ? Array.from({ length: addSelectedRoom.capacity || 1 }, (_, i) => String(i + 1)).filter(
        (b) => !addOccupiedBeds.has(b)
      )
    : [];

  // Computed helpers for Standalone Allocate modal allocation hierarchy
  const allocateAvailableFloors = Array.from(
    new Set(allocateHostelAllRooms.map((r) => r.floor))
  ).sort((a, b) => Number(a) - Number(b));

  const allocateFloorRooms = allocateHostelAllRooms.filter(
    (r) => String(r.floor) === String(allocateFloor) && (r.occupied_count || 0) < (r.capacity || 1)
  );

  const allocateSelectedRoom = allocateHostelAllRooms.find((r) => String(r.id) === String(selectedRoomId));
  const allocateOccupiedBeds = new Set((allocateSelectedRoom?.occupants || []).map((o: any) => String(o.bed_number)));
  const allocateVacantBeds = allocateSelectedRoom
    ? Array.from({ length: allocateSelectedRoom.capacity || 1 }, (_, i) => String(i + 1)).filter(
        (b) => !allocateOccupiedBeds.has(b)
      )
    : [];

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

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name or USN..."
              className="w-full bg-slate-50 pl-10 pr-4 py-2.5 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
            />
          </div>

          <div className="w-full sm:w-56 shrink-0">
            <Select value={selectedHostelFilter} onValueChange={setSelectedHostelFilter}>
              <SelectTrigger className="h-10 rounded-2xl bg-slate-50 text-xs font-semibold border border-slate-200 px-3.5">
                <div className="flex items-center gap-1.5 truncate">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Select Hostel" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Hostel Blocks</SelectItem>
                {hostels.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name} ({h.gender})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {(['ALL', 'ALLOTTED', 'UNALLOTTED'] as const).map((tab) => {
            const count = !selectedHostelFilter
              ? 0
              : tab === 'ALL' 
              ? filteredStudents.length 
              : tab === 'ALLOTTED' 
              ? filteredStudents.filter(s => s.room_allotted).length 
              : filteredStudents.filter(s => !s.room_allotted).length;
            return (
              <button
                key={tab}
                onClick={() => setFilterAllotted(tab)}
                className={`flex-1 md:flex-initial text-center px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  filterAllotted === tab
                    ? 'bg-[#0B1437] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab === 'ALL' ? `All Residents (${count})` : tab === 'ALLOTTED' ? `Allotted (${count})` : `Unallotted (${count})`}
              </button>
            );
          })}
        </div>
      </div>

      {!selectedHostelFilter ? (
        <div className="bg-white p-14 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-3xl bg-blue-100 text-[#0B1437] flex items-center justify-center mx-auto shadow-inner">
            <Building2 className="w-8 h-8 text-[#0B1437]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Select a Hostel Block</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Please choose a hostel block (or "All Hostel Blocks") from the dropdown above to view the resident student directory and allotments.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
          {/* Mobile View: Cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {paginatedStudents.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No resident students match your criteria.
              </div>
            ) : (
            paginatedStudents.map((s) => (
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
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Contact & Email</span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{s.phone || 'N/A'}</span>
                    </div>
                    {s.email && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{s.email}</span>
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 pt-1.5 border-t border-slate-200/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Room & Bed Slot</span>
                    {s.room_allotted ? (
                      <div className="mt-0.5">
                        <span className="font-semibold text-slate-900 block">{s.hostel_name || 'Block'}</span>
                        <span className="text-xs text-slate-500">
                          {getFloorDisplay(s) ? `${getFloorDisplay(s)} · ` : ''}Room {s.room_no} · Bed {s.bed_number || '1'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-700 font-medium bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 inline-block mt-0.5">
                        Unassigned Bed
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(s)}
                    className="flex-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 py-2 rounded-full transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 border border-slate-200"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    <span>Edit</span>
                  </button>
                  {s.room_allotted ? (
                    <button
                      onClick={() => handleVacate(s.id)}
                      className="flex-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 py-2 rounded-full transition-colors border border-rose-200 cursor-pointer shadow-2xs"
                    >
                      Vacate Bed
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenAllocate(s)}
                      className="flex-1 text-xs font-semibold text-teal-900 bg-blue-100 hover:bg-teal-200 py-2 rounded-full transition-colors cursor-pointer shadow-2xs"
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
                <th className="px-6 py-4">Contact & Email</th>
                <th className="px-6 py-4">Room & Bed Slot</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No resident students match your criteria.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s) => (
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
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 text-xs flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{s.phone || 'N/A'}</span>
                      </div>
                      {s.email && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[190px]">{s.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {s.room_allotted ? (
                        <div>
                          <span className="font-semibold text-slate-900 block">{s.hostel_name || 'Block'}</span>
                          <span className="text-xs text-slate-500">
                            {getFloorDisplay(s) ? `${getFloorDisplay(s)} · ` : ''}Room {s.room_no} · Bed {s.bed_number || '1'}
                          </span>
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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-[#0B1437] px-3 py-1.5 rounded-full transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5 border border-slate-200"
                          title="Edit Student Details"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit</span>
                        </button>
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {filteredStudents.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 font-medium flex items-center gap-2">
              <span>
                Showing <strong className="text-slate-800 font-semibold">{totalStudents === 0 ? 0 : startIndex + 1}</strong> to <strong className="text-slate-800 font-semibold">{endIndex}</strong> of <strong className="text-slate-800 font-semibold">{totalStudents}</strong> residents
              </span>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0B1437] cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((pageNum, idx, arr) => {
                      const prev = arr[idx - 1];
                      return (
                        <React.Fragment key={pageNum}>
                          {prev && pageNum - prev > 1 && (
                            <span className="px-1 text-slate-400 font-bold">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              currentPage === pageNum
                                ? 'bg-[#0B1437] text-white shadow-2xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {pageNum}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}

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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="e.g. student@amc.edu"
                    className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender <span className="text-red-500">*</span></label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Mobile Number <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    required
                    pattern="^[6-9][0-9]{9}$"
                    title="Please enter a valid 10-digit Indian phone number starting with 6-9"
                    maxLength={10}
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Guardian Contact Phone <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    required
                    pattern="^[6-9][0-9]{9}$"
                    title="Please enter a valid 10-digit Indian phone number starting with 6-9"
                    maxLength={10}
                    value={addGuardianPhone}
                    onChange={(e) => setAddGuardianPhone(e.target.value)}
                    placeholder="e.g. 9811223344"
                    className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Emergency Contact <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  pattern="^[6-9][0-9]{9}$"
                  title="Please enter a valid 10-digit Indian phone number starting with 6-9"
                  maxLength={10}
                  value={addEmergencyContact}
                  onChange={(e) => setAddEmergencyContact(e.target.value)}
                  placeholder="e.g. 9899001122"
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Hostel Block <span className="text-rose-500">*</span>
                      </label>
                      <Select value={addHostelId} onValueChange={handleAddHostelChange}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="-- Select Hostel Block --" />
                        </SelectTrigger>
                        <SelectContent>
                          {hostels.map((h) => (
                            <SelectItem key={h.id} value={String(h.id)}>
                              {h.name} ({h.gender})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Floor <span className="text-rose-500">*</span>
                      </label>
                      <Select
                        value={addFloor}
                        onValueChange={handleAddFloorChange}
                        disabled={!addHostelId}
                      >
                        <SelectTrigger className="bg-white disabled:opacity-50">
                          <SelectValue placeholder={!addHostelId ? 'Select hostel first' : '-- Select Floor --'} />
                        </SelectTrigger>
                        <SelectContent>
                          {addAvailableFloors.map((fl) => (
                            <SelectItem key={fl} value={String(fl)}>
                              {Number(fl) === 0 ? 'Ground Floor' : `Floor ${fl}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Available Room <span className="text-rose-500">*</span>
                      </label>
                      <Select
                        value={addRoomId}
                        onValueChange={handleAddRoomChange}
                        disabled={!addFloor}
                      >
                        <SelectTrigger className="bg-white disabled:opacity-50">
                          <SelectValue
                            placeholder={
                              !addFloor
                                ? 'Select floor first'
                                : addFloorRooms.length === 0
                                ? 'No available rooms'
                                : '-- Select Room --'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {addFloorRooms.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              Room {r.no || r.room_no || r.name} ({r.occupied_count || 0}/{r.capacity || 1} occ)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Bed Slot <span className="text-rose-500">*</span>
                      </label>
                      <Select
                        value={addBedNo}
                        onValueChange={setAddBedNo}
                        disabled={!addRoomId || addVacantBeds.length === 0}
                      >
                        <SelectTrigger className="bg-white disabled:opacity-50">
                          <SelectValue
                            placeholder={
                              !addRoomId
                                ? 'Select room first'
                                : addVacantBeds.length === 0
                                ? 'No vacant beds'
                                : '-- Select Bed --'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {addVacantBeds.map((b) => (
                            <SelectItem key={b} value={b}>
                              Bed {b}
                            </SelectItem>
                          ))}
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
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Allocate Bed to Resident</h3>
            <p className="text-xs text-slate-500 mb-5">
              Assigning room for: <strong className="text-slate-800">{selectedStudent.student_name}</strong> ({selectedStudent.enrollment_no})
            </p>

            <form onSubmit={handleAllocate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Hostel Block <span className="text-rose-500">*</span>
                </label>
                <Select value={selectedHostelId} onValueChange={handleHostelChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Select Hostel Block --" />
                  </SelectTrigger>
                  <SelectContent>
                    {hostels.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>{h.name} ({h.gender})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Floor <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={allocateFloor}
                    onValueChange={handleAllocateFloorChange}
                    disabled={!selectedHostelId}
                  >
                    <SelectTrigger className="disabled:opacity-50">
                      <SelectValue placeholder={!selectedHostelId ? 'Select hostel first' : '-- Select Floor --'} />
                    </SelectTrigger>
                    <SelectContent>
                      {allocateAvailableFloors.map((fl) => (
                        <SelectItem key={fl} value={String(fl)}>
                          {Number(fl) === 0 ? 'Ground Floor' : `Floor ${fl}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Available Room <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={selectedRoomId}
                    onValueChange={handleAllocateRoomChange}
                    disabled={!allocateFloor}
                  >
                    <SelectTrigger className="disabled:opacity-50">
                      <SelectValue
                        placeholder={
                          !allocateFloor
                            ? 'Select floor first'
                            : allocateFloorRooms.length === 0
                            ? 'No available rooms on this floor'
                            : '-- Select Room --'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {allocateFloorRooms.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          Room {r.no || r.room_no || r.name} ({r.occupied_count || 0}/{r.capacity || 1} occ)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Bed Slot <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={bedNo}
                  onValueChange={setBedNo}
                  disabled={!selectedRoomId || allocateVacantBeds.length === 0}
                >
                  <SelectTrigger className="disabled:opacity-50">
                    <SelectValue
                      placeholder={
                        !selectedRoomId
                          ? 'Select room first'
                          : allocateVacantBeds.length === 0
                          ? 'No vacant beds'
                          : '-- Select Bed --'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {allocateVacantBeds.map((b) => (
                      <SelectItem key={b} value={b}>
                        Bed {b}
                      </SelectItem>
                    ))}
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

      {/* Edit Student Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Student Record</h3>
                <p className="text-xs text-slate-500 mt-0.5">Update personal details, institutional contact, and emergency info</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditStudentSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
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
                    value={editUsn}
                    onChange={(e) => setEditUsn(e.target.value)}
                    placeholder="e.g. 1AM22CS045"
                    className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="e.g. student@amc.edu"
                    className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender <span className="text-red-500">*</span></label>
                  <Select value={editGender} onValueChange={(val: 'M' | 'F') => setEditGender(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Mobile Number</label>
                  <input
                    type="tel"
                    pattern="^[6-9][0-9]{9}$"
                    title="Please enter a valid 10-digit Indian phone number starting with 6-9"
                    maxLength={10}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
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
                    value={editFatherName}
                    onChange={(e) => setEditFatherName(e.target.value)}
                    placeholder="e.g. Suresh Kumar"
                    className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Guardian Contact Phone</label>
                  <input
                    type="tel"
                    pattern="^[6-9][0-9]{9}$"
                    title="Please enter a valid 10-digit Indian phone number starting with 6-9"
                    maxLength={10}
                    value={editGuardianPhone}
                    onChange={(e) => setEditGuardianPhone(e.target.value)}
                    placeholder="e.g. 9811223344"
                    className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact</label>
                <input
                  type="text"
                  value={editEmergencyContact}
                  onChange={(e) => setEditEmergencyContact(e.target.value)}
                  placeholder="e.g. 9899001122 (Local Guardian / Relative)"
                  className="w-full bg-slate-50 px-3.5 py-2 rounded-2xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmittingEdit ? 'Saving Changes...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
