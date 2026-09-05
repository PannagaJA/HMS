import React, { useEffect, useState } from 'react';
import { Building2, Plus, Edit2, Trash2, UserPlus, X } from 'lucide-react';
import type { Hostel, HostelWarden, HostelCaretaker } from '../../types';
import { apiClient } from '../../api/apiClient';
import { useNotification } from '../../context/NotificationContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export const HostelManagement: React.FC = () => {
  const { showSuccess, showError, confirm } = useNotification();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [wardens, setWardens] = useState<HostelWarden[]>([]);
  const [caretakers, setCaretakers] = useState<HostelCaretaker[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);

  // Quick Staff Enrollment Modal States
  const [enrollRole, setEnrollRole] = useState<'warden' | 'caretaker' | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffDesignation, setStaffDesignation] = useState('');
  const [staffExperience, setStaffExperience] = useState(2);
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'C'>('M');
  const [floorCount, setFloorCount] = useState(3);
  const [wardenId, setWardenId] = useState<string>('none');
  const [caretakerId, setCaretakerId] = useState<string>('none');
  const [address, setAddress] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [hRes, wRes, cRes] = await Promise.all([
        apiClient.get<Hostel[]>('/hms/hostels/'),
        apiClient.get<HostelWarden[]>('/hms/wardens/'),
        apiClient.get<HostelCaretaker[]>('/hms/caretakers/'),
      ]);
      setHostels(hRes.data || []);
      setWardens(wRes.data || []);
      setCaretakers(cRes.data || []);
    } catch (err) {
      console.error('Failed to load hostel data', err);
    }
  };

  const handleOpenCreate = () => {
    setEditingHostel(null);
    setName('');
    setGender('M');
    setFloorCount(3);
    setWardenId('none');
    setCaretakerId('none');
    setAddress('');
    setShowModal(true);
  };

  const handleOpenEdit = (hostel: Hostel) => {
    setEditingHostel(hostel);
    setName(hostel.name);
    setGender(hostel.gender);
    setFloorCount(hostel.floor_count);
    setWardenId(hostel.warden ? String(hostel.warden) : 'none');
    setCaretakerId(hostel.caretaker ? String(hostel.caretaker) : 'none');
    setAddress(hostel.address || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      gender,
      floor_count: floorCount,
      warden: wardenId !== 'none' ? wardenId : null,
      caretaker: caretakerId !== 'none' ? caretakerId : null,
      address,
    };

    try {
      if (editingHostel) {
        await apiClient.put(`/hms/hostels/${editingHostel.id}/`, payload);
        showSuccess(`Hostel block "${name}" updated successfully.`);
      } else {
        await apiClient.post('/hms/hostels/', payload);
        showSuccess(`Hostel block "${name}" created successfully.`);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.name?.[0] || err.message || 'Failed to save hostel');
    }
  };

  const handleOpenEnrollStaff = (role: 'warden' | 'caretaker') => {
    setEnrollRole(role);
    setStaffName('');
    setStaffEmail('');
    setStaffPhone('');
    setStaffDesignation(role === 'warden' ? 'Hostel Warden' : '');
    setStaffExperience(2);
  };

  const handleCloseEnrollStaff = () => {
    setEnrollRole(null);
    setStaffName('');
    setStaffEmail('');
    setStaffPhone('');
    setStaffDesignation('');
    setStaffExperience(2);
    setIsSubmittingStaff(false);
  };

  const handleEnrollStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollRole) return;
    setIsSubmittingStaff(true);

    try {
      const payload: any = {
        name: staffName.trim(),
        email: staffEmail.trim() || undefined,
        phone: staffPhone.trim(),
        experience: Number(staffExperience) || 0,
      };

      if (enrollRole === 'warden') {
        payload.designation = staffDesignation.trim() || 'Hostel Warden';
        const res = await apiClient.post('/hms/wardens/', payload);
        const newWarden = res.data;
        showSuccess(`Warden "${staffName}" enrolled successfully.`);
        
        // Refresh wardens list and auto-select
        const wRes = await apiClient.get<HostelWarden[]>('/hms/wardens/');
        const updatedWardens = wRes.data || [];
        setWardens(updatedWardens);

        if (newWarden?.id) {
          setWardenId(String(newWarden.id));
        } else {
          const match = updatedWardens.find((w) => w.name.toLowerCase() === staffName.trim().toLowerCase());
          if (match) setWardenId(String(match.id));
        }
      } else {
        const res = await apiClient.post('/hms/caretakers/', payload);
        const newCaretaker = res.data;
        showSuccess(`Caretaker "${staffName}" enrolled successfully.`);

        // Refresh caretakers list and auto-select
        const cRes = await apiClient.get<HostelCaretaker[]>('/hms/caretakers/');
        const updatedCaretakers = cRes.data || [];
        setCaretakers(updatedCaretakers);

        if (newCaretaker?.id) {
          setCaretakerId(String(newCaretaker.id));
        } else {
          const match = updatedCaretakers.find((c) => c.name.toLowerCase() === staffName.trim().toLowerCase());
          if (match) setCaretakerId(String(match.id));
        }
      }

      handleCloseEnrollStaff();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.detail ||
        err.response?.data?.name?.[0] ||
        err.response?.data?.phone?.[0] ||
        err.response?.data?.email?.[0] ||
        err.message ||
        `Failed to enroll ${enrollRole}`;
      showError(errorMsg);
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  const handleDelete = async (id: number) => {
    const isConfirmed = await confirm({
      title: 'Delete Hostel Block',
      message: 'Are you sure you want to delete this hostel? All associated rooms and resident bed configurations will also be affected.',
      confirmText: 'Delete Hostel',
      isDestructive: true
    });
    if (!isConfirmed) return;

    try {
      await apiClient.delete(`/hms/hostels/${id}/`);
      showSuccess('Hostel removed successfully.');
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Failed to delete hostel');
    }
  };

  const availableWardens = wardens;
  const availableCaretakers = caretakers;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel & Block Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configure campus residential blocks, floor hierarchies, and staff assignments</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-full bg-[#0B1437] text-white text-xs sm:text-sm font-semibold hover:bg-[#111f54] transition-all shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Hostel Block</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hostels.map((h) => (
          <div
            key={h.id}
            className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all"
          >
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-teal-950 flex items-center justify-center font-bold">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    h.gender === 'M' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    h.gender === 'F' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {h.gender === 'M' ? 'BOYS HOSTEL' : h.gender === 'F' ? 'GIRLS HOSTEL' : 'CO-ED HOSTEL'}
                  </span>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-1">{h.name}</h3>
              <p className="text-xs text-slate-400 mb-4">{h.address || 'Campus Residential Zone'}</p>

              <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 mb-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Total Rooms</span>
                  <span className="font-bold text-slate-800">{h.total_rooms} Rooms</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Bed Occupancy</span>
                  <span className="font-bold text-slate-800">{h.occupied_beds} / {h.total_capacity} Beds</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Chief Warden:</span>
                  <span className="font-semibold text-slate-800">{h.warden_detail?.name || 'Unassigned'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Caretaker:</span>
                  <span className="font-semibold text-slate-800">{h.caretaker_detail?.name || 'Unassigned'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => handleOpenEdit(h)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                title="Edit Hostel"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(h.id)}
                className="p-2 rounded-full hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                title="Delete Hostel"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-7 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-xl font-bold text-slate-900 mb-1">
              {editingHostel ? 'Edit Hostel Details' : 'Add New Hostel Block'}
            </h3>
            <p className="text-xs text-slate-500 mb-6">Configure building specifications and staff allocation.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hostel Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aryabhatta Boys Hostel (Block A)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Gender Designation <span className="text-red-500">*</span></label>
                  <Select value={gender} onValueChange={(val: any) => setGender(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male (Boys)</SelectItem>
                      <SelectItem value="F">Female (Girls)</SelectItem>
                      <SelectItem value="C">Co-ed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Floor Count <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={floorCount}
                    onChange={(e) => setFloorCount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Assign Warden</label>
                    <button
                      type="button"
                      onClick={() => handleOpenEnrollStaff('warden')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Add Warden</span>
                    </button>
                  </div>
                  <Select value={wardenId} onValueChange={setWardenId}>
                    <SelectTrigger>
                      <SelectValue placeholder="-- None --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- None --</SelectItem>
                      {availableWardens.map((w) => (
                        <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Assign Caretaker</label>
                    <button
                      type="button"
                      onClick={() => handleOpenEnrollStaff('caretaker')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Add Caretaker</span>
                    </button>
                  </div>
                  <Select value={caretakerId} onValueChange={setCaretakerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="-- None --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- None --</SelectItem>
                      {availableCaretakers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Location / Address</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. North Campus, Tech Enclave"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm"
                />
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
                  className="px-6 py-2.5 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-sm cursor-pointer"
                >
                  Save Hostel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Staff Enrollment Popup */}
      {enrollRole && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Enroll New {enrollRole === 'warden' ? 'Warden' : 'Caretaker'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseEnrollStaff}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-5 pl-10">
              Provide staff contact details. The newly enrolled {enrollRole} will be saved and automatically assigned to this hostel block.
            </p>

            <form onSubmit={handleEnrollStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder={enrollRole === 'warden' ? 'e.g. Dr. Rajesh Sharma' : 'e.g. Ramesh Kumar'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                />
              </div>

              {enrollRole === 'warden' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={staffDesignation}
                    onChange={(e) => setStaffDesignation(e.target.value)}
                    placeholder="e.g. Chief Warden / Hostel Warden"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone (10 Digits) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    pattern="^[6-9][0-9]{9}$"
                    title="Please enter a valid 10-digit Indian phone number starting with 6-9"
                    maxLength={10}
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Experience (Years) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={staffExperience}
                    onChange={(e) => setStaffExperience(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Institutional Email</label>
                <input
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseEnrollStaff}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="px-5 py-2 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingStaff ? 'Enrolling...' : `Save & Assign ${enrollRole === 'warden' ? 'Warden' : 'Caretaker'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
