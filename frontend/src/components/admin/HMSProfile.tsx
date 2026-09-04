import React, { useState } from 'react';
import { User, Mail, Phone, Lock, Save, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/apiClient';
import { useNotification } from '../../context/NotificationContext';

export const HMSProfile: React.FC = () => {
  const { user, updateCurrentUser } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [name, setName] = useState(
    user?.first_name 
      ? `${user.first_name} ${user.last_name || ''}`.trim() 
      : (user?.username || 'Administrator')
  );
  const [email, setEmail] = useState(user?.email || 'admin@hms.local');
  const [phone, setPhone] = useState(user?.phone || '9876543210');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      setPasswordError(err.response?.data?.message || err.response?.data?.detail || 'Failed to change password');
    }
  };

  const displayName = user?.first_name 
    ? `${user.first_name} ${user.last_name || ''}`.trim() 
    : (user?.username || name);

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
              <span className="text-slate-400">Username:</span>
              <span className="font-mono font-semibold text-slate-800">{user?.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Role:</span>
              <span className="font-semibold text-slate-800">{user?.role}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Email:</span>
              <span className="truncate max-w-[140px] text-slate-700">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Phone:</span>
              <span className="font-mono text-slate-700">{user?.phone || 'Not set'}</span>
            </div>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Institutional Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Official Phone (10 Digits)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      pattern="[0-9]{10}"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1437]/20"
                    />
                  </div>
                </div>
              </div>

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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Current Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-sm"
                    />
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
