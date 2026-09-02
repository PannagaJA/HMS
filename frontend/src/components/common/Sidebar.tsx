import React from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  BedDouble, 
  Users, 
  UserCheck, 
  UtensilsCrossed, 
  CreditCard, 
  Wrench, 
  ShieldCheck, 
  KeyRound, 
  LogOut,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NavLink, useNavigate } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || 'ADMIN';

  const renderNavSection = (title: string, items: { path: string; label: string; icon: React.ReactNode }[]) => (
    <div className="mb-5">
      <div className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-[#0D3833] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {item.icon}
                </div>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );

  let mainItems: { path: string; label: string; icon: React.ReactNode }[] = [];
  let residentialItems: { path: string; label: string; icon: React.ReactNode }[] = [];
  let diningAndOpsItems: { path: string; label: string; icon: React.ReactNode }[] = [];

  if (role === 'ADMIN') {
    mainItems = [
      { path: '/admin/dashboard', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    ];
    residentialItems = [
      { path: '/admin/hostels', label: 'Hostel Master', icon: <Building2 className="w-3.5 h-3.5" /> },
      { path: '/admin/rooms', label: 'Room Matrix', icon: <BedDouble className="w-3.5 h-3.5" /> },
      { path: '/admin/students', label: 'Residents', icon: <Users className="w-3.5 h-3.5" /> },
      { path: '/admin/outside-students', label: 'Outside Residents', icon: <Users className="w-3.5 h-3.5" /> },
      { path: '/admin/staff', label: 'Staff & Wardens', icon: <UserCheck className="w-3.5 h-3.5" /> },
    ];
    diningAndOpsItems = [
      { path: '/admin/menu', label: 'Mess Planner', icon: <UtensilsCrossed className="w-3.5 h-3.5" /> },
      { path: '/admin/billing', label: 'Mess Billing', icon: <CreditCard className="w-3.5 h-3.5" /> },
      { path: '/admin/issues', label: 'Issue Tracker', icon: <Wrench className="w-3.5 h-3.5" /> },
      { path: '/admin/gatepass', label: 'Gate Passes', icon: <KeyRound className="w-3.5 h-3.5" /> },
      { path: '/admin/visitors', label: 'Visitor Logs', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    ];
  } else if (role === 'WARDEN') {
    mainItems = [{ path: '/warden/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> }];
    residentialItems = [
      { path: '/warden/gatepass', label: 'Gate Pass Approvals', icon: <KeyRound className="w-3.5 h-3.5" /> },
      { path: '/warden/rooms', label: 'Hostel Rooms', icon: <BedDouble className="w-3.5 h-3.5" /> },
    ];
  } else if (role === 'SECURITY') {
    mainItems = [{ path: '/security/scanner', label: 'Pass Scanner', icon: <KeyRound className="w-3.5 h-3.5" /> }];
  } else {
    mainItems = [{ path: '/student/dashboard', label: 'My Portal', icon: <LayoutDashboard className="w-3.5 h-3.5" /> }];
  }

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-slate-200/80 p-4 flex flex-col justify-between select-none">
      <div>
        <div className="flex items-center gap-2.5 px-3 py-2 mb-6">
          <div className="w-9 h-9 rounded-2xl bg-[#0D3833] text-white flex items-center justify-center font-bold text-base shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="font-bold text-slate-900 leading-tight text-sm">HostelDesk</div>
            <div className="text-[11px] text-slate-400 font-medium">Enterprise HMS</div>
          </div>
        </div>

        {renderNavSection('MAIN MENU', mainItems)}
        {residentialItems.length > 0 && renderNavSection('HOSTEL & RESIDENTS', residentialItems)}
        {diningAndOpsItems.length > 0 && renderNavSection('DINING & OPERATIONS', diningAndOpsItems)}
      </div>

      <div className="pt-3 border-t border-slate-100">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-full text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
            <LogOut className="w-3.5 h-3.5" />
          </div>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
