import React, { useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Menu, Bell, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';
import { Sidebar } from '../common/Sidebar';
import { announcementService } from '../../services/announcementService';
import { supabase } from '../../lib/supabase';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!user) return;
    
    // Initial fetch
    announcementService.getUnreadCount(user.role, user.id).then(setUnreadCount);

    // Request Notification permissions for the OS-level ping
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Subscribe to new announcements
    const channel = supabase
      .channel('public:announcements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        console.log('Realtime INSERT received in ProtectedRoute:', payload);
        const newAnnouncement = payload.new;
        if (newAnnouncement.target_roles && newAnnouncement.target_roles.includes(user.role)) {
          console.log('Target role matches! Incrementing unread count.');
          setUnreadCount(prev => prev + 1);

          // Play custom pleasant chime sound
          const audio = new Audio('/notification.wav');
          audio.play().catch(e => console.log('Audio autoplay blocked:', e));

          // OS Notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Announcement', {
              body: newAnnouncement.title,
              icon: '/amc-favicon.png'
            });
          }
        }
      })
      .subscribe((status) => {
        console.log('ProtectedRoute WebSocket status:', status);
      });

    // Listen for custom read event
    const handleRead = () => {
      setUnreadCount(prev => Math.max(0, prev - 1));
    };
    window.addEventListener('announcementRead', handleRead);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('announcementRead', handleRead);
    };
  }, [user]);

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
        {/* Unified Top App Bar */}
        <div className="h-16 px-4 sm:px-6 lg:px-8 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between shrink-0 z-30">
          
          {/* Left Side: Mobile Menu & Logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 -ml-2 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-colors cursor-pointer active:scale-95 shadow-2xs"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Left Side: Welcome Text */}
          {user?.first_name && (
            <div className="flex flex-col items-start ml-2 lg:ml-2 mt-0.5 min-w-0">
              <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">
                Welcome Back
              </span>
              <span className="text-[12px] sm:text-[14px] font-semibold text-slate-800 leading-none truncate max-w-[120px] sm:max-w-none">
                {user.first_name} {user.last_name || ''}
              </span>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Right Side: Role Badge, Notifications, Profile */}
          <div className="flex items-center gap-3 sm:gap-4 ml-auto">
            {/* Role Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D1F2EA] text-teal-950 text-[10px] font-bold border border-teal-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse" />
              <span>{user?.role || 'PORTAL'}</span>
            </div>

            <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>

            {/* Notification Bell */}
            <button 
              onClick={() => navigate(`/${user?.role?.toLowerCase() || 'student'}/announcements`)}
              className="relative p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer" 
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* User Profile */}
            <button 
              onClick={() => navigate(`/${user?.role?.toLowerCase() || 'student'}/profile`)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200" 
              aria-label="User Profile"
            >
              <div className="w-8 h-8 rounded-full bg-[#0D3833] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {user?.username ? user.username.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
              </div>
            </button>
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
