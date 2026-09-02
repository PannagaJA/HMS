import React from 'react';
import { Search, Bell, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC = () => {
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
    <header className="h-20 px-8 flex items-center justify-between border-b border-slate-200/60 bg-[#F0FDF9]/80 backdrop-blur-sm sticky top-0 z-10">
      {/* Search Bar Pill matching reference */}
      <div className="relative w-96">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search student, room, gate pass..."
          className="w-full bg-white pl-11 pr-4 py-2.5 rounded-full text-sm border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0D3833]/20 focus:border-[#0D3833]"
        />
      </div>

      {/* Right User & Actions */}
      <div className="flex items-center gap-5">
        <button className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors relative shadow-sm">
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-2 ring-2 ring-white" />
        </button>

        <div className="flex items-center gap-3 pl-3 pr-2 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-4 h-4" />
            )}
          </div>
          <div className="text-left leading-tight pr-2">
            <div className="text-xs font-bold text-slate-800">
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              {user?.role}
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadge(user?.role)}`}>
            {user?.role}
          </span>
        </div>
      </div>
    </header>
  );
};
