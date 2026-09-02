import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  BedDouble,
  Users,
  UserPlus,
  UserCheck,
  UtensilsCrossed,
  Receipt,
  Wrench,
  Ticket,
  ClipboardList,
  ShieldCheck,
  QrCode,
  User,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const adminNavItems = [
    { path: '/admin/dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/hostels', name: 'Hostels & Blocks', icon: Building2 },
    { path: '/admin/rooms', name: 'Rooms & Beds', icon: BedDouble },
    { path: '/admin/students', name: 'Resident Directory', icon: Users },
    { path: '/admin/outside-students', name: 'Outside Residents', icon: UserPlus },
    { path: '/admin/staff', name: 'Staff Management', icon: UserCheck },
    { path: '/admin/menu', name: 'Mess & Menu', icon: UtensilsCrossed },
    { path: '/admin/billing', name: 'Mess Billing', icon: Receipt },
    { path: '/admin/issues', name: 'Issue Board', icon: Wrench },
    { path: '/admin/gatepass', name: 'Gate Passes', icon: Ticket },
    { path: '/admin/visitors', name: 'Visitor Logs', icon: ClipboardList },
    { path: '/admin/profile', name: 'Account & Security', icon: User },
  ];

  const wardenNavItems = [
    { path: '/warden/dashboard', name: 'Warden Dashboard', icon: LayoutDashboard },
    { path: '/warden/residents', name: 'Resident Students', icon: Users },
    { path: '/warden/passes', name: 'Gate Pass Review', icon: Ticket },
    { path: '/warden/issues', name: 'Hostel Issues', icon: Wrench },
    { path: '/warden/visitors', name: 'Visitor Register', icon: ClipboardList },
    { path: '/warden/profile', name: 'My Profile', icon: User },
  ];

  const securityNavItems = [
    { path: '/security/scanner', name: 'Pass Scanner Terminal', icon: QrCode },
    { path: '/security/visitors', name: 'Visitor Register', icon: ClipboardList },
    { path: '/security/profile', name: 'My Profile', icon: User },
  ];

  const studentNavItems = [
    { path: '/student/dashboard', name: 'My Residence & Pass', icon: LayoutDashboard },
    { path: '/student/profile', name: 'My Profile', icon: User },
  ];

  const getNavItems = () => {
    switch (user?.role) {
      case 'ADMIN': return adminNavItems;
      case 'WARDEN': return wardenNavItems;
      case 'SECURITY': return securityNavItems;
      case 'STUDENT': return studentNavItems;
      default: return [];
    }
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    if (onClose) onClose();
    logout();
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed lg:static top-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 flex flex-col shrink-0 h-screen select-none overflow-hidden transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sticky Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100 shrink-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0D3833] text-white flex items-center justify-center font-bold text-base shadow-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-base block leading-tight">HostelDesk</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{user?.role || 'PORTAL'}</span>
            </div>
          </div>

          {/* Close button on Mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation List */}
        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto min-h-0">
          {getNavItems().map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#0D3833] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sticky Bottom Sign Out */}
        <div className="p-3.5 border-t border-slate-100 shrink-0 bg-white z-10">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-3 px-4 py-2.5 w-full rounded-2xl text-xs font-semibold text-rose-600 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-100 transition-all cursor-pointer group"
          >
            <LogOut className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Dialog */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in duration-150 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Confirm Sign Out</h3>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to end your current session? You will need to log in again to access the portal.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 px-4 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
