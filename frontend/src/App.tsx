import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './components/auth/Login';
import { CreateOrganization } from './components/auth/CreateOrganization';
import { Announcements } from './components/shared/Announcements';

// Admin Pages
import { AdminDashboard } from './components/admin/AdminDashboard';
import { HostelManagement } from './components/admin/HostelManagement';
import { RoomManagement } from './components/admin/RoomManagement';
import { StudentManagement } from './components/admin/StudentManagement';
import { StaffManagement } from './components/admin/StaffManagement';
import { MenuManagement } from './components/admin/MenuManagement';
import { IssueTracking } from './components/admin/IssueTracking';
import { VisitorLogsManagement } from './components/admin/VisitorLogsManagement';
import { HMSProfile } from './components/admin/HMSProfile';

// Warden Dedicated Pages
import { WardenDashboard } from './components/warden/WardenDashboard';
import { WardenResidentManagement } from './components/warden/WardenResidentManagement';
import { WardenGatePassManagement } from './components/warden/WardenGatePassManagement';
import { WardenIssueManagement } from './components/warden/WardenIssueManagement';
import { WardenVisitorLogs } from './components/warden/WardenVisitorLogs';

// Security Pages
import { GatePassScanner } from './components/security/GatePassScanner';

// Student Dedicated Pages
import { StudentDashboard } from './components/student/StudentDashboard';
import { StudentGatePasses } from './components/student/StudentGatePasses';
import { StudentIssues } from './components/student/StudentIssues';
import { StudentMeals } from './components/student/StudentMeals';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Route */}
            <Route path="/login" element={<Login />} />
            <Route path="/create-organization" element={<CreateOrganization />} />

            {/* Root Redirect to Login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Admin Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/hostels" element={<HostelManagement />} />
              <Route path="/admin/rooms" element={<RoomManagement />} />
              <Route path="/admin/students" element={<StudentManagement />} />
              <Route path="/admin/staff" element={<StaffManagement />} />
              <Route path="/admin/menu" element={<MenuManagement />} />
              <Route path="/admin/issues" element={<IssueTracking />} />
              <Route path="/admin/gatepass" element={<WardenGatePassManagement />} />
              <Route path="/admin/visitors" element={<VisitorLogsManagement />} />
              <Route path="/admin/profile" element={<HMSProfile />} />
              <Route path="/admin/announcements" element={<Announcements />} />
            </Route>

            {/* Warden Protected Routes (Dedicated Modules matching reference architecture) */}
            <Route element={<ProtectedRoute allowedRoles={['WARDEN']} />}>
              <Route path="/warden/dashboard" element={<WardenDashboard />} />
              <Route path="/warden/residents" element={<StudentManagement />} />
              <Route path="/warden/rooms" element={<RoomManagement />} />
              <Route path="/warden/menu" element={<MenuManagement />} />
              <Route path="/warden/passes" element={<WardenGatePassManagement />} />
              <Route path="/warden/issues" element={<WardenIssueManagement />} />
              <Route path="/warden/visitors" element={<WardenVisitorLogs />} />
              <Route path="/warden/profile" element={<HMSProfile />} />
              <Route path="/warden/announcements" element={<Announcements />} />
            </Route>

            {/* Security Guard Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['SECURITY']} />}>
              <Route path="/security/scanner" element={<GatePassScanner />} />
              <Route path="/security/visitors" element={<VisitorLogsManagement />} />
              <Route path="/security/profile" element={<HMSProfile />} />
              <Route path="/security/announcements" element={<Announcements />} />
            </Route>

            {/* Student Resident Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/passes" element={<StudentGatePasses />} />
              <Route path="/student/issues" element={<StudentIssues />} />
              <Route path="/student/meals" element={<StudentMeals />} />
              <Route path="/student/profile" element={<HMSProfile />} />
              <Route path="/student/announcements" element={<Announcements />} />
            </Route>

            {/* Catch-all Wildcard Route */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
