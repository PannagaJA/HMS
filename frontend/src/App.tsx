import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './components/auth/Login';

// Admin Pages
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
import { HMSProfile } from './components/admin/HMSProfile';

// Warden Pages
import { WardenGatePassManagement } from './components/warden/WardenGatePassManagement';

// Security Pages
import { GatePassScanner } from './components/security/GatePassScanner';

// Student Pages
import { StudentDashboard } from './components/student/StudentDashboard';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Route */}
          <Route path="/login" element={<Login />} />

          {/* Root Redirect to Login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Admin Protected Routes */}
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
            <Route path="/admin/profile" element={<HMSProfile />} />
          </Route>

          {/* Warden Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['WARDEN']} />}>
            <Route path="/warden/dashboard" element={<AdminDashboard />} />
            <Route path="/warden/passes" element={<WardenGatePassManagement />} />
            <Route path="/warden/issues" element={<IssueTracking />} />
            <Route path="/warden/profile" element={<HMSProfile />} />
          </Route>

          {/* Security Guard Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['SECURITY']} />}>
            <Route path="/security/scanner" element={<GatePassScanner />} />
            <Route path="/security/visitors" element={<VisitorLogsManagement />} />
            <Route path="/security/profile" element={<HMSProfile />} />
          </Route>

          {/* Student Resident Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/student/profile" element={<HMSProfile />} />
          </Route>

          {/* Catch-all Wildcard Route */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
