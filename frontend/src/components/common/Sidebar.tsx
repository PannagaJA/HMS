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
  QrCode,
  User,
  LogOut,
  X
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

  // Warden Nav Items matching reference Stalight architecture
  const wardenNavItems = [
    { path: '/warden/dashboard', name: 'Warden Dashboard', icon: LayoutDashboard },
    { path: '/warden/residents', name: 'Resident Students', icon: Users },
    { path: '/warden/menu', name: 'Mess & Dining Menu', icon: UtensilsCrossed },
    { path: '/warden/passes', name: 'Gate Pass Review', icon: Ticket },
    { path: '/warden/issues', name: 'Hostel Issues', icon: Wrench },
    { path: '/warden/visitors', name: 'Visitor Register', icon: ClipboardList },
    { path: '/warden/profile', name: 'My Profile', icon: User },
  ];

  // Security Guard Nav Items with dedicated Student Movement & QR Scanner
  const securityNavItems = [
    { path: '/security/scanner', name: 'Student Gate Movement & QR', icon: QrCode },
    { path: '/security/visitors', name: 'Visitor Register', icon: ClipboardList },
    { path: '/security/profile', name: 'My Profile', icon: User },
  ];

  // Student Nav Items with dedicated pages matching Stalight
  const studentNavItems = [
    { path: '/student/dashboard', name: 'Overview & Room', icon: LayoutDashboard },
    { path: '/student/passes', name: 'My Gate Passes', icon: Ticket },
    { path: '/student/issues', name: 'Maintenance Issues', icon: Wrench },
    { path: '/student/meals', name: 'Mess & Dining', icon: UtensilsCrossed },
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

  const navItems = getNavItems();

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    if (onClose) onClose();
    await logout();
  };

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Pinned Header */}
        <div className="h-16 px-6 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0D3833] text-white flex items-center justify-center font-bold text-base shadow-sm">
              H
            </div>
            <div>
              <span className="font-bold text-slate-800 tracking-tight text-sm block leading-none">HostelDesk</span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block mt-1">Enterprise HMS</span>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Middle Navigation Section */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto min-h-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (onClose) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-150 group ${
                    isActive
                      ? 'bg-[#0D3833] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Pinned Bottom Sign Out Section */}
        <div className="p-3 border-t border-slate-200/80 shrink-0">
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-semibold text-rose-600 bg-rose-50/60 hover:bg-rose-100/80 border border-rose-100 transition-all duration-150 cursor-pointer group"
          >
            <LogOut className="w-4 h-4 text-rose-500 group-hover:text-rose-700 transition-colors" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Sign Out Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Confirm Sign Out</h3>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to end your current session? You will be redirected to the login page.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 py-2.5 rounded-full bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
