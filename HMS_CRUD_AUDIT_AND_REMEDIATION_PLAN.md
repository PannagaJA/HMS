# 🏨 Hostel Management System (HMS) — Comprehensive CRUD Audit & Remediation Plan

> **Generated on**: September 21, 2026  
> **Workspace**: `d:\AMC\HMS`  
> **Document Version**: 1.0.0  
> **Status**: Comprehensive Functional Audit & Fix Specifications

---

## 📑 Table of Contents

1. [System Architecture & Data Flow Overview](#1-system-architecture--data-flow-overview)
2. [Role-Wise CRUD Functionality Matrix](#2-role-wise-crud-functionality-matrix)
   - [👑 1. Admin Role](#-1-admin-role-admin)
   - [🛡️ 2. Warden Role](#-2-warden-role-warden)
   - [👮 3. Security Guard Role](#-3-security-guard-role-security)
   - [🎓 4. Student Resident Role](#-4-student-resident-role-student)
3. [Detailed Faults, Current State & Required Fixes](#3-detailed-faults-current-state--required-fixes)
   - [❌ Issue 1: Password Change Handler Missing in API Client](#issue-1-password-change-handler-missing-in-api-client)
   - [⚠️ Issue 2: Room Number & Floor Dropped in Room Edit Update](#issue-2-room-number--floor-dropped-in-room-edit-update)
   - [⚠️ Issue 3: Registered UUID Staff Profile Editing Restriction](#issue-3-registered-uuid-staff-profile-editing-restriction)
   - [⚠️ Issue 4: Warden Visitor Check-In Direct DB Query Bypassing Org Context](#issue-4-warden-visitor-check-in-direct-db-query-bypassing-org-context)
4. [Files Affected & Code Change Reference Matrix](#4-files-affected--code-change-reference-matrix)
5. [End-to-End Verification & Testing Protocol](#5-end-to-end-verification--testing-protocol)

---

## 1. System Architecture & Data Flow Overview

The HMS application utilizes a hybrid architecture:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query
- **State & Context**: [AuthContext.tsx](file:///d:/AMC/HMS/frontend/src/context/AuthContext.tsx) (Session & Role management), [NotificationContext.tsx](file:///d:/AMC/HMS/frontend/src/context/NotificationContext.tsx) (Feedback & Modals)
- **API & Adapter Layer**: [authService.ts](file:///d:/AMC/HMS/frontend/src/utils/authService.ts) provides a unified `apiClient` mapping REST-like endpoints to dedicated domain services ([adminService.ts](file:///d:/AMC/HMS/frontend/src/services/adminService.ts), [wardenService.ts](file:///d:/AMC/HMS/frontend/src/services/wardenService.ts), [securityService.ts](file:///d:/AMC/HMS/frontend/src/services/securityService.ts), [studentService.ts](file:///d:/AMC/HMS/frontend/src/services/studentService.ts), [facilitiesService.ts](file:///d:/AMC/HMS/frontend/src/services/facilitiesService.ts), [announcementService.ts](file:///d:/AMC/HMS/frontend/src/services/announcementService.ts)).
- **Backend & Database**: Supabase PostgreSQL with Row Level Security (RLS), Realtime Channels, PostgreSQL Functions (RPCs), and Deno Edge Functions (`enroll-staff`, `create-organization`, `reset-password`).

```mermaid
graph TD
    UI[Frontend React Pages] --> API[apiClient Adapter (authService.ts)]
    API --> Services[Domain Services (admin, warden, student, security, facilities)]
    Services --> DB[(Supabase PostgreSQL)]
    Services --> RPC[PostgreSQL Stored Procedures]
    Services --> Edge[Deno Edge Functions]
    DB --> Realtime[Supabase Realtime WebSocket Channels]
    Realtime --> UI
```

---

## 2. Role-Wise CRUD Functionality Matrix

### 👑 1. Admin Role (`/admin/*`)

| Frontend Page | Entity / Resource | CRUD | Action Description | Primary Code Path | Backend Target | Status |
| :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| [AdminDashboard.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/AdminDashboard.tsx) | Analytics | **R** | Aggregates beds, active allocations, pending passes, open issues | [adminService.ts:L12](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L12) | `hostels`, `beds`, `room_allocations`, `gate_passes`, `issues` | ✅ Working |
| [HostelManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/HostelManagement.tsx) | Hostel Block | **C** | Creates new hostel block with gender and floor count | [adminService.ts:L101](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L101) | `hostels` table + `warden_hostel_assignments` | ✅ Working |
| | Hostel Block | **R** | Lists active blocks, room counts, capacity, and current occupancy | [adminService.ts:L47](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L47) | `hostels` table with nested rooms & allocations | ✅ Working |
| | Hostel Block | **U** | Updates block name, gender, floors, warden, caretaker | [adminService.ts:L141](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L141) | `hostels` update + assignment sync | ✅ Working |
| | Hostel Block | **D** | Soft deletes hostel block | [adminService.ts:L181](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L181) | `hostels.is_active = false` | ✅ Working |
| [RoomManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/RoomManagement.tsx) | Single Room | **C** | Adds individual room with bed slot generation | [authService.ts:L461](file:///d:/AMC/HMS/frontend/src/utils/authService.ts#L461) | `create_room_with_beds` RPC / `hostel_rooms` + `beds` | ✅ Working |
| | Bulk Rooms | **C** | Batch generates rooms per floor with automated numbering | [authService.ts:L375](file:///d:/AMC/HMS/frontend/src/utils/authService.ts#L375) | `hostel_rooms` + `beds` bulk insert | ✅ Working |
| | Room Matrix | **R** | Filterable floor matrix showing occupants, beds, and vacancy | [adminService.ts:L194](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L194) | `hostel_rooms`, `beds`, `room_allocations`, `students` | ✅ Working |
| | Room Details | **U** | Edits room number, floor, capacity, room type | [authService.ts:L792](file:///d:/AMC/HMS/frontend/src/utils/authService.ts#L792) | `resize_room_capacity` RPC / `hostel_rooms` | ⚠️ **Partial** (See Issue 2) |
| | Room | **D** | Decommissions room and releases physical bed slots | [authService.ts:L958](file:///d:/AMC/HMS/frontend/src/utils/authService.ts#L958) | `decommission_room` RPC / `hostel_rooms.is_active = false` | ✅ Working |
| [StudentManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/StudentManagement.tsx) | Student | **C** | Individual admission with optional instant room allotment | [adminService.ts:L349](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L349) | `enroll-staff` Edge Function + `students` + `allocate_student_room` | ✅ Working |
| | Student Bulk | **C** | Bulk CSV / XLSX drag-and-drop parsing & upsert | [adminService.ts:L432](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L432) | `students` table upsert on `enrollment_no` | ✅ Working |
| | Student Directory | **R** | Paginated resident directory with USN, room, bed, contacts | [adminService.ts:L241](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L241) | `students`, `room_allocations`, `beds`, `hostels` | ✅ Working |
| | Student Record | **U** | Updates student personal details, phone numbers, email | [adminService.ts:L281](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L281) | `students` + `profiles` synchronized update | ✅ Working |
| | Room Allocation | **C (Allot)** | Assigns vacant bed to student resident | [authService.ts:L277](file:///d:/AMC/HMS/frontend/src/utils/authService.ts#L277) | `allocate_student_room` RPC | ✅ Working |
| | Room Vacate | **D (Vacate)** | De-allocates room, vacating physical bed slot | [authService.ts:L335](file:///d:/AMC/HMS/frontend/src/utils/authService.ts#L335) | `vacate_student_room` RPC | ✅ Working |
| [StaffManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/StaffManagement.tsx) | Staff Member | **C** | Enrolls Warden, Caretaker, or Security Guard | [adminService.ts:L524](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L524) | `enroll-staff` Edge Function + `hostel_wardens`/`security_staff` | ✅ Working |
| | Staff Directory | **R** | Tabbed directory merging system profiles with custom staff | [adminService.ts:L490](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L490) | `profiles` (role filtered) + `hostel_wardens` / `caretakers` | ✅ Working |
| | Staff Record | **U** | Edits staff contact details and designations | [adminService.ts:L547](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L547) | `hostel_wardens` / `security_staff` table update | ⚠️ **Partial** (See Issue 3) |
| | Staff Record | **D** | Removes staff profile | [adminService.ts:L556](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L556) | `profiles` / `hostel_wardens` delete | ✅ Working |
| [MenuManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/MenuManagement.tsx) | Food Item | **C** | Adds food item to master catalog | [facilitiesService.ts:L47](file:///d:/AMC/HMS/frontend/src/services/facilitiesService.ts#L47) | `menu_items` table | ✅ Working |
| | Food Item | **R** | Lists food catalog items and active meal types | [facilitiesService.ts:L41](file:///d:/AMC/HMS/frontend/src/services/facilitiesService.ts#L41) | `menu_items` and `meal_types` tables | ✅ Working |
| | Food Item | **U** | Edits food item title, category, veg/non-veg flag | [facilitiesService.ts:L80](file:///d:/AMC/HMS/frontend/src/services/facilitiesService.ts#L80) | `menu_items` table | ✅ Working |
| | Food Item | **D** | Removes food item from catalog | [facilitiesService.ts:L107](file:///d:/AMC/HMS/frontend/src/services/facilitiesService.ts#L107) | `menu_items` table delete | ✅ Working |
| | Weekly Schedule | **U (Save)** | Configures items assigned to a day-of-week meal slot | [facilitiesService.ts:L462](file:///d:/AMC/HMS/frontend/src/services/facilitiesService.ts#L462) | `menus` upsert + `menu_item_links` sync | ✅ Working |
| [IssueTracking.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/IssueTracking.tsx) | Maintenance Issue | **R** | Real-time board of all reported hostel maintenance issues | [wardenService.ts:L305](file:///d:/AMC/HMS/frontend/src/services/wardenService.ts#L305) | `issues`, `issue_updates`, `students`, `hostel_rooms` | ✅ Working |
| | Status Update | **U** | Updates ticket status with notes & updater audit history | [wardenService.ts:L407](file:///d:/AMC/HMS/frontend/src/services/wardenService.ts#L407) | `update_issue_status` RPC + `issue_updates` table | ✅ Working |
| | Updates History | **R** | Timeline modal showing chronological ticket status changes | [wardenService.ts:L204](file:///d:/AMC/HMS/frontend/src/services/wardenService.ts#L204) | `issue_updates` joined with `profiles` | ✅ Working |
| [VisitorLogsManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/VisitorLogsManagement.tsx) | Visitor Log | **C** | Registers visitor check-in with host student association | [securityService.ts:L324](file:///d:/AMC/HMS/frontend/src/services/securityService.ts#L324) | `visitor_logs` insert | ✅ Working |
| | Visitor Log | **R** | Filterable visitor check-in ledger | [securityService.ts:L299](file:///d:/AMC/HMS/frontend/src/services/securityService.ts#L299) | `visitor_logs`, `students`, `hostels` | ✅ Working |
| | Visitor Checkout | **U** | Records checkout exit timestamp | [securityService.ts:L429](file:///d:/AMC/HMS/frontend/src/services/securityService.ts#L429) | `checkout_visitor` RPC / `visitor_logs` update | ✅ Working |
| [Announcements.tsx](file:///d:/AMC/HMS/frontend/src/components/shared/Announcements.tsx) | Circular | **C** | Publishes role-targeted and hostel-scoped announcements | [announcementService.ts:L163](file:///d:/AMC/HMS/frontend/src/services/announcementService.ts#L163) | `announcements` table | ✅ Working |
| | Circular | **R** | Real-time received & sent announcement tabs | [announcementService.ts:L59](file:///d:/AMC/HMS/frontend/src/services/announcementService.ts#L59) | `announcements` + `announcements_read` | ✅ Working |
| | Circular | **D** | Deletes announcement broadcast | [announcementService.ts:L151](file:///d:/AMC/HMS/frontend/src/services/announcementService.ts#L151) | `announcements` table delete | ✅ Working |
| | Read Status | **U** | Marks circular as read by user | [announcementService.ts:L192](file:///d:/AMC/HMS/frontend/src/services/announcementService.ts#L192) | `announcements_read` insert | ✅ Working |
| [HMSProfile.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/HMSProfile.tsx) | Profile Details | **U** | Updates name, email, phone | [authService.ts:L825](file:///d:/AMC/HMS/frontend/src/utils/authService.ts#L825) | `profiles` table update | ✅ Working |
| | Password | **U** | Changes account password | [authService.ts:L275](file:///d:/AMC/HMS/frontend/src/utils/authService.ts#L275) | `supabase.auth.updateUser` | ❌ **Broken** (See Issue 1) |

---

### 🛡️ 2. Warden Role (`/warden/*`)

| Frontend Page | Entity / Resource | CRUD | Action Description | Primary Code Path | Backend Target | Status |
| :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| [WardenDashboard.tsx](file:///d:/AMC/HMS/frontend/src/components/warden/WardenDashboard.tsx) | Scoped Telemetry | **R** | Metrics strictly scoped to warden's assigned blocks | [wardenService.ts:L13](file:///d:/AMC/HMS/frontend/src/services/wardenService.ts#L13) | `warden_hostel_assignments`, `hostel_rooms`, `gate_passes` | ✅ Working |
| | Floor Rooms | **R** | Floor-by-floor room grid in assigned hostel block | [authService.ts:L114](file:///d:/AMC/HMS/frontend/src/utils/authService.ts#L114) | `hostel_rooms`, `beds`, `room_allocations` | ✅ Working |
| [WardenResidentManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/warden/WardenResidentManagement.tsx) | Resident Directory | **C, R, U, D** | Scoped student admission, room allocation, vacating | [StudentManagement.tsx:L102](file:///d:/AMC/HMS/frontend/src/components/admin/StudentManagement.tsx#L102) | Same as Student Management (Scoped) | ✅ Working |
| [RoomManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/RoomManagement.tsx) | Block Rooms | **C, R, U, D** | Scoped room creation, capacity resize, decommission | [RoomManagement.tsx:L72](file:///d:/AMC/HMS/frontend/src/components/admin/RoomManagement.tsx#L72) | Same as Room Management (Scoped) | ✅ Working |
| [MenuManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/MenuManagement.tsx) | Dining Planner | **C, R, U, D** | Scoped dining schedule and meal slot config | [MenuManagement.tsx:L68](file:///d:/AMC/HMS/frontend/src/components/admin/MenuManagement.tsx#L68) | Same as Menu Management (Scoped) | ✅ Working |
| [WardenGatePassManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/warden/WardenGatePassManagement.tsx) | Gate Passes | **R** | Real-time gate pass approval desk scoped to block | [wardenService.ts:L138](file:///d:/AMC/HMS/frontend/src/services/wardenService.ts#L138) | `gate_passes` table with real-time channel | ✅ Working |
| | Pass Approval | **U (Approve)** | Approves student outpass application with optional note | [wardenService.ts:L169](file:///d:/AMC/HMS/frontend/src/services/wardenService.ts#L169) | `approve_gate_pass` RPC / `gate_passes` update | ✅ Working |
| | Pass Rejection | **U (Reject)** | Rejects outpass application with mandatory note | [wardenService.ts:L169](file:///d:/AMC/HMS/frontend/src/services/wardenService.ts#L169) | `reject_gate_pass` RPC / `gate_passes` update | ✅ Working |
| [WardenIssueManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/warden/WardenIssueManagement.tsx) | Maintenance Board | **R** | Real-time issue board scoped to block | [wardenService.ts:L305](file:///d:/AMC/HMS/frontend/src/services/wardenService.ts#L305) | `issues`, `issue_updates` table | ✅ Working |
| | Status Update | **U** | Updates issue status and appends warden audit note | [wardenService.ts:L407](file:///d:/AMC/HMS/frontend/src/services/wardenService.ts#L407) | `update_issue_status` RPC + `issue_updates` table | ✅ Working |
| | Updates History | **R** | Timeline of updates and status progression | [wardenService.ts:L204](file:///d:/AMC/HMS/frontend/src/services/wardenService.ts#L204) | `issue_updates` table query | ✅ Working |
| [WardenVisitorLogs.tsx](file:///d:/AMC/HMS/frontend/src/components/warden/WardenVisitorLogs.tsx) | Visitor Log | **C** | Registers visitor check-in for block residents | [WardenVisitorLogs.tsx:L95](file:///d:/AMC/HMS/frontend/src/components/warden/WardenVisitorLogs.tsx#L95) | `visitor_logs` insert | ⚠️ **Partial** (See Issue 4) |
| | Visitor Log | **R** | Visitor ledger scoped to warden's block | [securityService.ts:L299](file:///d:/AMC/HMS/frontend/src/services/securityService.ts#L299) | `visitor_logs` query | ✅ Working |
| | Visitor Checkout | **U** | Marks visitor checkout timestamp | [securityService.ts:L429](file:///d:/AMC/HMS/frontend/src/services/securityService.ts#L429) | `visitor_logs` check-out update | ✅ Working |

---

### 👮 3. Security Guard Role (`/security/*`)

| Frontend Page | Entity / Resource | CRUD | Action Description | Primary Code Path | Backend Target | Status |
| :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| [GatePassScanner.tsx](file:///d:/AMC/HMS/frontend/src/components/security/GatePassScanner.tsx) | Pass Verification | **R (Verify)** | Camera scanner / USN search verifying approved pass & curfew | [securityService.ts:L33](file:///d:/AMC/HMS/frontend/src/services/securityService.ts#L33) | `gate_passes` table verification | ✅ Working |
| | Gate Exit | **U (Exit)** | Stamps physical departure timestamp (`actual_exit_time`) | [securityService.ts:L197](file:///d:/AMC/HMS/frontend/src/services/securityService.ts#L197) | `log_gate_movement` RPC (`EXIT`) | ✅ Working |
| | Gate Return | **U (Entry)** | Stamps physical return timestamp (`actual_entry_time`) & completes pass | [securityService.ts:L197](file:///d:/AMC/HMS/frontend/src/services/securityService.ts#L197) | `log_gate_movement` RPC (`ENTRY`) | ✅ Working |
| | Movement Ledger | **R** | Live tabs for "Currently Outside" vs "Completed Departures" | [securityService.ts:L12](file:///d:/AMC/HMS/frontend/src/services/securityService.ts#L12) | `gate_passes` real-time channel | ✅ Working |
| [VisitorLogsManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/VisitorLogsManagement.tsx) | Visitor Log | **C, R, U** | Checkpoint visitor check-in, tracking, and check-out | [securityService.ts:L324](file:///d:/AMC/HMS/frontend/src/services/securityService.ts#L324) | `visitor_logs` insert / update | ✅ Working |

---

### 🎓 4. Student Resident Role (`/student/*`)

| Frontend Page | Entity / Resource | CRUD | Action Description | Primary Code Path | Backend Target | Status |
| :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| [StudentDashboard.tsx](file:///d:/AMC/HMS/frontend/src/components/student/StudentDashboard.tsx) | My Profile & Room | **R** | Resident info, room allocation, bed number, and roommates | [studentService.ts:L13](file:///d:/AMC/HMS/frontend/src/services/studentService.ts#L13) | `students`, `room_allocations`, `beds`, `hostels` | ✅ Working |
| [StudentGatePasses.tsx](file:///d:/AMC/HMS/frontend/src/components/student/StudentGatePasses.tsx) | Gate Pass | **C** | Applies for departure outpass with dates, times, and reason | [studentService.ts:L220](file:///d:/AMC/HMS/frontend/src/services/studentService.ts#L220) | `gate_passes` insert (`status = pending`) | ✅ Working |
| | My Passes | **R** | List of student's past and active gate passes | [studentService.ts:L149](file:///d:/AMC/HMS/frontend/src/services/studentService.ts#L149) | `gate_passes` query (student scoped) | ✅ Working |
| | Security QR Pass | **R (Display)** | Displays QR code modal with token for guard scanner | [StudentGatePasses.tsx:L144](file:///d:/AMC/HMS/frontend/src/components/student/StudentGatePasses.tsx#L144) | In-memory `QRCodeSVG` with token | ✅ Working |
| [StudentIssues.tsx](file:///d:/AMC/HMS/frontend/src/components/student/StudentIssues.tsx) | Support Ticket | **C** | Reports maintenance issue with photo upload attachment | [facilitiesService.ts:L702](file:///d:/AMC/HMS/frontend/src/services/facilitiesService.ts#L702) | `issues` insert + `issue_updates` initial audit | ✅ Working |
| | My Issues | **R** | List of reported issues with real-time status badges | [facilitiesService.ts:L593](file:///d:/AMC/HMS/frontend/src/services/facilitiesService.ts#L593) | `issues` query (student scoped) | ✅ Working |
| | Updates History | **R** | Timeline of warden responses and progress notes | [wardenService.ts:L204](file:///d:/AMC/HMS/frontend/src/services/wardenService.ts#L204) | `issue_updates` query | ✅ Working |
| [StudentMeals.tsx](file:///d:/AMC/HMS/frontend/src/components/student/StudentMeals.tsx) | Today's Menu | **R** | Today's active dining schedule and food item list | [facilitiesService.ts:L136](file:///d:/AMC/HMS/frontend/src/services/facilitiesService.ts#L136) | `get_today_menu` RPC / `menus` query | ✅ Working |
| | Meal Skip Opt-Out | **C (Skip)** | Opts out of a meal slot for billing rebate calculation | [facilitiesService.ts:L330](file:///d:/AMC/HMS/frontend/src/services/facilitiesService.ts#L330) | `student_meal_skips` upsert | ✅ Working |
| | Rejoin Meal | **D (Unskip)**| Cancels opt-out to participate in meal | [facilitiesService.ts:L411](file:///d:/AMC/HMS/frontend/src/services/facilitiesService.ts#L411) | `student_meal_skips` delete | ✅ Working |

---

## 3. Detailed Faults, Current State & Required Fixes

### ❌ Issue 1: Password Change Handler Missing in API Client

- **Severity**: **HIGH (Functional Bug)**
- **Component**: [HMSProfile.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/HMSProfile.tsx#L85-L96) (Used across Admin, Warden, Security, Student)
- **Adapter**: [authService.ts](file:///d:/AMC/HMS/frontend/src/utils/authService.ts#L275-L696)
- **Current Symptom**:
  When a user enters their current & new password on the Profile screen and clicks **"Update Password"**, the form invokes `apiClient.post('/auth/profile/', { current_password, new_password })`.
  In `authService.ts`, `apiClient.post` does not have a route matching `/auth/profile/`. It falls through to the default `return { data: {} }`. The UI interprets this as a success and displays *"Password changed successfully!"*, but **Supabase Auth password is never updated**.
- **Root Cause**: Missing route handler in `apiClient.post` in [authService.ts](file:///d:/AMC/HMS/frontend/src/utils/authService.ts).
- **Exact Remediation**:
  In [frontend/src/utils/authService.ts](file:///d:/AMC/HMS/frontend/src/utils/authService.ts), add the following block inside `apiClient.post`:

```typescript
    // Password Change Handler for /auth/profile/
    if (endpoint.includes('/auth/profile/') || endpoint.includes('/auth/change-password/')) {
      const newPassword = body?.new_password || body?.password;
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long.');
      }
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        throw new Error(error.message || 'Failed to change password in authentication service.');
      }
      return { data: { success: true, message: 'Password updated successfully in authentication service.' } as T };
    }
```

---

### ⚠️ Issue 2: Room Number & Floor Dropped in Room Edit Update

- **Severity**: **MEDIUM (Data Persistence Gap)**
- **Component**: [RoomManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/RoomManagement.tsx#L226-L234)
- **Adapter**: [authService.ts](file:///d:/AMC/HMS/frontend/src/utils/authService.ts#L792-L822)
- **Current Symptom**:
  When an Administrator or Warden edits an existing room in the Edit Room Modal, they submit `hostel`, `no` (room number), `name`, `floor`, `capacity`, and `room_type`.
  In `authService.ts` (`patch('/hms/rooms/')`), the fallback query only updates `capacity`, `name`, and `room_type`:
  ```typescript
  await supabase.from('hostel_rooms').update({
    capacity: body.capacity,
    ...(body.name ? { name: body.name } : {}),
    ...(body.room_type ? { room_type: body.room_type } : {})
  }).eq('id', roomId);
  ```
  If the user changed the room number `no` (e.g., from `101` to `101-A`) or changed the `floor`, those changes are silently ignored.
- **Root Cause**: `no` and `floor` properties are not passed into the `hostel_rooms` update payload.
- **Exact Remediation**:
  In [frontend/src/utils/authService.ts](file:///d:/AMC/HMS/frontend/src/utils/authService.ts#L808-L817), update the mutation object:

```typescript
        const { data: updated, error } = await supabase
          .from('hostel_rooms')
          .update({
            capacity: body.capacity,
            ...(body.name ? { name: body.name } : {}),
            ...(body.no || body.room_no ? { no: String(body.no || body.room_no).trim() } : {}),
            ...(body.floor !== undefined ? { floor: Number(body.floor) } : {}),
            ...(body.room_type ? { room_type: body.room_type } : {})
          })
          .eq('id', roomId)
          .select()
          .single();
```

---

### ⚠️ Issue 3: Registered UUID Staff Profile Editing Restriction

- **Severity**: **LOW-MEDIUM (UX Restriction)**
- **Component**: [StaffManagement.tsx](file:///d:/AMC/HMS/frontend/src/components/admin/StaffManagement.tsx#L87)
- **Service**: [adminService.ts](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L547-L555) & [adminService.ts:L667-L675](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L667-L675)
- **Current Symptom**:
  In `StaffManagement.tsx`, staff members who were enrolled via Supabase Auth have UUID identifiers. When an Administrator clicks the "Edit" pencil icon on a Warden or Security Guard and clicks Save, `adminService.updateWarden` / `updateSecurityStaff` explicitly throws:
  `"Cannot edit a registered system user from this dashboard."`
- **Root Cause**: `adminService.ts` blocks updates to IDs containing hyphens (`-`), assuming UUIDs are read-only.
- **Exact Remediation**:
  In [frontend/src/services/adminService.ts](file:///d:/AMC/HMS/frontend/src/services/adminService.ts#L547-L555), allow updating the `profiles` table directly:

```typescript
  async updateWarden(id: string | number, payload: Partial<{ name: string; email?: string; phone: string; designation?: string; experience?: number }>) {
    if (typeof id === 'string' && id.includes('-')) {
      const profileUpdate: any = {};
      if (payload.name) {
        const parts = payload.name.trim().split(' ');
        profileUpdate.first_name = parts[0] || '';
        profileUpdate.last_name = parts.slice(1).join(' ') || '';
      }
      if (payload.phone) profileUpdate.phone = payload.phone;
      if (Object.keys(profileUpdate).length > 0) {
        const { data, error } = await supabase.from('profiles').update(profileUpdate).eq('id', id).select().single();
        if (error) throw error;
        return { id, ...payload };
      }
      return { id, ...payload };
    }
    const { data, error } = await supabase.from('hostel_wardens').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
```
*(Apply the matching update pattern to `updateSecurityStaff` as well).*

---

### ⚠️ Issue 4: Warden Visitor Check-In Direct DB Query Bypassing Org Context

- **Severity**: **LOW (Edge Case Consistency)**
- **Component**: [WardenVisitorLogs.tsx](file:///d:/AMC/HMS/frontend/src/components/warden/WardenVisitorLogs.tsx#L104-L113)
- **Current Symptom**:
  In `WardenVisitorLogs.tsx`, `handleCreateLog` runs a raw `supabase.from('visitor_logs').insert(...)` directly from the component without resolving `org_id` or using the centralized `securityService.checkInVisitor()` implementation. If a tenant has strict multi-tenant RLS requiring `org_id`, direct component insert may trigger RLS violations.
- **Root Cause**: Component is duplicating insert logic instead of dispatching to `apiClient.post('/hms/visitor-logs/', ...)`.
- **Exact Remediation**:
  Refactor [WardenVisitorLogs.tsx:L95-L124](file:///d:/AMC/HMS/frontend/src/components/warden/WardenVisitorLogs.tsx#L95-L124) to invoke `apiClient.post('/hms/visitor-logs/', payload)`.

---

## 4. Files Affected & Code Change Reference Matrix

```
frontend/
├── src/
│   ├── api/
│   │   └── apiClient.ts (Re-exports authService apiClient)
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── HMSProfile.tsx (Affected by Issue 1)
│   │   │   ├── HostelManagement.tsx
│   │   │   ├── IssueTracking.tsx
│   │   │   ├── MenuManagement.tsx
│   │   │   ├── RoomManagement.tsx (Affected by Issue 2)
│   │   │   ├── StaffManagement.tsx (Affected by Issue 3)
│   │   │   ├── StudentManagement.tsx
│   │   │   └── VisitorLogsManagement.tsx
│   │   ├── warden/
│   │   │   ├── WardenDashboard.tsx
│   │   │   ├── WardenGatePassManagement.tsx
│   │   │   ├── WardenIssueManagement.tsx
│   │   │   ├── WardenResidentManagement.tsx
│   │   │   └── WardenVisitorLogs.tsx (Affected by Issue 4)
│   │   ├── security/
│   │   │   └── GatePassScanner.tsx
│   │   ├── student/
│   │   │   ├── StudentDashboard.tsx
│   │   │   ├── StudentGatePasses.tsx
│   │   │   ├── StudentIssues.tsx
│   │   │   └── StudentMeals.tsx
│   │   └── shared/
│   │       └── Announcements.tsx
│   ├── services/
│   │   ├── adminService.ts (Modify updateWarden, updateSecurityStaff)
│   │   ├── announcementService.ts
│   │   ├── facilitiesService.ts
│   │   ├── securityService.ts
│   │   ├── studentService.ts
│   │   └── wardenService.ts
│   └── utils/
│       └── authService.ts (Modify apiClient.post for password & apiClient.patch for room no/floor)
```

---

## 5. End-to-End Verification & Testing Protocol

To verify every CRUD operation across all roles after applying the fixes:

### Test Suite 1: Profile & Security (Issue 1 Verification)
1. Log in as any role (`admin@amc.edu` / `warden.aryabhata@amc.edu` / `student`).
2. Navigate to `/admin/profile` (or `/warden/profile`, `/student/profile`).
3. Enter current password and a new password (min 6 characters) & click **"Update Password"**.
4. Log out and immediately log in with the new password.
5. **Expected Result**: Login succeeds with the new password.

### Test Suite 2: Room Number & Floor Editing (Issue 2 Verification)
1. Log in as **ADMIN**.
2. Navigate to `/admin/rooms` and select a hostel block.
3. Click the **Edit (Pencil)** icon on an existing room.
4. Modify the Room Number from `101` to `101-A` and change Floor from `1` to `2`.
5. Click **"Save Changes"**.
6. **Expected Result**: Room list reloads showing `101-A` on Floor 2.

### Test Suite 3: Staff Management UUID Editing (Issue 3 Verification)
1. Log in as **ADMIN** and navigate to `/admin/staff`.
2. Under Chief & Block Wardens, click **Edit** on a warden profile created via Auth.
3. Update their Phone number and Designation.
4. Click **"Save"**.
5. **Expected Result**: Successfully updates profile without throwing *"Cannot edit a registered system user"*.

### Test Suite 4: Complete Lifecycle Walkthrough
- **Student**: Apply for gate pass &rarr; Verify pending status &rarr; Report room issue with image &rarr; Opt-out of Lunch &rarr; View Today's Menu.
- **Warden**: Review student gate pass &rarr; Click **Approve** with note &rarr; Update reported room issue status to `in_progress` &rarr; Add audit note.
- **Security**: Search student USN or scan QR code &rarr; Click **Check Out Student (EXIT)** &rarr; Check ledger &rarr; Click **Check In Student (ENTRY)** &rarr; Verify status becomes `completed`.
- **Admin**: Check `/admin/dashboard` &rarr; Verify live metrics reflecting updated occupancy, resolved issues, and completed movements.

---
*End of Audit and Remediation Plan.*
