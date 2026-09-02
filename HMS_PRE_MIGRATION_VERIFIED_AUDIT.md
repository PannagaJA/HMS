# HMS — Deep Verification Audit Before Supabase Migration

**Document Date:** September 2, 2026  
**Auditor:** Antigravity Deep Verification Agent  
**Target Repository:** `d:\AMC\HMS`  
**Audit Mode:** STRICT READ-ONLY VERIFICATION (Zero files changed, zero schemas altered)

---

## 1. Executive Summary

This verification audit critically challenges and cross-examines the findings of the initial pre-migration codebase audit of the **Hostel Management System (HMS)**. 

### Core Takeaways:
1. **Cloudflare Storage Claim Was An Unverified Assumption**: The previous audit accepted Cloudflare file storage based on prompt phrasing. **Code verification confirms zero Cloudflare integration exists in the repository**. Image handling relies entirely on external CDN URLs stored in `models.URLField(max_length=500)` with unused local Django media settings.
2. **Severe Broken Object-Level Authorization (BOLA / IDOR) in Django**:
   - `HostelIssueViewSet.update_status` does NOT enforce role checks (`IsWarden` / `IsHMSAdmin`). Any authenticated student can update any issue's status across any hostel.
   - `GatePassRequestViewSet.log_movement` checks authentication but not the `SECURITY` role.
   - `HostelIssueViewSet.queryset` and `GatePassRequestViewSet.queryset` expose global data across all hostels under `/api/hms/` routes, conflicting with role-scoped filtering intended under `/api/warden/` and `/api/security/`.
3. **High-Risk Race Condition in Room Allocation**:
   - `HostelStudentViewSet.allocate_room` runs non-atomic read-then-write logic without `select_for_update()` or database transactions. Concurrent requests can overbook rooms beyond capacity.
4. **Gate Pass Security Loophole**:
   - Token lookup (`verify_token`) accepts enrollment numbers as fallbacks for UUID tokens. If a student has multiple approved passes or reuses an old enrollment code, it returns the latest approved pass, creating impersonation and QR-bypass risks.
5. **No Automated Test Coverage**:
   - Verification confirmed **0 automated test files** (0 Django tests, 0 React tests, 0 E2E tests).

---

## 2. Verification of Previous Audit Findings

| Finding / Topic | Previous Conclusion | Verification Result | Evidence from Code | Migration Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare Storage** | Cloudflare is used for file/image storage | **NOT CONFIRMED (UNVERIFIED ASSUMPTION)** | Ripgrep search for `cloudflare` yielded 0 occurrences in `requirements.txt`, `.env`, settings, and source code. Image URLs are external Unsplash links stored in `URLField`. | High simplification: No Cloudflare migration needed; Supabase Storage bucket is a fresh addition. |
| **Django & React Tech Stack** | Django 4.2+ DRF + React 19 Vite TypeScript | **CONFIRMED** | `backend/requirements.txt` (`Django>=4.2.0,<5.1.0`), `frontend/package.json` (`react: ^19.2.8`, `vite: ^8.2.2`). | Foundation verified. |
| **PostgreSQL Database** | PostgreSQL default with SQLite fallback | **CONFIRMED** | `settings.py` lines 76–100 (`psycopg2` / `django.db.backends.postgresql` with `USE_SQLITE` flag). | Target schema is already PostgreSQL-native. |
| **SimpleJWT Mutex Auth** | Access + refresh tokens in localStorage with mutex refresh | **CONFIRMED** | `authService.ts` lines 61–93 implements promise-locked `refreshToken()` and localStorage persistence. | Supabase Auth replaces this custom mutex entirely. |
| **Role Enforcement in DRF** | Protected routes and permission classes protect domain resources | **PARTIALLY CONFIRMED (SEVERELY FLAWED)** | Permission classes exist (`apps.core.permissions`), but several critical actions (`update_status`, `log_movement`) omit role checks. Global viewsets under `/api/hms/` lack tenant/hostel scoping. | Supabase RLS is urgently needed to correct existing backend security vulnerabilities. |
| **Room Allocation Logic** | Allocates room and updates vacancy status | **CONFIRMED (RACE CONDITION DETECTED)** | `student/views.py:61-72` performs un-isolated capacity checks without DB row locks or transaction boundaries. | Must be ported to an atomic PostgreSQL stored function (`SERIALIZABLE` or `FOR UPDATE`). |
| **Mess Billing Feature** | Implemented as a domain module | **NOT CONFIRMED (DEAD CODE)** | Model `MessBilling` exists in `mess/models.py`, but has no views, serializers, URLs, or frontend pages. | Can be skipped or deferred during migration. |
| **Dual URL Routing** | Endpoints are registered twice (`/api/hms/` and `/api/<app>/`) | **CONFIRMED** | `hms_project/urls.py` mounts both `/api/hms/` and module routers (`/api/student/`, etc.), causing split security models. | PostgREST resolves this by standardizing table-based endpoints. |

---

## 3. Complete Verified Data Model & Database Schema

All domain models inherit from `TimeStampedModel` (`apps.core.models.py`), providing `created_at` (`DateTimeField(auto_now_add=True)`) and `updated_at` (`DateTimeField(auto_now=True)`).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    VERIFIED DATABASE SCHEMAS                                     │
├────────────────────────────────┬──────────────────────┬──────────────────────────────────────────┤
│ Model & Table                  │ Primary Key          │ Fields, Relationships & Constraints      │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ User                           │ id (BigAutoField)    │ • username (VARCHAR 150, UNIQUE)         │
│ (authentication_user)          │                      │ • email (VARCHAR 254)                    │
│                                │                      │ • password (VARCHAR 128)                 │
│                                │                      │ • role (VARCHAR 20, DEFAULT 'STUDENT')   │
│                                │                      │   CHOICES: ADMIN, WARDEN, SECURITY,      │
│                                │                      │            STUDENT                       │
│                                │                      │ • phone (VARCHAR 20, NULL)               │
│                                │                      │ • avatar_url (VARCHAR 500, NULL)         │
│                                │                      │ • first_name (VARCHAR 150)               │
│                                │                      │ • last_name (VARCHAR 150)                │
│                                │                      │ • is_active (BOOLEAN, DEFAULT TRUE)      │
│                                │                      │ • is_staff, is_superuser (BOOLEAN)       │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ HostelWarden                   │ id (BigAutoField)    │ • user_id (FK -> User, 1:1, NULL, CASCADE│
│ (hms_admin_hostelwarden)       │                      │ • name (VARCHAR 200)                     │
│                                │                      │ • email (VARCHAR 200, NULL)              │
│                                │                      │ • phone (VARCHAR 20, NULL)               │
│                                │                      │ • designation (VARCHAR 100, DEFAULT      │
│                                │                      │   'Hostel Warden')                       │
│                                │                      │ • experience (INT, DEFAULT 0)            │
│                                │                      │ • address (TEXT, NULL)                   │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ HostelCaretaker                │ id (BigAutoField)    │ • user_id (FK -> User, 1:1, NULL, CASCADE│
│ (hms_admin_hostelcaretaker)    │                      │ • name (VARCHAR 200)                     │
│                                │                      │ • email (VARCHAR 200, NULL)              │
│                                │                      │ • phone (VARCHAR 20, NULL)               │
│                                │                      │ • address (TEXT, NULL)                   │
│                                │                      │ • experience (INT, DEFAULT 0)            │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ HostelCourse                   │ id (BigAutoField)    │ • code (VARCHAR 100, UNIQUE)             │
│ (hms_admin_hostelcourse)       │                      │ • name (VARCHAR 200, NULL)               │
│                                │                      │ • room_type (VARCHAR 1, DEFAULT 'D')     │
│                                │                      │   CHOICES: S, D, P, B                    │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ Hostel                         │ id (BigAutoField)    │ • name (VARCHAR 150, UNIQUE)             │
│ (hms_admin_hostel)             │                      │ • gender (VARCHAR 1, DEFAULT 'M')        │
│                                │                      │   CHOICES: M, F, C                       │
│                                │                      │ • floor_count (INT, DEFAULT 1)           │
│                                │                      │ • warden_id (FK -> HostelWarden, NULL,   │
│                                │                      │   SET_NULL)                              │
│                                │                      │ • caretaker_id (FK -> HostelCaretaker,   │
│                                │                      │   NULL, SET_NULL)                        │
│                                │                      │ • address (TEXT, NULL)                   │
│                                │                      │ • M2M: courses (hms_admin_hostel_courses)│
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ HostelRoom                     │ id (BigAutoField)    │ • hostel_id (FK -> Hostel, CASCADE)      │
│ (hms_admin_hostelroom)         │                      │ • no (VARCHAR 20)                        │
│                                │                      │ • name (VARCHAR 50)                      │
│                                │                      │ • room_type (VARCHAR 1, DEFAULT 'D')     │
│                                │                      │   CHOICES: S, D, T, P, B                 │
│                                │                      │ • floor (INT, DEFAULT 0)                 │
│                                │                      │ • capacity (INT, DEFAULT 2)              │
│                                │                      │ • vacant (BOOLEAN, DEFAULT TRUE)         │
│                                │                      │ CONSTRAINT: UNIQUE(hostel_id, no)        │
│                                │                      │ INDEX: ordering = ['hostel','floor','no']│
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ HostelStudent                  │ id (BigAutoField)    │ • user_id (FK -> User, 1:1, NULL, CASCADE│
│ (student_hostelstudent)        │                      │ • student_name (VARCHAR 200)             │
│                                │                      │ • father_name (VARCHAR 200, NULL)        │
│                                │                      │ • enrollment_no (VARCHAR 50, UNIQUE)     │
│                                │                      │ • course_id (FK -> HostelCourse, NULL,   │
│                                │                      │   SET_NULL)                              │
│                                │                      │ • dob (DATE, NULL)                       │
│                                │                      │ • gender (VARCHAR 1, DEFAULT 'M')        │
│                                │                      │ • room_id (FK -> HostelRoom, NULL,       │
│                                │                      │   SET_NULL)                              │
│                                │                      │ • bed_number (VARCHAR 10, NULL)          │
│                                │                      │ • room_allotted (BOOLEAN, DEFAULT FALSE) │
│                                │                      │ • no_dues (BOOLEAN, DEFAULT TRUE)        │
│                                │                      │ • guardian_phone (VARCHAR 20, NULL)      │
│                                │                      │ • emergency_contact (VARCHAR 20, NULL)   │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ HostelOutsideStudent           │ id (BigAutoField)    │ • name (VARCHAR 200)                     │
│ (student_hosteloutsidestudent) │                      │ • usn (VARCHAR 50, UNIQUE)               │
│                                │                      │ • outside_college_name (VARCHAR 255)     │
│                                │                      │ • outside_course_name (VARCHAR 255)      │
│                                │                      │ • outside_year (VARCHAR 50, NULL)        │
│                                │                      │ • phone (VARCHAR 20)                     │
│                                │                      │ • email (VARCHAR 254, NULL)              │
│                                │                      │ • father_name (VARCHAR 200, NULL)        │
│                                │                      │ • father_phone (VARCHAR 20, NULL)        │
│                                │                      │ • gender (VARCHAR 1, DEFAULT 'M')        │
│                                │                      │ • hostel_id (FK -> Hostel, SET_NULL)     │
│                                │                      │ • room_id (FK -> HostelRoom, SET_NULL)   │
│                                │                      │ • bed_number (VARCHAR 10, NULL)          │
│                                │                      │ • room_allotted (BOOLEAN, DEFAULT FALSE) │
│                                │                      │ • no_dues (BOOLEAN, DEFAULT TRUE)        │
│                                │                      │ • joining_date (DATE, NULL)              │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ HostelIssue                    │ id (BigAutoField)    │ • student_id (FK -> HostelStudent, CASC) │
│ (warden_hostelissue)           │                      │ • hostel_id (FK -> Hostel, CASCADE)      │
│                                │                      │ • room_id (FK -> HostelRoom, CASCADE)    │
│                                │                      │ • category (VARCHAR 30, DEFAULT 'OTHER') │
│                                │                      │   CHOICES: PLUMBING, ELECTRICAL,         │
│                                │                      │   CARPENTRY, WIFI, CLEANLINESS, OTHER    │
│                                │                      │ • title (VARCHAR 200)                    │
│                                │                      │ • description (TEXT)                     │
│                                │                      │ • status (VARCHAR 30, DEFAULT 'pending') │
│                                │                      │   CHOICES: pending, in_progress,         │
│                                │                      │   waiting_for_workers, completed         │
│                                │                      │ • resolved_at (TIMESTAMP WITH TZ, NULL)  │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ IssueUpdate                    │ id (BigAutoField)    │ • issue_id (FK -> HostelIssue, CASCADE)  │
│ (warden_issueupdate)           │                      │ • old_status (VARCHAR 30, NULL)          │
│                                │                      │ • new_status (VARCHAR 30)                │
│                                │                      │ • note (TEXT, NULL)                      │
│                                │                      │ • updated_by_id (FK -> User, SET_NULL)   │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ GatePassRequest                │ id (BigAutoField)    │ • token (UUID, UNIQUE, DEFAULT uuid4)    │
│ (security_gatepassrequest)     │                      │ • student_id (FK -> HostelStudent, CASC) │
│                                │                      │ • hostel_id (FK -> Hostel, CASCADE)      │
│                                │                      │ • pass_type (VARCHAR 20, DEFAULT DAY_OUT)│
│                                │                      │   CHOICES: DAY_OUT, NIGHT_OUT,           │
│                                │                      │            HOME_VISIT, EMERGENCY         │
│                                │                      │ • reason (TEXT)                          │
│                                │                      │ • out_date (DATE), out_time (TIME)       │
│                                │                      │ • expected_return_date (DATE)            │
│                                │                      │ • expected_return_time (TIME)            │
│                                │                      │ • status (VARCHAR 20, DEFAULT 'pending') │
│                                │                      │   CHOICES: pending, approved, rejected,  │
│                                │                      │            expired, completed            │
│                                │                      │ • approved_by_id (FK -> User, SET_NULL)  │
│                                │                      │ • action_note (TEXT, NULL)               │
│                                │                      │ • actioned_at (TIMESTAMP WITH TZ, NULL)  │
│                                │                      │ • actual_exit_time (TIMESTAMP WITH TZ)   │
│                                │                      │ • actual_entry_time (TIMESTAMP WITH TZ)  │
│                                │                      │ • is_late (BOOLEAN, DEFAULT FALSE)       │
│                                │                      │ • security_guard_id (FK -> User, SET_NULL│
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ VisitorLog                     │ id (BigAutoField)    │ • student_id (FK -> HostelStudent, CASC) │
│ (security_visitorlog)          │                      │ • hostel_id (FK -> Hostel, SET_NULL)     │
│                                │                      │ • visitor_name (VARCHAR 200)             │
│                                │                      │ • mobile_number (VARCHAR 20)             │
│                                │                      │ • purpose (TEXT)                         │
│                                │                      │ • check_in_time (TIMESTAMP, DEFAULT NOW) │
│                                │                      │ • check_out_time (TIMESTAMP, NULL)       │
│                                │                      │ • recorded_by_id (FK -> User, SET_NULL)  │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ MealType                       │ id (BigAutoField)    │ • name (VARCHAR 50, UNIQUE)              │
│ (mess_mealtype)                │                      │   CHOICES: BR, LN, SN, DN                │
│                                │                      │ • description (TEXT, NULL)               │
│                                │                      │ • time_from (TIME, NULL), time_to (TIME) │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ MenuItem                       │ id (BigAutoField)    │ • name (VARCHAR 200)                     │
│ (mess_menuitem)                │                      │ • description (TEXT, NULL)               │
│                                │                      │ • vegetarian (BOOLEAN, DEFAULT TRUE)     │
│                                │                      │ • is_active (BOOLEAN, DEFAULT TRUE)      │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ Menu                           │ id (BigAutoField)    │ • hostel_id (FK -> Hostel, CASCADE)      │
│ (mess_menu)                    │                      │ • day_of_week (VARCHAR 1: '0'-'6')       │
│                                │                      │ • meal_type_id (FK -> MealType, CASCADE) │
│                                │                      │ • is_recurring (BOOLEAN, DEFAULT TRUE)   │
│                                │                      │ • M2M: items (mess_menu_items)           │
│                                │                      │ CONSTRAINT: UNIQUE(hostel, day, meal_type│
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ StudentMealSkip                │ id (BigAutoField)    │ • student_id (FK -> HostelStudent, CASC) │
│ (mess_studentmealskip)         │                      │ • hostel_id (FK -> Hostel, CASCADE)      │
│                                │                      │ • date (DATE)                            │
│                                │                      │ • meal_type_id (FK -> MealType, SET_NULL)│
│                                │                      │ • skip_type (VARCHAR 10, DEFAULT 'SKIP') │
│                                │                      │   CHOICES: SKIP, LEAVE, RETURN           │
│                                │                      │ • reason (TEXT, NULL)                    │
│                                │                      │ • approved (BOOLEAN, DEFAULT TRUE)       │
│                                │                      │ CONSTRAINT: UNIQUE(student, date, meal)  │
├────────────────────────────────┼──────────────────────┼──────────────────────────────────────────┤
│ MessBilling                    │ id (BigAutoField)    │ • student_id (FK -> HostelStudent, CASC) │
│ (mess_messbilling)             │                      │ • hostel_id (FK -> Hostel, CASCADE)      │
│ [DEAD MODEL / UNUSED]          │                      │ • month (DATE)                           │
│                                │                      │ • total_meals, meals_consumed, skipped   │
│                                │                      │ • rate_per_meal (DECIMAL 8,2, DEF 50.00) │
│                                │                      │ • total_cost, discounted_cost (DECIMAL)  │
│                                │                      │ • paid (BOOLEAN, DEFAULT FALSE)          │
│                                │                      │ CONSTRAINT: UNIQUE(student, month)       │
└────────────────────────────────┴──────────────────────┴──────────────────────────────────────────┘
```

---

## 4. Verification of All Business Rules

| Business Rule | Location | Current Implementation & Behavior | Security Critical? | Must Preserve in Supabase? |
| :--- | :--- | :--- | :--- | :--- |
| **Room Capacity Enforcement** | `apps/student/views.py:61-72` | Compares `(room.occupants.count() + room.outside_occupants.count()) >= room.capacity`. If equal, blocks allocation with 400. | **YES** | **YES (Implement in atomic RPC)** |
| **Room Vacancy Flag Calculation** | `apps/student/views.py:70-72, 90-93` | When room reaches capacity, `room.vacant = False`. When student vacates, unconditionally sets `room.vacant = True` without re-verifying remaining occupants. | **YES (Bug found in Django)** | **YES (Supabase must compute dynamically or check count > 0)** |
| **Bed Number Uniqueness** | `apps/student/views.py:65-68` | Assigns `student.bed_number = bed_no` without validating if that specific bed number is already occupied in the room. | **YES** | **YES (Add unique constraint on `(room_id, bed_number)` or check in RPC)** |
| **Hostel Warden Association** | `apps/warden/views.py:15-19` | `get_warden_hostels(user)` finds hostels where `warden__user=user`. **Fallback:** If none found, defaults to returning ALL hostels (`Hostel.objects.all()`). | **YES (Dangerous fallback)** | **YES (Strict RLS: no fallback to all hostels)** |
| **Issue Status Transition & Audit** | `apps/warden/views.py:173-195` | Validates `status in STATUS_CHOICES`. If `completed`, sets `resolved_at = NOW`. Automatically inserts `IssueUpdate` audit row. | **YES** | **YES (PostgreSQL Trigger on `issues`)** |
| **Gate Pass Approval Transition** | `apps/security/views.py:31-51` | Only `ADMIN` or `WARDEN` can set status to `approved` or `rejected`. Records `approved_by` and `actioned_at`. | **YES** | **YES (RLS UPDATE policy + trigger)** |
| **Gate Movement Sequencing** | `apps/security/views.py:79-99` | Records `actual_exit_time` on `EXIT`. On `ENTRY`, sets `actual_entry_time` and `status = 'completed'`. Does not check if student exited before entering. | **YES** | **YES (Enforce sequence in RPC: cannot entry without exit)** |
| **Token Verification Fallback** | `apps/security/views.py:54-76` | Searches by UUID `token`. If not found, searches by `student__enrollment_no` for any `status='approved'` pass. | **YES (High Ambiguity)** | **YES (Fix: QR scanner should only verify UUID token)** |
| **Meal Skip Uniqueness** | `apps/mess/models.py:66-67` | Enforces `unique_together = ('student', 'date', 'meal_type')`. | No | **YES (Preserve unique index)** |
| **Profile Field Synchronization** | `apps/authentication/views.py:43-62` | When user updates `first_name`, `last_name`, or `phone`, updates matching rows in `HostelWarden`, `HostelCaretaker`, or `HostelStudent`. | No | **YES (PostgreSQL Trigger on `profiles`)** |

---

## 5. Authorization & BOLA (Broken Object-Level Authorization) Trace

### Detailed Vulnerability Analysis

```text
Request Path: POST /api/hms/issues/{id}/update_status/
View: HostelIssueViewSet.update_status
Code:
    permission_classes = [permissions.IsAuthenticated] # <--- NO ROLE CHECK!
    issue = self.get_object() # <--- Default queryset has NO user/hostel filter!
    new_status = request.data.get('status')
    issue.status = new_status
    issue.save()
Result: A STUDENT can send a POST request with an issue ID belonging to another hostel and close it.
```

```text
Request Path: POST /api/security/gate-passes/{id}/log_movement/
View: GatePassRequestViewSet.log_movement
Code:
    permission_classes = [permissions.IsAuthenticated] # <--- NO SECURITY ROLE CHECK!
Result: A student or any authenticated user can call log_movement and stamp their own exit or entry.
```

### Complete Endpoint Authorization Trace

| Endpoint | Auth Required | Role Guard Present? | Ownership Check? | Hostel Scoping? | Exploitability & Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `PATCH /api/auth/profile/` | Yes | N/A (Self) | Enforced (`request.user`) | N/A | Low |
| `GET /api/hms/hostels/` | Yes | None (`IsAuthenticated`) | None | None (Global) | Medium (Information disclosure) |
| `GET /api/hms/rooms/` | Yes | None (`IsAuthenticated`) | None | None (Global) | Medium |
| `POST /api/hms/rooms/bulk_create_rooms/` | Yes | None (`IsAuthenticated`!) | None | None | **CRITICAL (Any user can generate rooms)** |
| `GET /api/hms/students/` | Yes | None (`IsAuthenticated`) | None | None (Global) | High (Student directory exposed to students) |
| `POST /api/student/students/allocate_room/` | Yes | Yes (`ADMIN`/`WARDEN`) | None | None (Can allocate in any hostel) | Medium |
| `POST /api/student/students/{id}/vacate_room/` | Yes | Yes (`ADMIN`/`WARDEN`) | None | None | Medium |
| `GET /api/student/students/my_profile/` | Yes | None | Enforced (`user=request.user`)| N/A | Low (Secure) |
| `GET /api/hms/issues/` | Yes | None (`IsAuthenticated`) | None | None (Global under `/hms/`!) | High (Students see all hostel complaints) |
| `GET /api/warden/issues/` | Yes | None (`IsAuthenticated`) | None | Filtered by warden hostels | Low |
| `POST /api/hms/issues/{id}/update_status/` | Yes | **MISSING** | **NONE** | **NONE** | **CRITICAL (IDOR on maintenance tickets)** |
| `GET /api/hms/gate-passes/` | Yes | None (`IsAuthenticated`) | None | None (Global under `/hms/`!) | High (Gate passes visible globally) |
| `GET /api/security/gate-passes/my_passes/` | Yes | None | Enforced (`student=student`)| N/A | Low (Secure) |
| `POST /api/security/gate-passes/{id}/warden_action/` | Yes | Yes (`ADMIN`/`WARDEN`) | None | None (Can approve other hostel passes) | Medium |
| `POST /api/security/gate-passes/{id}/log_movement/` | Yes | **MISSING** | **NONE** | **NONE** | **CRITICAL (Any user can log gate pass)** |
| `GET /api/security/gate-passes/verify_token/` | Yes | None (`IsAuthenticated`) | None | None | Low |
| `GET /api/hms/visitor-logs/` | Yes | None (`IsAuthenticated`) | None | None (Global) | Medium |
| `POST /api/security/visitors/{id}/check_out/` | Yes | None (`IsAuthenticated`) | None | None | Medium |

---

## 6. Verified Role-Permission Matrix for Target Supabase RLS

Based on actual business requirements and repairing the security loopholes discovered in Django:

| Resource Table | ADMIN | WARDEN | SECURITY | STUDENT |
| :--- | :--- | :--- | :--- | :--- |
| **`profiles` / `users`** | Global CRUD | Read All; Update Self | Read All; Update Self | Read Self; Update Self |
| **`hostels`** | Global CRUD | Read All (or assigned) | Read All | Read All (or assigned) |
| **`hostel_rooms`** | Global CRUD | Read & Update (Assigned Hostels) | Read Only | Read Assigned Room & Occupants |
| **`hostel_students`** | Global CRUD | Read & Manage (Assigned Hostels) | Read Only (Verification) | Read Own Profile & Roommates |
| **`hostel_outside_students`** | Global CRUD | Read & Manage (Assigned Hostels) | Read Only | No Access |
| **`wardens` / `caretakers`** | Global CRUD | Read All; Update Self | Read All | Read Hostel Wardens |
| **`courses`** | Global CRUD | Read Only | Read Only | Read Only |
| **`issues`** | Global CRUD | Read & Update (Assigned Hostels) | Read Only | Create Own; Read Own; No Status Mod |
| **`issue_updates`** | Global CRUD | Create; Read (Assigned Hostels) | Read Only | Read for Own Issues; No Create |
| **`gate_passes`** | Global CRUD | Read & Approve/Reject (Assigned) | Read Approved; Stamp Movement | Create Own; Read Own |
| **`visitor_logs`** | Global CRUD | Read (Assigned Hostels) | Create; Read All; Check Out | Read for Self Only |
| **`menus` & `meal_types`** | Global CRUD | Read All; Manage Assigned | Read All | Read All |
| **`meal_skips`** | Global Read | Read (Assigned Hostels) | Read Only | Create Own; Read Own |

---

## 7. Deep Trace: Room Allocation Logic & Invariants

### Code Trace (`apps/student/views.py:38-76`)
1. **Frontend Action**: Admin or Warden clicks "Allocate Resident" in `StudentManagement.tsx` or `RoomManagement.tsx`.
2. **Payload**: `{ student_id: 1, room_id: 4, bed_number: '2', is_outside: false }`.
3. **Permission**: `request.user.role in ['ADMIN', 'WARDEN'] or is_superuser`.
4. **Validation**: Checks existence of `HostelRoom` and `HostelStudent` (or `HostelOutsideStudent`).
5. **Capacity Check**:
   ```python
   current_occupants = room.occupants.count() + room.outside_occupants.count()
   if current_occupants >= room.capacity:
       return Response({'error': f'Room {room.no} is already at full capacity ({room.capacity})'}, status=status.HTTP_400_BAD_REQUEST)
   ```
6. **Assignment**:
   ```python
   student.room = room
   student.bed_number = bed_no
   student.room_allotted = True
   student.save()
   ```
7. **Vacancy Flag Update**:
   ```python
   if (room.occupants.count() + room.outside_occupants.count()) >= room.capacity:
       room.vacant = False
       room.save()
   ```

### Flaws & Race Conditions Discovered:
- **Non-Atomic Allocation**: No `@transaction.atomic` or `select_for_update()`. Two concurrent requests for the same room will both pass `current_occupants < room.capacity` and over-allocate the room.
- **Bed Number Collision**: No check ensures `bed_number` is distinct among room occupants. Both residents can be allocated to `Bed 1`.
- **Inaccurate De-allocation (Vacate)**: When a student vacates (`vacate_room`), the code executes `room.vacant = True; room.save()`, regardless of whether other roommates are still living in the room!

### Core Invariants for Supabase:
```text
INVARIANT 1 (Room Capacity Ceiling):
COUNT(occupants WHERE room_id = X) <= capacity FOR ANY room X AT ALL TIMES.

INVARIANT 2 (Unique Bed Assignment):
UNIQUE(room_id, bed_number) FOR ALL ALLOTTED RESIDENTS WHERE room_id IS NOT NULL.

INVARIANT 3 (Deterministic Vacancy):
room.vacant is TRUE IF AND ONLY IF COUNT(occupants WHERE room_id = X) < capacity.
```

---

## 8. Deep Trace: Gate Pass & QR Security Workflow

### Workflow Sequence:
```text
1. Student applies: POST /api/hms/gate-passes/
   - Status initialized to 'pending'
   - UUID token auto-generated: uuid.uuid4()
   - student and hostel linked via authenticated student profile

2. Warden Review: POST /api/security/gate-passes/{id}/warden_action/
   - Role check: ADMIN or WARDEN
   - Sets status = 'approved' or 'rejected'
   - Sets approved_by = user, actioned_at = NOW()

3. Security Verification: GET /api/security/gate-passes/verify_token/?code={token}
   - Guard scans QR code with camera (Html5Qrcode in GatePassScanner.tsx)
   - Checks GatePassRequest.objects.filter(token=code)
   - [SECURITY RISK] Fallback query: filter(student__enrollment_no=code, status='approved')

4. Movement Stamping: POST /api/security/gate-passes/{id}/log_movement/
   - Body: { movement_type: 'EXIT' | 'ENTRY' }
   - EXIT: sets actual_exit_time = NOW()
   - ENTRY: sets actual_entry_time = NOW(), status = 'completed'
```

### Flaws & Security Risks:
1. **Unrestricted Calling of `log_movement`**: Any authenticated user can POST to this endpoint and log an exit/entry for themselves without security guard credentials.
2. **Out-of-Order Movement**: A guard can call `ENTRY` before `EXIT`, or call `EXIT` twice.
3. **Ambiguous Enrollment Number Fallback**: If student enters an enrollment number instead of scanning the QR, the backend picks `.order_by('-created_at').first()`. If an approved pass was created for tomorrow, today's entry/exit could inadvertently trigger against tomorrow's pass.

### Core Invariants for Supabase:
```text
INVARIANT 1: Token verification must strictly query UUID tokens. Enrollment fallback must be an explicit, logged manual search with active date checking.
INVARIANT 2: actual_exit_time MUST be stamped BEFORE actual_entry_time.
INVARIANT 3: Only users with role = 'SECURITY' or 'ADMIN' can execute log_movement.
INVARIANT 4: Once status is 'completed', a gate pass token cannot be reused for movement.
```

---

## 9. Issue Management Workflow & Audit Trail

### Workflow Sequence:
```text
HostelIssue (status: pending)
        │
        ▼  [POST /api/hms/issues/{id}/update_status/]
Status Transition:
  'pending' ──► 'in_progress' ──► 'waiting_for_workers' ──► 'completed'
        │
        ├─► If new_status == 'completed': resolved_at = NOW()
        │
        └─► Creates IssueUpdate:
            ├── issue = issue
            ├── old_status = old_status
            ├── new_status = new_status
            ├── note = request.data.note
            └── updated_by = request.user
```

### Findings:
- Audit history (`IssueUpdate`) is created correctly whenever `update_status` is used.
- **Flaw**: Direct `PATCH /api/hms/issues/{id}/` can bypass `update_status` and mutate status without creating an `IssueUpdate` row.
- **Supabase Fix**: Place status auditing inside a PostgreSQL trigger on `UPDATE OF status ON issues` so that audit records can never be bypassed, even by direct SQL or REST mutations.

---

## 10. Frontend API Usage & Dependency Map

All API calls in React originate from `@/api/apiClient`, which wraps `authService.ts`. No raw `fetch()` or disparate Axios instances exist.

```text
React Component               Frontend Call                    Django Endpoint
─────────────────────────────────────────────────────────────────────────────────────────────
Login.tsx                  -> loginUser()                   -> POST /api/auth/login/
AuthContext.tsx            -> apiClient.get('/auth/me/')    -> GET  /api/auth/me/
HMSProfile.tsx             -> apiClient.patch('/auth/profile/')-> PATCH /api/auth/profile/
AdminDashboard.tsx         -> apiClient.get('/hms/dashboard/stats/')-> GET /api/hms/dashboard/stats/
HostelManagement.tsx       -> apiClient.get('/hms/hostels/') -> GET  /api/hms/hostels/
                           -> apiClient.post('/hms/hostels/')-> POST /api/hms/hostels/
RoomManagement.tsx         -> apiClient.get('/hms/rooms/?hostel=X')-> GET /api/hms/rooms/
                           -> apiClient.post('/hms/rooms/bulk_create_rooms/')-> POST /api/hms/rooms/bulk_create_rooms/
StudentManagement.tsx      -> apiClient.get('/hms/students/')-> GET  /api/hms/students/
                           -> apiClient.post('/student/students/allocate_room/')-> POST /api/student/students/allocate_room/
OutsideStudentManagement.tsx->apiClient.get('/hms/outside-students/')-> GET /api/hms/outside-students/
StaffManagement.tsx        -> apiClient.get('/hms/wardens/')-> GET  /api/hms/wardens/
                           -> apiClient.get('/hms/caretakers/')-> GET /api/hms/caretakers/
MenuManagement.tsx         -> apiClient.get('/hms/menus/')  -> GET  /api/hms/menus/
                           -> apiClient.get('/hms/meal-types/')-> GET /api/hms/meal-types/
IssueTracking.tsx          -> apiClient.get('/hms/issues/') -> GET  /api/hms/issues/
                           -> apiClient.post('/hms/issues/X/update_status/')-> POST /api/hms/issues/X/update_status/
VisitorLogsManagement.tsx  -> apiClient.get('/hms/visitor-logs/')-> GET /api/hms/visitor-logs/
                           -> apiClient.post('/security/visitors/X/check_out/')-> POST /api/security/visitors/X/check_out/
WardenDashboard.tsx        -> apiClient.get('/warden/dashboard/')-> GET /api/warden/dashboard/
WardenGatePassManagement.tsx->apiClient.get('/security/gate-passes/')-> GET /api/security/gate-passes/
                           -> apiClient.post('/security/gate-passes/X/warden_action/')-> POST /api/security/gate-passes/X/warden_action/
GatePassScanner.tsx        -> apiClient.get('/security/gate-passes/verify_token/?code=X')-> GET /api/security/gate-passes/verify_token/
                           -> apiClient.post('/security/gate-passes/X/log_movement/')-> POST /api/security/gate-passes/X/log_movement/
StudentDashboard.tsx       -> apiClient.get('/student/students/my_profile/')-> GET /api/student/students/my_profile/
StudentGatePasses.tsx      -> apiClient.get('/security/gate-passes/my_passes/')-> GET /api/security/gate-passes/my_passes/
                           -> apiClient.post('/security/gate-passes/')-> POST /api/security/gate-passes/
StudentIssues.tsx          -> apiClient.get('/hms/issues/') -> GET  /api/hms/issues/
                           -> apiClient.post('/hms/issues/')-> POST /api/hms/issues/
StudentMeals.tsx           -> apiClient.get('/mess/menus/today_menu/')-> GET /api/mess/menus/today_menu/
                           -> apiClient.get('/mess/skips/my_skips/')-> GET /api/mess/skips/my_skips/
```

---

## 11. User Identity & ID Mapping Strategy

### Integer `user.id` References Across Models:
1. `HostelWarden.user_id` (1:1 with User)
2. `HostelCaretaker.user_id` (1:1 with User)
3. `HostelStudent.user_id` (1:1 with User)
4. `GatePassRequest.approved_by_id` (FK to User)
5. `GatePassRequest.security_guard_id` (FK to User)
6. `VisitorLog.recorded_by_id` (FK to User)
7. `IssueUpdate.updated_by_id` (FK to User)

### Supabase Mapping Requirement:
- Supabase Auth stores identities in `auth.users` with UUID primary keys.
- **Strategy**:
  1. Create `public.profiles` table with `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`.
  2. For migration of existing data, generate a deterministic UUID (e.g. `uuid5`) for each existing integer ID or maintain an ephemeral lookup table `django_id_map(django_id INT, supabase_uuid UUID)`.
  3. Update all 7 foreign keys above to reference `public.profiles(id)` (UUID) instead of integer IDs.

---

## 12. File & Image Storage Audit

- **Cloudflare**: Proven completely absent.
- **Current Status**:
  - `User.avatar_url`: Storing external HTTPS strings (e.g. Unsplash).
  - No file upload endpoints currently exist in Django backend.
  - `MEDIA_ROOT` in `settings.py` is configured but empty.
- **Supabase Architecture**:
  - Introduce a Supabase Storage bucket named `avatars` with public read access.
  - When user uploads a new avatar from `HMSProfile.tsx`, upload directly via `@supabase/supabase-js` storage API and update `profiles.avatar_url` with the public URL.

---

## 13. Query Performance & N+1 Audit

1. **Serializer Method Aggregations (N+1)**:
   - `HostelSerializer` (`apps/hms_admin/serializers.py:53-65`):
     - `get_total_rooms`: calls `obj.rooms.count()`
     - `get_total_capacity`: iterates over `obj.rooms.all()`
     - `get_occupied_beds`: queries `r.occupants.count()` and `r.outside_occupants.count()` for every room in every hostel.
   - For 10 hostels with 50 rooms each, this triggers hundreds of queries on a single request.
2. **Warden Dashboard Room Iteration**:
   - `WardenDashboardViewSet.overview` (`apps/warden/views.py:42-44`):
     - `sum(r.occupants.count() for r in rooms)` triggers 1 query per room.
3. **PostgreSQL / Supabase Solution**:
   - Create a pre-aggregated view `view_hostel_occupancy_stats` that calculates `COUNT(rooms)`, `SUM(capacity)`, and `COUNT(occupants)` with a single `GROUP BY hostel_id`.

---

## 14. Dashboard Calculation Consistency Check

- **Admin Dashboard** calculates:
  - `total_students = students_count + outside_students_count` (only where `room_allotted=True`).
  - `occupancy_rate = round(occupied_beds / total_capacity * 100, 1)`.
- **Warden Dashboard** calculates:
  - `total_residents = HostelStudent.objects.filter(room__hostel_id__in=hostel_ids, room_allotted=True).count()`.
  - **Inconsistency Found**: Warden dashboard currently **omits** `HostelOutsideStudent` from occupied residents and occupancy rate calculations!
- **Resolution**: In Supabase views, unify occupancy calculation so outside students are consistently counted in both dashboards.

---

## 15. Testing Gap Analysis

| Priority | Critical Feature Flow | Current Automated Test Coverage | Risk Level | Test Requirement Before Migration |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | User Login & Role Token Validation | 0% (None) | CRITICAL | Verify all 4 roles receive valid tokens & redirected to proper portals |
| **P0** | Atomic Room Allocation & Capacity Limit | 0% (None) | CRITICAL | Verify rooms reject allocation when `occupants == capacity` |
| **P0** | Gate Pass Lifecycle & QR Verification | 0% (None) | CRITICAL | Verify create -> warden approve -> QR scan -> exit stamp -> entry stamp |
| **P1** | Issue Creation, Status Update & Audit Log| 0% (None) | HIGH | Verify `IssueUpdate` row created with user ID on status change |
| **P1** | Daily Menu Retrieval & Meal Skip | 0% (None) | MEDIUM | Verify day-of-week meal list and unique skip per meal |
| **P2** | Bulk Room Generation | 0% (None) | MEDIUM | Verify room prefixing and floor index generation |

---

## 16. Django → Supabase Architectural Allocation

```text
┌──────────────────────────────────────┬────────────────────────────┬────────────────────────────────────────────────────────┐
│ Feature / Operation                  │ Target Supabase Component  │ Architectural Rationale                                │
├──────────────────────────────────────┼────────────────────────────┼────────────────────────────────────────────────────────┤
│ Authentication & JWT                 │ Supabase Auth (GoTrue)     │ Built-in session management, refresh rotation, secure   │
│ Profile Sync Trigger                 │ PostgreSQL Trigger         │ Guarantees sync between auth.users and domain tables   │
│ Room & Bed Allocation                │ PostgreSQL Function (RPC)  │ Requires atomic transaction & row locking (FOR UPDATE) │
│ Room Vacating                        │ PostgreSQL Function (RPC)  │ Recalculates vacancy dynamically and clears resident   │
│ Bulk Room Creation                   │ PostgreSQL Function (RPC)  │ Efficient set-based generation loop without roundtrips │
│ Gate Movement Stamping               │ PostgreSQL Function (RPC)  │ Enforces EXIT -> ENTRY state sequencing strictly       │
│ Issue Status Update & Audit Log      │ PostgreSQL Trigger / RPC   │ Eliminates IDOR and makes audit logging un-bypassable  │
│ Dashboards & Metrics Aggregation     │ PostgreSQL Views           │ Pre-computes joins, eliminates N+1 queries             │
│ Standard CRUD (Hostels, Rooms, etc.) │ Supabase PostgREST + RLS   │ Direct declarative queries from React with zero backend│
│ Real-Time Maintenance Updates        │ Supabase Realtime          │ Instant UI sync for open tickets across portals        │
│ Avatar / Image Assets                │ Supabase Storage Bucket    │ S3-compatible asset storage with CDN URLs              │
└──────────────────────────────────────┴────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 17. Migration Blockers & Risk Categorization

### Blockers (Must resolve before any production migration):
1. **Integer ID to UUID Mapping Scheme**: Establish deterministic translation for existing `auth_user` foreign keys.
2. **Atomic Room Allocation Stored Procedure**: Draft and verify the PostgreSQL RPC function before deprecating Django's endpoint to prevent overbooking.
3. **Gate Pass Security Constraints**: Eliminate enrollment fallback and enforce security-only movement logging.

### High-Risk Items:
1. **Zero Test Coverage**: Migration cannot be reliably validated without baseline integration tests.
2. **Missing Database Indexes**: Add composite indexes on `(hostel_id, status)` during migration to prevent query slowdowns in PostgREST.

### Medium-Risk Items:
1. **Discard Dead Code**: Formally drop the unused `MessBilling` model during schema creation.
2. **Inconsistent Occupancy Metric**: Unify outside student inclusion across admin and warden views.

---

## 18. Recommended Migration Order

```text
Step 1: Write Automated E2E Regression Tests (Playwright / Cypress)
Step 2: Provision Supabase Project & Execute Schema DDL (Tables + Constraints + Indexes)
Step 3: Deploy PostgreSQL Views & Stored Functions (RPCs)
Step 4: Configure Supabase Auth & Define Row Level Security (RLS) Policies
Step 5: Setup Supabase Storage Bucket ('avatars')
Step 6: Data Migration (Dump Django Postgres -> Transform User IDs -> Insert into Supabase)
Step 7: Frontend SDK Integration (@supabase/supabase-js replacing authService.ts)
Step 8: Execute Regression Test Suite & Validate Invariants
Step 9: Cutover & Decommission Django Service
```

---

## 19. Final Verified Architecture

### Current Verified Architecture (Reality)
```text
React 19 Frontend (Axios + localStorage JWT)
            │
            ▼
Django REST API (SimpleJWT + Un-isolated Querysets)
            │
            ▼
PostgreSQL Database (hms_db)
            │
            ▼
External URLs (Unsplash CDN) [Cloudflare is completely absent]
```

### Proposed Target Architecture (Supabase)
```text
React 19 Frontend (@supabase/supabase-js)
            │
      ┌─────┴──────────────────────────────┐
      ▼                                    ▼
Supabase Auth                       PostgREST API Gateway
(JWT + Secure Session)               ├── Row Level Security (RLS)
                                     ├── Direct Table Queries
                                     ├── PostgreSQL Views (Metrics)
                                     └── RPC Functions (Atomic Allocation & Gate Movement)
                                           │
                                           ▼
                                    PostgreSQL 15+ Engine
                                           ▲
                                           │
                                    Supabase Storage ('avatars')
```

---

## 20. Final Readiness Score & Recommendation

```text
Database Readiness:           95 / 100  (Relational structure is solid and PostgreSQL-native)
API Readiness:                88 / 100  (Most endpoints map 1:1 to PostgREST)
Frontend Readiness:           92 / 100  (Clean centralized API client, easy to swap for Supabase client)
Authentication Readiness:     90 / 100  (Standard role claims map cleanly to Supabase Auth)
Authorization Readiness:      60 / 100  (Current Django code has severe BOLA/IDOR holes; RLS is essential)
Data Migration Readiness:     85 / 100  (Requires integer User ID -> UUID transformation)
Security Readiness:           62 / 100  (Open actions & race conditions must be fixed via RPC/RLS)
Testing Readiness:            20 / 100  (Critical gap: 0 automated tests exist)
Business Logic Readiness:     82 / 100  (Key business logic clearly identified for RPCs)
────────────────────────────────────────────────────────────────────────────────────────────────
OVERALL MIGRATION READINESS:  75 / 100
```

### Final Verdict: **GO WITH CONDITIONS**

**Justification:**  
The repository is an excellent candidate for a Supabase migration. Replacing Django with Supabase will actually **fix several severe security vulnerabilities** currently present in the backend (BOLA in issue updates, gate movement stamping, and room race conditions). 

However, migration must **NOT** proceed directly to code changes until:
1. P0 automated test scenarios are scripted to verify the 4 user portals.
2. The user ID to UUID mapping procedure is established.
3. The atomic RPC functions for room allocation and gate movement are prepared to replace the vulnerable Django endpoints.
