import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Login } from './components/auth/Login';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { HostelManagement } from './components/admin/HostelManagement';
import { RoomManagement } from './components/admin/RoomManagement';
import { StudentManagement } from './components/admin/StudentManagement';
import { OutsideStudentManagement } from './components/admin/OutsideStudentManagement';
import { StaffManagement } from './components/admin/StaffManagement';
import { MenuManagement } from './components/admin/MenuManagement';
import { MessBillingManagement } from './components/admin/MessBillingManagement';
import { IssueTracking } from './components/admin/IssueTracking';
import { VisitorLogsManagement } from './components/admin/VisitorLogsManagement';
import { WardenGatePassManagement } from './components/warden/WardenGatePassManagement';
import { GatePassScanner } from './components/security/GatePassScanner';
import { StudentDashboard } from './components/student/StudentDashboard';

export const App: React.FC = () => {
  const { user } = useAuth();

  const getDefaultRedirect = () => {
    if (!user) return <Navigate to="/login" replace />;
    if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'WARDEN') return <Navigate to="/warden/dashboard" replace />;
    if (user.role === 'SECURITY') return <Navigate to="/security/scanner" replace />;
    return <Navigate to="/student/dashboard" replace />;
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={user ? getDefaultRedirect() : <Login />} />

        {/* HMS Admin Suite */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/hostels" element={<HostelManagement />} />
          <Route path="/admin/rooms" element={<RoomManagement />} />
          <Route path="/admin/students" element={<StudentManagement />} />
          <Route path="/admin/outside-students" element={<OutsideStudentManagement />} />
          <Route path="/admin/staff" element={<StaffManagement />} />
          <Route path="/admin/menu" element={<MenuManagement />} />
          <Route path="/admin/billing" element={<MessBillingManagement />} />
          <Route path="/admin/issues" element={<IssueTracking />} />
          <Route path="/admin/gatepass" element={<WardenGatePassManagement />} />
          <Route path="/admin/visitors" element={<VisitorLogsManagement />} />
        </Route>

        {/* Warden Portal */}
        <Route element={<ProtectedRoute allowedRoles={['WARDEN', 'ADMIN']} />}>
          <Route path="/warden/dashboard" element={<AdminDashboard />} />
          <Route path="/warden/gatepass" element={<WardenGatePassManagement />} />
          <Route path="/warden/rooms" element={<RoomManagement />} />
        </Route>

        {/* Security Gate Terminal */}
        <Route element={<ProtectedRoute allowedRoles={['SECURITY', 'ADMIN']} />}>
          <Route path="/security/scanner" element={<GatePassScanner />} />
        </Route>

        {/* Student Resident Portal */}
        <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
        </Route>

        {/* Root Fallback */}
        <Route path="*" element={getDefaultRedirect()} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
