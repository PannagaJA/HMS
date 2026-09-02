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

  const adminNavSections = [
    {
      title: 'OVERVIEW',
      items: [
        { path: '/admin/dashboard', name: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'FACILITIES & RESIDENTS',
      items: [
        { path: '/admin/hostels', name: 'Hostels & Blocks', icon: Building2 },
        { path: '/admin/rooms', name: 'Rooms & Beds', icon: BedDouble },
        { path: '/admin/students', name: 'Resident Directory', icon: Users },
        { path: '/admin/outside-students', name: 'Outside Residents', icon: UserPlus },
        { path: '/admin/staff', name: 'Staff Management', icon: UserCheck },
      ],
    },
    {
      title: 'OPERATIONS & DINING',
      items: [
        { path: '/admin/menu', name: 'Mess & Menu', icon: UtensilsCrossed },
        { path: '/admin/billing', name: 'Mess Billing', icon: Receipt },
        { path: '/admin/issues', name: 'Issue Board', icon: Wrench },
        { path: '/admin/gatepass', name: 'Gate Passes', icon: Ticket },
        { path: '/admin/visitors', name: 'Visitor Logs', icon: ClipboardList },
      ],
    },
    {
      title: 'SETTINGS',
      items: [
        { path: '/admin/profile', name: 'Account & Security', icon: User },
      ],
    },
  ];

  const wardenNavSections = [
    {
      title: 'MAIN MENU',
      items: [
        { path: '/warden/dashboard', name: 'Warden Dashboard', icon: LayoutDashboard },
        { path: '/warden/passes', name: 'Gate Pass Review', icon: Ticket },
        { path: '/warden/issues', name: 'Hostel Issues', icon: Wrench },
        { path: '/warden/profile', name: 'My Profile', icon: User },
      ],
    },
  ];

  const securityNavSections = [
    {
      title: 'GATE OPERATIONS',
      items: [
        { path: '/security/scanner', name: 'Pass Scanner Terminal', icon: QrCode },
        { path: '/security/visitors', name: 'Visitor Register', icon: ClipboardList },
        { path: '/security/profile', name: 'My Profile', icon: User },
      ],
    },
  ];

  const studentNavSections = [
    {
      title: 'STUDENT PORTAL',
      items: [
        { path: '/student/dashboard', name: 'My Residence & Pass', icon: LayoutDashboard },
        { path: '/student/profile', name: 'My Profile', icon: User },
      ],
    },
  ];

  const getSections = () => {
    switch (user?.role) {
      case 'ADMIN': return adminNavSections;
      case 'WARDEN': return wardenNavSections;
      case 'SECURITY': return securityNavSections;
      case 'STUDENT': return studentNavSections;
      default: return [];
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 h-screen select-none">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-[#0D3833] text-white flex items-center justify-center font-bold text-base shadow-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <span className="font-bold text-slate-900 tracking-tight text-base block leading-tight">HostelDesk</span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{user?.role || 'PORTAL'}</span>
          </div>
        </div>

        {/* Dynamic Navigation Sections */}
        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
          {getSections().map((section, sIdx) => (
            <div key={sIdx}>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
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
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logout Footer */}
      <div className="p-4 border-t border-slate-100">
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
