import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';
import { Sidebar } from '../common/Sidebar';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#F0FDF9] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-[#0D3833] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'WARDEN') return <Navigate to="/warden/dashboard" replace />;
    if (user.role === 'SECURITY') return <Navigate to="/security/scanner" replace />;
    return <Navigate to="/student/dashboard" replace />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F0FDF9]">
      {/* Left Sidebar */}
      <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Sleek Mobile Top App Bar (Only on mobile/tablet < 1024px, hidden on desktop) */}
        <div className="lg:hidden h-14 px-4 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 -ml-1 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-colors cursor-pointer active:scale-95 shadow-2xs"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#0D3833] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                H
              </div>
              <span className="font-bold text-slate-900 tracking-tight text-sm">HostelDesk</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D1F2EA] text-teal-950 text-[10px] font-bold border border-teal-200 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
            <span>{user?.role || 'PORTAL'}</span>
          </div>
        </div>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
