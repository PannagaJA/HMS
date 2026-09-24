import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Lock, Save, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/apiClient';
import { useNotification } from '../../context/NotificationContext';
import type { HostelStudent } from '../../types';

export const HMSProfile: React.FC = () => {
  const { user, updateCurrentUser } = useAuth();
  const { showSuccess, showError } = useNotification();
  const queryClient = useQueryClient();

  const isStudent = user?.role === 'STUDENT';

  const { data: studentData } = useQuery<{ profile: HostelStudent; roommates: HostelStudent[] }>({
    queryKey: ['studentProfile'],
    queryFn: async () => {
      const res = await apiClient.get<{ profile: HostelStudent; roommates: HostelStudent[] }>('/student/students/my_profile/');
      return res.data;
    },
    enabled: isStudent,
    staleTime: 0,
  });

  // Resolve best USN from context or student record
  const isUsnFormat = (val?: string) => /^[0-9]{1,2}[A-Za-z]{2,5}[0-9]{2}[A-Za-z]{2}[0-9]{2,4}$/i.test(val || '');

  const studentUsn = user?.enrollment_no 
    || studentData?.profile?.enrollment_no 
    || (user?.username && !user.username.includes('@') ? user.username : null)
    || (user?.email?.includes('@') ? user.email.split('@')[0] : 'N/A');

  // Resolve phone with fallback to students table / cache
  const resolvedPhone = studentData?.profile?.phone || user?.phone || '';

  // Resolve the best display name for the initial form state
  const resolveInitialName = () => {
    if (studentData?.profile?.student_name) {
      return studentData.profile.student_name;
    }
    const fn = user?.first_name || '';
    const ln = user?.last_name || '';
    const genericNames = ['student', 'resident', 'user', 'admin', ''];
    if (fn && !genericNames.includes(fn.toLowerCase()) && (!isStudent || !isUsnFormat(fn))) {
      return `${fn} ${ln}`.trim();
    }
    // For student, fallback to student_name from studentData if already loaded
    return '';
  };

  const [name, setName] = useState(resolveInitialName);
  const [email, setEmail] = useState(user?.email || '');
  // For students: pre-fill phone from resolved source (students table > profiles)
  const [phone, setPhone] = useState(resolvedPhone || user?.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Sync form inputs when student profile data loads from DB
    if (isStudent && studentData?.profile) {
      if (studentData.profile.student_name) {
        setName(studentData.profile.student_name);
      }
      if (studentData.profile.phone !== undefined && studentData.profile.phone !== null) {
        setPhone(studentData.profile.phone || '');
      }
      if (studentData.profile.email) {
        setEmail(studentData.profile.email);
      }
    } else if (!isStudent && user) {
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      if (fullName) {
        setName(fullName);
      }
      if (user.email) {
        setEmail(user.email);
      }
      if (user.phone !== undefined && user.phone !== null) {
        setPhone(user.phone || '');
      }
    }
  }, [studentData, isStudent, user]);


  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg('');
    try {
      const parts = name.trim().split(' ');
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';

      const res = await apiClient.patch('/auth/profile/', {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
      });

      // Update global AuthContext and persistent session state immediately
      updateCurrentUser(res.data);

      // Sync form inputs with saved values
      setName(`${firstName} ${lastName}`.trim());
      setEmail(email);
      setPhone(phone);

      // Invalidate all React Query caches that display profile-based data
      queryClient.invalidateQueries({ queryKey: ['studentProfile'] });
      queryClient.invalidateQueries({ queryKey: ['myIssues'] });
      queryClient.invalidateQueries({ queryKey: ['myGatePasses'] });

      showSuccess('Profile updated successfully! New details are now active.');
      setSuccessMsg('Profile updated successfully! New details are now active across all screens.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.email?.[0] ||
        err.response?.data?.phone?.[0] ||
        err.response?.data?.detail ||
        'Failed to update profile';
      showError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    try {
      const res = await apiClient.post('/auth/profile/', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordMsg(res.data.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(''), 4000);
    } catch (err: any) {
      setPasswordError(err.message || err.response?.data?.message || err.response?.data?.detail || 'Failed to change password');
    }
  };

  const hasValidAuthName = user?.first_name 
    && !['student', 'resident', 'user', 'admin'].includes(user.first_name.toLowerCase())
    && (!isStudent || !isUsnFormat(user.first_name));

  const displayName = isStudent 
    ? (studentData?.profile?.student_name || (hasValidAuthName ? `${user?.first_name} ${user?.last_name || ''}`.trim() : 'Resident Student'))
    : ((user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : null) || (name && !isUsnFormat(name) ? name : null) || user?.username || 'User');

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account & Profile Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage personal credentials, institutional contact details, and security keys</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Profile Overview Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full bg-[#0B1437] text-white flex items-center justify-center text-3xl font-bold mb-4 shadow-md">
            {displayName[0]?.toUpperCase() || 'A'}
          </div>
          <h3 className="text-lg font-bold text-slate-900">{displayName}</h3>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-teal-950 mt-1 mb-4 border border-teal-200">
            {user?.role || 'HMS USER'}
          </span>

          <div className="w-full border-t border-slate-100 pt-4 space-y-2.5 text-xs text-left text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{isStudent ? 'USN / Enrollment:' : 'Username:'}</span>
              <span className="font-mono font-semibold text-slate-800">
                {isStudent ? studentUsn : (user?.username || (user?.email?.includes('@') ? user.email.split('@')[0] : 'N/A'))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Role:</span>
              <span className="font-semibold text-slate-800">{user?.role}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Email:</span>
              <span className="truncate max-w-[140px] text-slate-700">{isStudent ? (studentData?.profile?.email || user?.email) : user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Phone:</span>
              <span className="font-mono text-slate-700">{(isStudent ? resolvedPhone : user?.phone) || 'Not set'}</span>
            </div>
            {isStudent && studentData?.profile?.hostel_name && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Hostel:</span>
                <span className="font-semibold text-slate-800">{studentData.profile.hostel_name}</span>
              </div>
            )}
            {isStudent && studentData?.profile?.room_no && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Room:</span>
                <span className="font-semibold text-slate-800">Room {studentData.profile.room_no}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Form Tabs: Profile Details & Password */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile Form */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <User className="w-5 h-5 text-[#0B1437]" />
              <h3 className="text-base font-bold text-slate-900">Personal & Contact Information</h3>
            </div>

            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 animate-in fade-in">
                ✓ {successMsg}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name {isStudent ? <span className="text-slate-400 font-normal">(read-only)</span> : <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    readOnly={isStudent}
                    disabled={isStudent}
                    value={isStudent ? (studentData?.profile?.student_name || name || (!isUsnFormat(user?.first_name) ? user?.first_name : '') || '') : name}
                    onChange={(e) => !isStudent && setName(e.target.value)}
                    className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 ${isStudent ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Institutional Email {isStudent ? <span className="text-slate-400 font-normal">(read-only)</span> : <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      readOnly={isStudent}
                      disabled={isStudent}
                      value={isStudent ? (studentData?.profile?.email || email || user?.email || '') : email}
                      onChange={(e) => !isStudent && setEmail(e.target.value)}
                      className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 ${isStudent ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Official Phone (10 Digits) {isStudent ? <span className="text-slate-400 font-normal">(read-only)</span> : <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      readOnly={isStudent}
                      disabled={isStudent}
                      maxLength={10}
                      pattern="^[6-9][0-9]{9}$"
                      title="Please enter a valid 10-digit Indian phone number starting with 6-9"
                      value={isStudent ? (studentData?.profile?.phone || phone || user?.phone || '') : phone}
                      onChange={(e) => !isStudent && setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20 ${isStudent ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {isStudent ? (
                <div className="pt-2 text-xs text-slate-500 flex items-center justify-between">
                  <span className="italic text-slate-400">Student profile details are managed by Hostel Administration / Warden.</span>
                </div>
              ) : (
                <div className="flex justify-end pt-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-full bg-[#0B1437] text-white text-xs font-semibold hover:bg-[#111f54] shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Saving Changes...' : 'Save Profile'}</span>
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Change Password Form */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <KeyRound className="w-5 h-5 text-[#0B1437]" />
              <h3 className="text-base font-bold text-slate-900">Security & Password Management</h3>
            </div>

            {passwordMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 animate-in fade-in">
                ✓ {passwordMsg}
              </div>
            )}
            {passwordError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 animate-in fade-in">
                ⚠️ {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Current Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer p-0.5"
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer p-0.5"
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer p-0.5"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
