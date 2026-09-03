import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Phone, Mail } from 'lucide-react';
import type { HostelWarden, HostelCaretaker } from '../../types';
import { apiClient } from '../../api/apiClient';
import { useNotification } from '../../context/NotificationContext';

export const StaffManagement: React.FC = () => {
  const { showSuccess, showError, confirm } = useNotification();
  const [wardens, setWardens] = useState<HostelWarden[]>([]);
  const [caretakers, setCaretakers] = useState<HostelCaretaker[]>([]);
  const [securityStaff, setSecurityStaff] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'wardens' | 'caretakers' | 'security'>('wardens');
  const [showModal, setShowModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<number | string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [experience, setExperience] = useState(2);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const [wRes, cRes, sRes] = await Promise.all([
        apiClient.get<HostelWarden[]>('/hms/wardens/'),
        apiClient.get<HostelCaretaker[]>('/hms/caretakers/'),
        apiClient.get<any[]>('/hms/security/'),
      ]);
      setWardens(wRes.data || []);
      setCaretakers(cRes.data || []);
      setSecurityStaff(sRes.data || []);
    } catch (err) {
      console.error('Failed to load staff list', err);
    }
  };

  const openCreateModal = () => {
    setEditingStaffId(null);
    setName('');
    setEmail('');
    setPhone('');
    setDesignation('');
    setExperience(2);
    setShowModal(true);
  };

  const openEditModal = (staff: any) => {
    setEditingStaffId(staff.id);
    setName(staff.name || '');
    setEmail(staff.email || '');
    setPhone(staff.phone || '');
    setDesignation(staff.designation || '');
    setExperience(Number(staff.experience) || 2);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: any = {
        name,
        email: email || undefined,
        phone,
        experience: Number(experience) || 0,
      };
      if (activeTab === 'wardens') {
        payload.designation = designation || 'Hostel Warden';
      } else if (activeTab === 'security') {
        payload.designation = designation || 'Security Guard';
      }

      const endpointMap = {
        'wardens': '/hms/wardens/',
        'caretakers': '/hms/caretakers/',
        'security': '/hms/security/'
      };
      
      const roleName = activeTab === 'wardens' ? 'Warden' : activeTab === 'caretakers' ? 'Caretaker' : 'Security Staff';

      if (editingStaffId) {
        const endpoint = `${endpointMap[activeTab]}${editingStaffId}/`;
        await apiClient.put(endpoint, payload);
        showSuccess(`${roleName} updated successfully.`);
      } else {
        const endpoint = endpointMap[activeTab];
        await apiClient.post(endpoint, payload);
        if (email) {
          showSuccess(`New ${roleName.toLowerCase()} enrolled. An email with a temporary password was sent!`);
        } else {
          showSuccess(`New ${roleName.toLowerCase()} profile registered.`);
        }
      }

      setShowModal(false);
      setEditingStaffId(null);
      setName('');
      setEmail('');
      setPhone('');
      setDesignation('');
      setExperience(2);
      await fetchStaff();
    } catch (err: any) {
      const errorMsg =
        err.message ||
        err.response?.data?.detail ||
        err.response?.data?.name?.[0] ||
        err.response?.data?.email?.[0] ||
        err.response?.data?.phone?.[0] ||
        'Failed to save staff member';
      showError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number | string) => {
    const roleName = activeTab === 'wardens' ? 'warden' : activeTab === 'caretakers' ? 'caretaker' : 'security staff';
    const isConfirmed = await confirm({
      title: 'Remove Staff Member',
      message: `Are you sure you want to remove this ${roleName} profile? This action will unbind their administrative access.`,
      confirmText: 'Remove Profile',
      isDestructive: true
    });
    if (!isConfirmed) return;

    const endpointMap = {
      'wardens': `/hms/wardens/${id}/`,
      'caretakers': `/hms/caretakers/${id}/`,
      'security': `/hms/security/${id}/`
    };
    const endpoint = endpointMap[activeTab];
    try {
      await apiClient.delete(endpoint);
      showSuccess('Staff profile deleted successfully.');
      await fetchStaff();
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Failed to delete staff member');
    }
  };

  return (
    <div className="space-y-6">
      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Staff & Wardens</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage residential wardens, block caretakers, and supervision staff</p>
        </div>
        <button
          onClick={openCreateModal}
          className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-full bg-[#0D3833] text-white text-xs sm:text-sm font-semibold hover:bg-[#064E3B] transition-all shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add {activeTab === 'wardens' ? 'Warden' : activeTab === 'caretakers' ? 'Caretaker' : 'Security'}</span>
        </button>
      </div>

      {/* Responsive Tab Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
        <button
          onClick={() => setActiveTab('wardens')}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'wardens'
              ? 'bg-[#0D3833] text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Chief & Block Wardens ({wardens.length})
        </button>
        <button
          onClick={() => setActiveTab('caretakers')}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'caretakers'
              ? 'bg-[#0D3833] text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Hostel Caretakers ({caretakers.length})
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'security'
              ? 'bg-[#0D3833] text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Security Staff ({securityStaff.length})
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(activeTab === 'wardens' ? wardens : activeTab === 'caretakers' ? caretakers : securityStaff).map((staff: any) => (
          <div
            key={staff.id}
            className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all"
          >
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-[#E0E7FF] text-indigo-950 flex items-center justify-center font-bold text-base">
                  {staff.name ? staff.name[0] : 'S'}
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  {staff.experience || staff.experience_years || 0} YRS EXP
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900">{staff.name}</h3>
              <p className="text-xs text-slate-400 mb-4">
                {staff.designation || (activeTab === 'wardens' ? 'Hostel Warden' : activeTab === 'caretakers' ? 'Residential Caretaker' : 'Security Guard')}
              </p>

              <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3 mb-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{staff.email || 'No institutional email'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{staff.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => openEditModal(staff)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                title="Edit staff details"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(staff.id)}
                className="p-1.5 rounded-full hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                title="Remove staff"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-slate-200 shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingStaffId ? 'Edit' : 'Add New'} {activeTab === 'wardens' ? 'Warden' : activeTab === 'caretakers' ? 'Caretaker' : 'Security Staff'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">Enter staff contact information and experience credentials.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Sharma"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                />
              </div>

              {(activeTab === 'wardens' || activeTab === 'security') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Warden - Block A"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone (10 Digits)</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    pattern="[0-9]{10}"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    min={0}
                    value={experience}
                    onChange={(e) => setExperience(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Institutional Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20"
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
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-full bg-[#0D3833] text-white text-xs font-semibold hover:bg-[#064E3B] shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Processing...' : editingStaffId ? 'Update Staff Member' : 'Save Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
