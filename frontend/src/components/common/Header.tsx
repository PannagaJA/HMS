import React from 'react';
import { User as UserIcon, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'WARDEN':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'SECURITY':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <header className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-slate-200/80 bg-white sticky top-0 z-10 shrink-0">
      {/* Mobile Hamburger Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Open Sidebar Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Right User Badge Pill */}
      <div className="flex items-center gap-2 sm:gap-3 pl-2.5 sm:pl-3 pr-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-full shadow-sm hover:bg-slate-100/80 transition-colors">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-4 h-4" />
          )}
        </div>
        <div className="text-left leading-tight pr-1">
          <div className="text-xs font-bold text-slate-800">
            {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user?.username || 'Administrator')}
          </div>
          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider hidden sm:block">
            {user?.role || 'PORTAL'}
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadge(user?.role)}`}>
          {user?.role || 'ADMIN'}
        </span>
      </div>
    </header>
  );
};
