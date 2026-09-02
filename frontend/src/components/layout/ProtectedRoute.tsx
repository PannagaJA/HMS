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

      {/* Main Content Area (Full Height without top navbar) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        {/* Floating Mobile Hamburger Button (Only on small screens when sidebar is hidden) */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-30 p-2.5 rounded-2xl bg-white/90 backdrop-blur-sm border border-slate-200/80 shadow-md text-slate-700 hover:bg-slate-100 cursor-pointer"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
