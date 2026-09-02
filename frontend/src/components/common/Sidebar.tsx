import React from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

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
    { path: '/warden/passes', name: 'Gate Pass Review', icon: Ticket },
    { path: '/warden/issues', name: 'Hostel Issues', icon: Wrench },
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

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col shrink-0 h-screen select-none overflow-hidden">
      {/* Sticky Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100 shrink-0 bg-white z-10">
        <div className="w-9 h-9 rounded-xl bg-[#0D3833] text-white flex items-center justify-center font-bold text-base shadow-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-300" />
        </div>
        <div>
          <span className="font-bold text-slate-900 tracking-tight text-base block leading-tight">HostelDesk</span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{user?.role || 'PORTAL'}</span>
        </div>
      </div>

      {/* Scrollable Navigation List (No Section Titles) */}
      <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto min-h-0">
        {getNavItems().map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
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
          onClick={logout}
          className="flex items-center gap-3 px-3.5 py-2.5 w-full rounded-full text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
