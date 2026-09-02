# Stage 0: Comprehensive Repository Audit & Mapping Document

**Audit Date:** September 2, 2026  
**Target Repository:** `d:\AMC\HMS`  
**Migration Goal:** End-to-End Migration from React 19 + Django REST + PostgreSQL to React 19 + Supabase (PostgreSQL 15+, Supabase Auth, PostgREST, Triggers, Views, RPCs, Storage).

---

## 1. Executive Summary & Inventory Overview

The existing repository consists of:
* **Frontend**: React 19 SPA (Vite + TypeScript + Tailwind CSS v4 + Radix UI), communicating via Axios with `http://127.0.0.1:8000/api` through `authService.ts`.
* **Backend**: Django 4.2 REST Framework application with 7 apps (`authentication`, `core`, `hms_admin`, `student`, `warden`, `security`, `mess`).
* **Database**: PostgreSQL (`hms_db` on localhost:5432) with dual-router URLs exposing both `/api/hms/` and module-specific namespaces.
* **Storage**: Avatars and assets are plain external URLs (Unsplash CDN). Cloudflare is 100% absent.
* **Redundant Entities Detected**:
  - `HostelOutsideStudent` model, views, URLs, and frontend screen `OutsideStudentManagement.tsx` are confirmed to be redundant legacy duplication and will be unified into `students`.
  - `MessBilling` model in `apps/mess/models.py` has no views, serializers, or UI, and will be permanently excluded.

---

## 2. Definitive Functionality to Supabase Mapping

| Existing Django Functionality | Target Supabase Component | Target React Component / Service | Required RLS / Authorization Rule | Automated Test Coverage Target |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & Profile** (`apps/authentication`) | `auth.users` + `public.profiles` | `authService.ts`, `AuthContext.tsx`, `Login.tsx`, `HMSProfile.tsx` | Profiles RLS: Self-read/update phone/avatar only; Admin full access | `TEST_AUTH_01`..`04`, `TEST_SEC_001` |
| **Hostel & Course Management** (`apps/hms_admin`) | `public.hostels`, `public.hostel_courses` | `hostelService.ts`, `HostelManagement.tsx` | Hostels: Public/authenticated SELECT; Admin INSERT/UPDATE/DELETE | `TEST_HOSTEL_01` |
| **Warden Assignment** (`apps/hms_admin`) | `public.warden_hostel_assignments` | `StaffManagement.tsx` | Admin-only assignment mutations; Wardens read assigned | `TEST_WARDEN_01`, `SEC-005` |
| **Rooms & Beds Management** (`apps/hms_admin`) | `public.hostel_rooms`, `public.beds` | `roomService.ts`, `RoomManagement.tsx` | Direct mutations REVOKED. Admin RPCs: `create_room_with_beds`, `resize_room_capacity`, `decommission_room` | `SEC-018`, `SEC-019`, `SEC-020` |
| **Student Directory** (`apps/student`) | `public.students` (Unified) | `studentService.ts`, `StudentManagement.tsx` | Students: Self-read personal; Warden assigned-hostel read; Admin full | `TEST_STUDENT_01`..`03`, `SEC-002` |
| **Outside Student Concept** (`apps/student`) | **ELIMINATED** (Unified into `students`) | **DELETED** (`OutsideStudentManagement.tsx`) | N/A | Automated check ensuring 0 outside-student tables |
| **Room Allocation & Bed Assignment** (`apps/student`) | `public.room_allocations` | `allocationService.ts`, `StudentManagement.tsx`, `RoomManagement.tsx` | Direct mutations REVOKED. Managed exclusively via `allocate_student_room` and `vacate_student_room` RPCs | `TEST_ALLOC_01`..`06`, `SEC-003`, `SEC-004` |
| **Maintenance Tickets & Audits** (`apps/warden`) | `public.issues`, `public.issue_updates` | `issueService.ts`, `IssueTracking.tsx`, `WardenIssueManagement.tsx`, `StudentIssues.tsx` | Status updates REVOKED from direct PATCH. Managed via `update_issue_status` RPC + snapshot trigger | `TEST_ISSUE_01`, `SEC-010`, `SEC-011` |
| **Gate Passes & Security QR** (`apps/security`) | `public.gate_passes` | `gatePassService.ts`, `WardenGatePassManagement.tsx`, `StudentGatePasses.tsx`, `GatePassScanner.tsx` | Direct mutations REVOKED. Transitions via `approve_gate_pass`, `reject_gate_pass`, `log_gate_movement` | `TEST_GATE_01`..`05`, `SEC-012`..`016` |
| **Visitor Registers** (`apps/security`) | `public.visitor_logs` | `visitorService.ts`, `VisitorLogsManagement.tsx`, `WardenVisitorLogs.tsx` | Insert by Security; Checkout via `checkout_visitor` RPC | `SEC-009`, `SEC-024` |
| **Mess Menu & Meal Skips** (`apps/mess`) | `public.meal_types`, `public.menus`, `public.student_meal_skips` | `mealService.ts`, `MenuManagement.tsx`, `StudentMeals.tsx` | Menu: Admin/Warden manage; Skips: Student self-service with NOT NULL meal type | `TEST_MEAL_01` |
| **Operational Telemetry** | PostgreSQL Views (`view_admin_dashboard_stats`, `view_warden_dashboard_stats`) | `dashboardService.ts`, `AdminDashboard.tsx`, `WardenDashboard.tsx` | Security-invoker scoped views; no N+1 queries | `TEST_DASH_01`, `TEST_DASH_02` |
| **Avatar Storage** | Supabase Storage Bucket (`avatars`) | `storageService.ts`, `HMSProfile.tsx` | Private bucket with path-restricted RLS (`avatars/{profile_id}/*`) | `TEST_STORAGE_01` |

---

## 3. Frontend Component & Route Audit

### Routes in `frontend/src/App.tsx`:
* `/login` $\rightarrow$ `Login.tsx` (Migrate to Supabase Auth)
* `/admin/dashboard` $\rightarrow$ `AdminDashboard.tsx`
* `/admin/hostels` $\rightarrow$ `HostelManagement.tsx`
* `/admin/rooms` $\rightarrow$ `RoomManagement.tsx`
* `/admin/students` $\rightarrow$ `StudentManagement.tsx`
* `/admin/outside-students` $\rightarrow$ **TO BE REMOVED**
* `/admin/staff` $\rightarrow$ `StaffManagement.tsx`
* `/admin/menu` $\rightarrow$ `MenuManagement.tsx`
* `/admin/issues` $\rightarrow$ `IssueTracking.tsx`
* `/admin/gatepass` $\rightarrow$ `WardenGatePassManagement.tsx`
* `/admin/visitors` $\rightarrow$ `VisitorLogsManagement.tsx`
* `/admin/profile` $\rightarrow$ `HMSProfile.tsx`
* `/warden/*` $\rightarrow$ Warden dedicated screens
* `/security/*` $\rightarrow$ GatePassScanner & Visitor register
* `/student/*` $\rightarrow$ Resident dashboard, passes, issues, dining

---

## 4. Environment & Dependencies Plan

1. Install `@supabase/supabase-js` into `frontend`.
2. Configure `.env` in `frontend` with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Generate comprehensive standalone SQL migrations in `supabase/migrations/` so the full database and all RPCs, views, and RLS policies are version-controlled and cleanly deployable.
