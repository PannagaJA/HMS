# HMS — Supabase Migration Technical Design Specification

**Document Version:** 1.0.0  
**Date:** September 2, 2026  
**Status:** DESIGN & BLUEPRINT (READ-ONLY / PRE-IMPLEMENTATION)  
**Source of Truth:** [`HMS_PRE_MIGRATION_VERIFIED_AUDIT.md`](file:///d:/AMC/HMS/HMS_PRE_MIGRATION_VERIFIED_AUDIT.md)

---

## 1. Target Architecture Overview

The target architecture transitions the Hostel Management System from a stateful Django monolithic REST API to a serverless, database-first architecture powered by **Supabase**. The React frontend communicates directly with Supabase services via the `@supabase/supabase-js` client SDK, backed by PostgreSQL Row Level Security (RLS), Views, Triggers, and Stored Procedures (RPCs).

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 React 19 + Vite Frontend SPA                                │
│                     (Role Portals: Admin, Warden, Security Guard, Student)                  │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                 @supabase/supabase-js Client
                                               │
             ┌───────────────────┬─────────────┴───────┬───────────────────┐
             ▼                   ▼                     ▼                   ▼
     ┌───────────────┐   ┌───────────────┐     ┌───────────────┐   ┌───────────────┐
     │ Supabase Auth │   │   PostgREST   │     │ PostgreSQL    │   │   Supabase    │
     │   (GoTrue)    │   │  Declarative  │     │ Stored Procs  │   │    Storage    │
     │ JWT + Claims  │   │ Table Queries │     │    (RPCs)     │   │ (S3 API CDN)  │
     └───────┬───────┘   └───────┬───────┘     └───────┬───────┘   └───────┬───────┘
             │                   │                     │                   │
             └───────────────────┼─────────────────────┴───────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PostgreSQL 15+ Engine                                     │
│  ├── Tables: Clean relational tables with standard snake_case naming                        │
│  ├── Row Level Security (RLS): Mandatory policies per role on ALL public tables             │
│  ├── PostgreSQL Views: Pre-aggregated dashboard statistics eliminating N+1 queries         │
│  ├── Stored Procedures (RPCs): Atomic operations (room allocation, movement, bulk creation) │
│  └── Triggers: Automatic audit trail logging, profile sync, and timestamp management        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

1. **React 19 Frontend**:
   - Manages UI presentation, client-side routing, form validation, and camera hardware interaction (`html5-qrcode`).
   - Does **NOT** make authorization decisions. Client role checks only toggle view layouts; all data mutations are gated by RLS and RPC validations.
2. **Supabase Auth (GoTrue)**:
   - Handles credential verification, session issuance, refresh token rotation, and JWT signing.
   - Emits JWT claims containing `role` and `user_metadata` for zero-overhead RLS evaluation.
3. **PostgREST API**:
   - Automatically generates CRUD REST endpoints for PostgreSQL tables and views.
   - Executes strictly in the database context using the caller's JWT `auth.uid()` and `role`.
4. **PostgreSQL RPC Functions**:
   - Executes multi-step, security-sensitive, or atomic business logic (e.g., room allocation concurrency control, gate movement state-machine validation).
   - Functions run with `SECURITY DEFINER` where elevated cross-table synchronization is required, with strict internal role authorization checks.
5. **PostgreSQL Triggers & Views**:
   - Views compute real-time operational aggregates (occupancy, bed counts, pending tickets).
   - Triggers enforce un-bypassable audit logging (`issue_updates`) and bidirectional profile synchronization.
6. **Supabase Storage**:
   - Stores user avatars and institutional media with object-level access policies.

---

## 2. Supabase Database Schema Design

All tables reside in the `public` schema. All domain tables inherit `created_at TIMESTAMPTZ DEFAULT NOW()` and `updated_at TIMESTAMPTZ DEFAULT NOW()`.

### Table Inventory & DDL Definitions

#### 2.1 `profiles` (Replaces `authentication_user`)
Links directly to `auth.users(id)` 1:1.
```text
Table: profiles
  • id: UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
  • email: TEXT NOT NULL
  • role: TEXT NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('ADMIN', 'WARDEN', 'SECURITY', 'STUDENT'))
  • first_name: TEXT NOT NULL DEFAULT ''
  • last_name: TEXT NOT NULL DEFAULT ''
  • phone: TEXT
  • avatar_url: TEXT
  • is_active: BOOLEAN NOT NULL DEFAULT TRUE
  • legacy_django_id: INTEGER UNIQUE (For migration mapping)
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
Indexes:
  - idx_profiles_role ON profiles(role)
```

#### 2.2 `hostels` (Replaces `hms_admin_hostel`)
```text
Table: hostels
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • name: TEXT NOT NULL UNIQUE
  • gender: CHAR(1) NOT NULL DEFAULT 'M' CHECK (gender IN ('M', 'F', 'C'))
  • floor_count: INTEGER NOT NULL DEFAULT 1 CHECK (floor_count >= 1)
  • address: TEXT
  • warden_id: BIGINT REFERENCES hostel_wardens(id) ON DELETE SET NULL
  • caretaker_id: BIGINT REFERENCES hostel_caretakers(id) ON DELETE SET NULL
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
Indexes:
  - idx_hostels_gender ON hostels(gender)
```

#### 2.3 `hostel_wardens` (Replaces `hms_admin_hostelwarden`)
```text
Table: hostel_wardens
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • profile_id: UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE
  • name: TEXT NOT NULL
  • email: TEXT
  • phone: TEXT
  • designation: TEXT NOT NULL DEFAULT 'Hostel Warden'
  • experience: INTEGER NOT NULL DEFAULT 0
  • address: TEXT
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### 2.4 `hostel_caretakers` (Replaces `hms_admin_hostelcaretaker`)
```text
Table: hostel_caretakers
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • profile_id: UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE
  • name: TEXT NOT NULL
  • email: TEXT
  • phone: TEXT
  • address: TEXT
  • experience: INTEGER NOT NULL DEFAULT 0
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### 2.5 `hostel_courses` (Replaces `hms_admin_hostelcourse`)
```text
Table: hostel_courses
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • code: TEXT NOT NULL UNIQUE
  • name: TEXT
  • room_type: CHAR(1) NOT NULL DEFAULT 'D' CHECK (room_type IN ('S', 'D', 'P', 'B'))
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### 2.6 `hostel_course_assignments` (Replaces `hms_admin_hostel_courses` M2M)
```text
Table: hostel_course_assignments
  • hostel_id: BIGINT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE
  • course_id: BIGINT NOT NULL REFERENCES hostel_courses(id) ON DELETE CASCADE
  • PRIMARY KEY (hostel_id, course_id)
```

#### 2.7 `hostel_rooms` (Replaces `hms_admin_hostelroom`)
```text
Table: hostel_rooms
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • hostel_id: BIGINT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE
  • no: TEXT NOT NULL
  • name: TEXT NOT NULL
  • room_type: CHAR(1) NOT NULL DEFAULT 'D' CHECK (room_type IN ('S', 'D', 'T', 'P', 'B'))
  • floor: INTEGER NOT NULL DEFAULT 0
  • capacity: INTEGER NOT NULL DEFAULT 2 CHECK (capacity >= 1)
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
Constraints:
  - UNIQUE (hostel_id, no)
Indexes:
  - idx_hostel_rooms_hostel_floor ON hostel_rooms(hostel_id, floor, no)
```
*(Note: See Section 10 regarding the removal of persistent `vacant` column).*

#### 2.8 `hostel_students` (Replaces `student_hostelstudent`)
```text
Table: hostel_students
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • profile_id: UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE
  • student_name: TEXT NOT NULL
  • father_name: TEXT
  • enrollment_no: TEXT NOT NULL UNIQUE
  • course_id: BIGINT REFERENCES hostel_courses(id) ON DELETE SET NULL
  • dob: DATE
  • gender: CHAR(1) NOT NULL DEFAULT 'M' CHECK (gender IN ('M', 'F'))
  • room_id: BIGINT REFERENCES hostel_rooms(id) ON DELETE SET NULL
  • bed_number: TEXT
  • room_allotted: BOOLEAN NOT NULL DEFAULT FALSE
  • no_dues: BOOLEAN NOT NULL DEFAULT TRUE
  • guardian_phone: TEXT
  • emergency_contact: TEXT
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
Constraints:
  - UNIQUE (room_id, bed_number) WHERE room_id IS NOT NULL AND bed_number IS NOT NULL (Bed invariant)
Indexes:
  - idx_hostel_students_room ON hostel_students(room_id)
  - idx_hostel_students_enrollment ON hostel_students(enrollment_no)
```

#### 2.9 `hostel_outside_students` (Replaces `student_hosteloutsidestudent`)
```text
Table: hostel_outside_students
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • name: TEXT NOT NULL
  • usn: TEXT NOT NULL UNIQUE
  • outside_college_name: TEXT NOT NULL DEFAULT ''
  • outside_course_name: TEXT NOT NULL DEFAULT ''
  • outside_year: TEXT
  • phone: TEXT NOT NULL
  • email: TEXT
  • father_name: TEXT
  • father_phone: TEXT
  • gender: CHAR(1) NOT NULL DEFAULT 'M' CHECK (gender IN ('M', 'F'))
  • hostel_id: BIGINT REFERENCES hostels(id) ON DELETE SET NULL
  • room_id: BIGINT REFERENCES hostel_rooms(id) ON DELETE SET NULL
  • bed_number: TEXT
  • room_allotted: BOOLEAN NOT NULL DEFAULT FALSE
  • no_dues: BOOLEAN NOT NULL DEFAULT TRUE
  • joining_date: DATE
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
Constraints:
  - UNIQUE (room_id, bed_number) WHERE room_id IS NOT NULL AND bed_number IS NOT NULL
Indexes:
  - idx_outside_students_room ON hostel_outside_students(room_id)
```

#### 2.10 `issues` (Replaces `warden_hostelissue`)
```text
Table: issues
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • student_id: BIGINT NOT NULL REFERENCES hostel_students(id) ON DELETE CASCADE
  • hostel_id: BIGINT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE
  • room_id: BIGINT NOT NULL REFERENCES hostel_rooms(id) ON DELETE CASCADE
  • category: TEXT NOT NULL DEFAULT 'OTHER' CHECK (category IN ('PLUMBING', 'ELECTRICAL', 'CARPENTRY', 'WIFI', 'CLEANLINESS', 'OTHER'))
  • title: TEXT NOT NULL
  • description: TEXT NOT NULL
  • status: TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'waiting_for_workers', 'completed'))
  • resolved_at: TIMESTAMPTZ
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
Indexes:
  - idx_issues_hostel_status ON issues(hostel_id, status)
  - idx_issues_student ON issues(student_id)
```

#### 2.11 `issue_updates` (Replaces `warden_issueupdate`)
```text
Table: issue_updates
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • issue_id: BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE
  • old_status: TEXT
  • new_status: TEXT NOT NULL
  • note: TEXT
  • updated_by: UUID REFERENCES profiles(id) ON DELETE SET NULL
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
Indexes:
  - idx_issue_updates_issue ON issue_updates(issue_id, created_at)
```

#### 2.12 `gate_passes` (Replaces `security_gatepassrequest`)
```text
Table: gate_passes
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • token: UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()
  • student_id: BIGINT NOT NULL REFERENCES hostel_students(id) ON DELETE CASCADE
  • hostel_id: BIGINT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE
  • pass_type: TEXT NOT NULL DEFAULT 'DAY_OUT' CHECK (pass_type IN ('DAY_OUT', 'NIGHT_OUT', 'HOME_VISIT', 'EMERGENCY'))
  • reason: TEXT NOT NULL
  • out_date: DATE NOT NULL
  • out_time: TIME NOT NULL
  • expected_return_date: DATE NOT NULL
  • expected_return_time: TIME NOT NULL
  • status: TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'completed'))
  • approved_by: UUID REFERENCES profiles(id) ON DELETE SET NULL
  • action_note: TEXT
  • actioned_at: TIMESTAMPTZ
  • actual_exit_time: TIMESTAMPTZ
  • actual_entry_time: TIMESTAMPTZ
  • is_late: BOOLEAN NOT NULL DEFAULT FALSE
  • security_guard_id: UUID REFERENCES profiles(id) ON DELETE SET NULL
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
Indexes:
  - idx_gate_passes_token ON gate_passes(token)
  - idx_gate_passes_hostel_status ON gate_passes(hostel_id, status)
  - idx_gate_passes_student ON gate_passes(student_id)
```

#### 2.13 `visitor_logs` (Replaces `security_visitorlog`)
```text
Table: visitor_logs
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • student_id: BIGINT NOT NULL REFERENCES hostel_students(id) ON DELETE CASCADE
  • hostel_id: BIGINT REFERENCES hostels(id) ON DELETE SET NULL
  • visitor_name: TEXT NOT NULL
  • mobile_number: TEXT NOT NULL
  • purpose: TEXT NOT NULL
  • check_in_time: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • check_out_time: TIMESTAMPTZ
  • recorded_by: UUID REFERENCES profiles(id) ON DELETE SET NULL
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
Indexes:
  - idx_visitor_logs_hostel ON visitor_logs(hostel_id)
  - idx_visitor_logs_student ON visitor_logs(student_id)
```

#### 2.14 `meal_types` (Replaces `mess_mealtype`)
```text
Table: meal_types
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • name: TEXT NOT NULL UNIQUE CHECK (name IN ('BR', 'LN', 'SN', 'DN'))
  • description: TEXT
  • time_from: TIME
  • time_to: TIME
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### 2.15 `menu_items` (Replaces `mess_menuitem`)
```text
Table: menu_items
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • name: TEXT NOT NULL
  • description: TEXT
  • vegetarian: BOOLEAN NOT NULL DEFAULT TRUE
  • is_active: BOOLEAN NOT NULL DEFAULT TRUE
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

#### 2.16 `menus` (Replaces `mess_menu`)
```text
Table: menus
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • hostel_id: BIGINT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE
  • day_of_week: CHAR(1) NOT NULL CHECK (day_of_week BETWEEN '0' AND '6')
  • meal_type_id: BIGINT NOT NULL REFERENCES meal_types(id) ON DELETE CASCADE
  • is_recurring: BOOLEAN NOT NULL DEFAULT TRUE
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
Constraints:
  - UNIQUE (hostel_id, day_of_week, meal_type_id)
```

#### 2.17 `menu_item_links` (Replaces `mess_menu_items` M2M)
```text
Table: menu_item_links
  • menu_id: BIGINT NOT NULL REFERENCES menus(id) ON DELETE CASCADE
  • item_id: BIGINT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE
  • PRIMARY KEY (menu_id, item_id)
```

#### 2.18 `meal_skips` (Replaces `mess_studentmealskip`)
```text
Table: meal_skips
  • id: BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
  • student_id: BIGINT NOT NULL REFERENCES hostel_students(id) ON DELETE CASCADE
  • hostel_id: BIGINT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE
  • date: DATE NOT NULL
  • meal_type_id: BIGINT REFERENCES meal_types(id) ON DELETE SET NULL
  • skip_type: TEXT NOT NULL DEFAULT 'SKIP' CHECK (skip_type IN ('SKIP', 'LEAVE', 'RETURN'))
  • reason: TEXT
  • approved: BOOLEAN NOT NULL DEFAULT TRUE
  • created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
  • updated_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
Constraints:
  - UNIQUE (student_id, date, meal_type_id)
```

### Dead Code Evaluation: `MessBilling`
**RECOMMENDATION: DO NOT MIGRATE.**  
The audit confirmed zero DRF views, serializers, URLs, or frontend pages exist for `MessBilling`. Creating dead tables in Supabase adds maintenance overhead without user value. The migration SQL script will omit `MessBilling`. If billing is required in the future, it can be engineered as a dedicated phase with payment gateway integration.

---

## 3. Identity & Account Migration Design

### Comparison of Identity Mapping Strategies

| Strategy | Mechanism | Pros | Cons | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Strategy A: Ephemeral Mapping Table** | Separate lookup table `django_id_map(django_id, supabase_uuid)` discarded after import | Clean final schema with no legacy artifacts | Difficult to trace historical issues if data discrepancies occur post-launch | Acceptable |
| **Strategy B: Deterministic UUID Generation** | `uuid5(NAMESPACE_DNS, 'user_' + django_id)` | Predictable ID mapping without state lookup | Does not handle new users naturally; tight coupling to legacy sequencing | Not Recommended |
| **Strategy C: Import with `legacy_django_id` column** *(RECOMMENDED)* | Import existing users with `profiles.legacy_django_id = user.id`. Foreign keys in domain tables are remapped to the new UUIDs directly during migration ETL. | 1. Zero ambiguity during verification.<br>2. Direct mapping validation.<br>3. Enables 100% auditability.<br>4. Column can be dropped or kept read-only. | Leaves one optional integer column on `profiles` | **WINNER (RECOMMENDED)** |

### User Password & Credentials Strategy
Django uses PBKDF2 with SHA-256 (`pbkdf2_sha256$iterations$...`), while Supabase Auth default is bcrypt.  
**DECISION REQUIRED:**  
1. **Option 1 (Automated Password Migration via Supabase Custom Hasher or Admin API)**: Migrate users via Supabase Admin API with their existing PBKDF2 hashes (supported via Supabase CLI or GoTrue PBKDF2 hash import format).
2. **Option 2 (Staged Onboarding / Password Reset)**: Pre-seed known staging accounts (`password123` as seen in `seed_data.py`) and trigger standard Supabase password-reset magic links for real production student emails.
*For production cutover, Option 1 is architecturally specified. For development/staging testing, seed users are provisioned with standard passwords via the Admin Auth API.*

---

## 4. Role Architecture & Claim Enforcement

### Role Strategy Comparison
1. **JWT Custom Claims (`app_metadata.role`)**: Fast, evaluated directly in RLS without extra queries. Requires sync triggers on role update.
2. **Table Query (`profiles.role`)**: Always current, but requires an extra table read (`SELECT role FROM profiles WHERE id = auth.uid()`) inside RLS policies.
3. **Hybrid Architecture (RECOMMENDED)**:
   - Supabase `auth.users` holds `raw_app_meta_data->>'role'`.
   - `profiles.role` mirrors the role in the database.
   - A PostgreSQL trigger on `profiles` keeps `auth.users.raw_app_meta_data` synchronized.
   - RLS evaluates `(auth.jwt() -> 'app_metadata' ->> 'role')` for zero-query performance, backed by a helper function `auth.user_role()`.

```sql
-- Helper function to extract user role cleanly in RLS
CREATE OR REPLACE FUNCTION auth.user_role() 
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (SELECT role FROM public.profiles WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE;
```

---

## 5. Complete Row Level Security (RLS) Policy Design

Every public table has `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`.

### Role Permissions Summary Table

| Table | ADMIN | WARDEN | SECURITY | STUDENT |
| :--- | :--- | :--- | :--- | :--- |
| `profiles` | ALL | SELECT all; UPDATE self | SELECT all; UPDATE self | SELECT self; UPDATE self |
| `hostels` | ALL | SELECT all; UPDATE assigned | SELECT all | SELECT all |
| `hostel_wardens` | ALL | SELECT all; UPDATE self | SELECT all | SELECT all |
| `hostel_caretakers` | ALL | SELECT all; UPDATE self | SELECT all | SELECT all |
| `hostel_courses` | ALL | SELECT all | SELECT all | SELECT all |
| `hostel_rooms` | ALL | SELECT & UPDATE (Assigned) | SELECT all | SELECT own room & roommates |
| `hostel_students` | ALL | SELECT & UPDATE (Assigned) | SELECT all (Read-only) | SELECT self & roommates; UPDATE self phone |
| `hostel_outside_students`| ALL | SELECT & UPDATE (Assigned) | SELECT all (Read-only) | NO ACCESS |
| `issues` | ALL | SELECT & UPDATE (Assigned) | SELECT all (Read-only) | SELECT own; INSERT own; NO UPDATE/DELETE |
| `issue_updates` | ALL | SELECT (Assigned); INSERT | SELECT (Read-only) | SELECT for own issues; NO INSERT/UPDATE |
| `gate_passes` | ALL | SELECT & UPDATE status (Assigned)| SELECT approved; UPDATE movement| SELECT own; INSERT own |
| `visitor_logs` | ALL | SELECT (Assigned) | SELECT all; INSERT; UPDATE check_out| SELECT where student_id = own profile |
| `menus` / `menu_items` | ALL | SELECT all; UPDATE assigned | SELECT all | SELECT all |
| `meal_skips` | ALL | SELECT (Assigned) | SELECT all | SELECT own; INSERT own; DELETE own |

---

## 6. Hostel Scoping for Wardens

### The Problem in Django
In `apps/warden/views.py`:
```python
def get_warden_hostels(user):
    hostels = Hostel.objects.filter(warden__user=user)
    if not hostels.exists():
        hostels = Hostel.objects.all() # <--- DANGEROUS FALLBACK TO EVERYTHING!
    return hostels
```

### The Supabase Scoping Mechanism
In Supabase, we define an immutable SQL security helper that resolves the warden's strictly assigned hostel IDs. If a warden is assigned to zero hostels, it returns an empty set—**never falling back to all hostels**.

```sql
CREATE OR REPLACE FUNCTION auth.get_warden_hostel_ids(warden_profile_id UUID)
RETURNS TABLE (hostel_id BIGINT) AS $$
  SELECT h.id 
  FROM public.hostels h
  JOIN public.hostel_wardens w ON h.warden_id = w.id
  WHERE w.profile_id = warden_profile_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

RLS Expression for Warden Scoping:
```sql
-- Example for issues table
CREATE POLICY warden_issues_policy ON public.issues
FOR ALL TO authenticated
USING (
  auth.user_role() = 'ADMIN' OR
  (auth.user_role() = 'WARDEN' AND hostel_id IN (SELECT auth.get_warden_hostel_ids(auth.uid())))
);
```

---

## 7. Room Allocation RPC Design (`allocate_student_room`)

### Concurrency & Locking Requirements
To prevent race conditions, the target room record must be locked via `SELECT ... FOR UPDATE` before capacity is checked and bed assignment is written.

### RPC Signature
```sql
CREATE OR REPLACE FUNCTION public.allocate_student_room(
  p_student_id BIGINT,
  p_room_id BIGINT,
  p_bed_number TEXT DEFAULT '1',
  p_is_outside BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
```

### Pseudocode Logic
```text
BEGIN
  1. Authorize: Ensure auth.user_role() IN ('ADMIN', 'WARDEN').
     If WARDEN: Verify target room belongs to a hostel in auth.get_warden_hostel_ids(auth.uid()).
     Else raise EXCEPTION 'Permission denied';

  2. Lock Target Room:
     SELECT id, capacity, hostel_id INTO v_room
     FROM public.hostel_rooms
     WHERE id = p_room_id
     FOR UPDATE;
     If not found, raise EXCEPTION 'Room % not found', p_room_id;

  3. Calculate Current Total Occupancy:
     v_current_occupants := (SELECT COUNT(*) FROM public.hostel_students WHERE room_id = p_room_id)
                          + (SELECT COUNT(*) FROM public.hostel_outside_students WHERE room_id = p_room_id);

  4. Capacity Enforcement:
     IF v_current_occupants >= v_room.capacity THEN
       RAISE EXCEPTION 'Room is at full capacity (%)', v_room.capacity;
     END IF;

  5. Bed Collision Check:
     IF EXISTS (SELECT 1 FROM public.hostel_students WHERE room_id = p_room_id AND bed_number = p_bed_number)
        OR EXISTS (SELECT 1 FROM public.hostel_outside_students WHERE room_id = p_room_id AND bed_number = p_bed_number) THEN
       RAISE EXCEPTION 'Bed % is already occupied in room %', p_bed_number, p_room_id;
     END IF;

  6. Vacate Previous Room (if student was already allotted elsewhere):
     IF NOT p_is_outside THEN
       UPDATE public.hostel_students SET room_id = NULL, bed_number = NULL, room_allotted = FALSE WHERE id = p_student_id;
     ELSE
       UPDATE public.hostel_outside_students SET room_id = NULL, bed_number = NULL, room_allotted = FALSE WHERE id = p_student_id;
     END IF;

  7. Assign Resident to Target Room:
     IF NOT p_is_outside THEN
       UPDATE public.hostel_students 
       SET room_id = p_room_id, bed_number = p_bed_number, room_allotted = TRUE, updated_at = NOW()
       WHERE id = p_student_id;
     ELSE
       UPDATE public.hostel_outside_students 
       SET hostel_id = v_room.hostel_id, room_id = p_room_id, bed_number = p_bed_number, room_allotted = TRUE, updated_at = NOW()
       WHERE id = p_student_id;
     END IF;

  8. Return Success Payload:
     RETURN jsonb_build_object('success', true, 'room_id', p_room_id, 'bed_number', p_bed_number);
END;
```

---

## 8. Room Vacating RPC Design (`vacate_student_room`)

### RPC Signature
```sql
CREATE OR REPLACE FUNCTION public.vacate_student_room(
  p_student_id BIGINT,
  p_is_outside BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
```

### Pseudocode Logic
```text
BEGIN
  1. Authorize: Ensure auth.user_role() IN ('ADMIN', 'WARDEN').
  
  2. Locate and Clear Student Room:
     IF NOT p_is_outside THEN
       SELECT room_id INTO v_old_room_id FROM public.hostel_students WHERE id = p_student_id FOR UPDATE;
       UPDATE public.hostel_students 
       SET room_id = NULL, bed_number = NULL, room_allotted = FALSE, updated_at = NOW()
       WHERE id = p_student_id;
     ELSE
       SELECT room_id INTO v_old_room_id FROM public.hostel_outside_students WHERE id = p_student_id FOR UPDATE;
       UPDATE public.hostel_outside_students 
       SET room_id = NULL, bed_number = NULL, room_allotted = FALSE, updated_at = NOW()
       WHERE id = p_student_id;
     END IF;

  3. Return Success:
     RETURN jsonb_build_object('success', true, 'vacated_room_id', v_old_room_id);
END;
```

---

## 9. Bed Assignment Model Design

### Comparison of Options
1. **Separate `beds` table**: Highest normalization, but adds joins and schema complexity for simple integer/string bed labels.
2. **Partial Unique Index on `(room_id, bed_number)` (RECOMMENDED)**:
   - PostgreSQL allows:
     ```sql
     CREATE UNIQUE INDEX uq_resident_bed ON public.hostel_students (room_id, bed_number) 
     WHERE room_id IS NOT NULL AND bed_number IS NOT NULL;
     ```
   - Enforced natively by PostgreSQL engine; impossible for duplicate bed assignments to occur even if an RPC bug were introduced.

---

## 10. Room Vacancy Model: Dynamic vs Persisted

### The Flaw in Django
In Django, `room.vacant = True` was written on vacate without verifying whether 1 resident was still in a 2-person room.

### Comparison & Recommendation
* **Option A: Persist `vacant` column**: Duplicated derived state prone to drift.
* **Option B: Dynamic Computation via View / Virtual Column (RECOMMENDED)**:
  - Do NOT store `vacant` as an editable column on `hostel_rooms`.
  - Calculate `vacant` dynamically in database views:
    ```sql
    vacant := (capacity > (SELECT COUNT(*) FROM hostel_students WHERE room_id = hr.id) + (SELECT COUNT(*) FROM hostel_outside_students WHERE room_id = hr.id))
    ```
  - Eliminates state drift entirely.

---

## 11. Gate Pass State Machine & Lifecycle Design

### Valid State Transitions
```text
                  ┌──────────────┐
                  │   PENDING    │
                  └──────┬───────┘
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
      ┌──────────────┐        ┌──────────────┐
      │   APPROVED   │        │   REJECTED   │ (Terminal)
      └──────┬───────┘        └──────────────┘
             │
             │ [EXIT stamped by Security]
             ▼
      ┌──────────────┐
      │ OUTSIDE /    │ (actual_exit_time IS NOT NULL,
      │ IN MOVEMENT  │  actual_entry_time IS NULL)
      └──────┬───────┘
             │
             │ [ENTRY stamped by Security]
             ▼
      ┌──────────────┐
      │  COMPLETED   │ (Terminal)
      └──────────────┘
```

### Invalid Transitions to Reject:
- `ENTRY` before `EXIT` $\rightarrow$ REJECT.
- Double `EXIT` $\rightarrow$ REJECT.
- Movement on `REJECTED` or `PENDING` pass $\rightarrow$ REJECT.
- Movement on `COMPLETED` pass $\rightarrow$ REJECT.

---

## 12. Gate Pass QR Verification Architecture

1. **Strict Token Verification**:
   - Verification searches by `token = p_uuid`.
   - The token is a cryptographically secure UUID4.
2. **Elimination of Silent Enrollment-Number QR Fallback**:
   - The previous Django implementation would search for the latest approved pass if an enrollment string was supplied.
   - In Supabase, the camera QR scanner **MUST** strictly supply the UUID token.
   - If an enrollment number lookup is needed (e.g., student lost phone), it must be an explicit, separate RPC `lookup_student_active_pass(enrollment_no)` restricted to `SECURITY` and logged in audit logs.

---

## 13. Gate Movement RPC Design (`log_gate_movement`)

### RPC Signature
```sql
CREATE OR REPLACE FUNCTION public.log_gate_movement(
  p_pass_id BIGINT,
  p_movement_type TEXT -- 'EXIT' or 'ENTRY'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
```

### Pseudocode Logic
```text
BEGIN
  1. Authorize:
     IF auth.user_role() NOT IN ('ADMIN', 'SECURITY') THEN
       RAISE EXCEPTION 'Only Security Guards or Admins can stamp gate movements';
     END IF;

  2. Lock Gate Pass Row:
     SELECT * INTO v_pass FROM public.gate_passes WHERE id = p_pass_id FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'Gate pass % not found', p_pass_id; END IF;

  3. Validate Status:
     IF v_pass.status != 'approved' AND NOT (v_pass.status = 'approved' AND p_movement_type = 'ENTRY') THEN
       RAISE EXCEPTION 'Gate pass is not approved (Current status: %)', v_pass.status;
     END IF;

  4. Process EXIT:
     IF p_movement_type = 'EXIT' THEN
       IF v_pass.actual_exit_time IS NOT NULL THEN
         RAISE EXCEPTION 'Exit movement has already been logged at %', v_pass.actual_exit_time;
       END IF;
       UPDATE public.gate_passes
       SET actual_exit_time = NOW(), security_guard_id = auth.uid(), updated_at = NOW()
       WHERE id = p_pass_id;

  5. Process ENTRY:
     ELSIF p_movement_type = 'ENTRY' THEN
       IF v_pass.actual_exit_time IS NULL THEN
         RAISE EXCEPTION 'Cannot record ENTRY before an EXIT has been recorded';
       END IF;
       IF v_pass.actual_entry_time IS NOT NULL THEN
         RAISE EXCEPTION 'Entry movement has already been logged at %', v_pass.actual_entry_time;
       END IF;
       
       -- Check if late
       v_is_late := NOW() > (v_pass.expected_return_date + v_pass.expected_return_time);

       UPDATE public.gate_passes
       SET actual_entry_time = NOW(), status = 'completed', is_late = v_is_late, security_guard_id = auth.uid(), updated_at = NOW()
       WHERE id = p_pass_id;
     ELSE
       RAISE EXCEPTION 'Invalid movement type: %', p_movement_type;
     END IF;

  RETURN jsonb_build_object('success', true, 'pass_id', p_pass_id, 'movement', p_movement_type);
END;
```

---

## 14. Issue Status Updates & Mandatory Audit Trail

### Problem in Django
Direct `PATCH /api/hms/issues/{id}/` could change status without creating an `IssueUpdate` row, and lacked role authorization.

### Supabase Architecture: Trigger-Enforced Audit
Status auditing is enforced at the database level via a PostgreSQL trigger `AFTER UPDATE OF status ON public.issues`. No client or RPC can ever change issue status without an audit record being automatically committed.

```sql
CREATE OR REPLACE FUNCTION public.trig_fn_audit_issue_status()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- If resolved, set resolved_at
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
      NEW.resolved_at := NOW();
    END IF;

    INSERT INTO public.issue_updates (
      issue_id,
      old_status,
      new_status,
      note,
      updated_by,
      created_at
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      current_setting('hms.current_issue_note', true), -- Optional note passed in session
      auth.uid(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 15. Real-Time Dashboard Views (Zero N+1)

### Definition of Occupancy
Both Admin and Warden dashboards must adhere to the exact same formula:
$$\text{Occupancy} = \text{Allotted Regular Students} + \text{Allotted Outside Students}$$

### 15.1 View: `view_admin_dashboard_stats`
```sql
CREATE OR REPLACE VIEW public.view_admin_dashboard_stats AS
WITH room_aggregates AS (
  SELECT 
    COUNT(id) AS total_rooms,
    COALESCE(SUM(capacity), 0) AS total_capacity
  FROM public.hostel_rooms
),
resident_counts AS (
  SELECT
    (SELECT COUNT(*) FROM public.hostel_students WHERE room_allotted = TRUE) +
    (SELECT COUNT(*) FROM public.hostel_outside_students WHERE room_allotted = TRUE) AS occupied_beds
),
ticket_counts AS (
  SELECT
    (SELECT COUNT(*) FROM public.gate_passes WHERE status = 'pending') AS pending_gate_passes,
    (SELECT COUNT(*) FROM public.issues WHERE status != 'completed') AS active_issues
)
SELECT 
  (SELECT COUNT(*) FROM public.hostels) AS total_hostels,
  ra.total_rooms,
  rc.occupied_beds AS total_students,
  (SELECT COUNT(*) FROM public.hostel_wardens) AS total_wardens,
  (SELECT COUNT(*) FROM public.hostel_caretakers) AS total_caretakers,
  ra.total_capacity,
  rc.occupied_beds,
  GREATEST(0, ra.total_capacity - rc.occupied_beds) AS vacant_beds,
  CASE WHEN ra.total_capacity > 0 
       THEN ROUND((rc.occupied_beds::NUMERIC / ra.total_capacity::NUMERIC * 100), 1)
       ELSE 0 END AS occupancy_rate,
  tc.pending_gate_passes,
  tc.active_issues
FROM room_aggregates ra, resident_counts rc, ticket_counts tc;
```

### 15.2 View: `view_warden_dashboard_stats`
Provides per-hostel aggregates scoped for wardens:
```sql
CREATE OR REPLACE VIEW public.view_warden_dashboard_stats AS
SELECT 
  h.id AS hostel_id,
  h.name AS hostel_name,
  h.gender,
  h.floor_count,
  COUNT(DISTINCT hr.id) AS total_rooms,
  COALESCE(SUM(hr.capacity), 0) AS total_capacity,
  (SELECT COUNT(*) FROM public.hostel_students hs JOIN public.hostel_rooms r ON hs.room_id = r.id WHERE r.hostel_id = h.id AND hs.room_allotted = TRUE) +
  (SELECT COUNT(*) FROM public.hostel_outside_students hos WHERE hos.hostel_id = h.id AND hos.room_allotted = TRUE) AS occupied_beds,
  (SELECT COUNT(*) FROM public.gate_passes gp WHERE gp.hostel_id = h.id AND gp.status = 'pending') AS pending_gate_passes,
  (SELECT COUNT(*) FROM public.issues iss WHERE iss.hostel_id = h.id AND iss.status != 'completed') AS open_issues
FROM public.hostels h
LEFT JOIN public.hostel_rooms hr ON hr.hostel_id = h.id
GROUP BY h.id, h.name, h.gender, h.floor_count;
```

---

## 16. Data Invariants (Non-Negotiable Truths)

```text
INVARIANT 1 (Room Capacity Cap):
For every room R, (SELECT COUNT(*) FROM hostel_students WHERE room_id = R.id) 
                + (SELECT COUNT(*) FROM hostel_outside_students WHERE room_id = R.id) <= R.capacity.

INVARIANT 2 (Unique Bed Assignment):
No two residents (regular or outside) may have the same bed_number in the same room_id.

INVARIANT 3 (Single Active Allocation):
A resident cannot be allotted to more than one room simultaneously.

INVARIANT 4 (Strict Hostel Scoping):
A Warden cannot read, update, or approve records for a hostel they are not assigned to.

INVARIANT 5 (Gate Pass Sequence):
actual_entry_time can only be recorded if actual_exit_time IS NOT NULL.

INVARIANT 6 (One-Time Token Use):
A completed gate pass token cannot be scanned or used for movement again.

INVARIANT 7 (Audit Integrity):
Every update to issue status MUST create a corresponding row in issue_updates.

INVARIANT 8 (Meal Skip Uniqueness):
UNIQUE(student_id, date, meal_type_id) enforced at database level.
```

---

## 17. Storage Architecture Design

Since Cloudflare was confirmed absent, Supabase Storage is configured cleanly:

```text
Bucket: 'avatars'
  • Type: Public Bucket (Read access to all authenticated and anonymous users via CDN)
  • Allowed Mime Types: image/jpeg, image/png, image/webp
  • Max File Size: 2 MB
  • Storage Path Strategy: avatars/{profile_id}/{timestamp}.webp
  • RLS Policies:
      - SELECT: Allow public read
      - INSERT / UPDATE: Allow where (auth.uid() = profile_id OR auth.user_role() = 'ADMIN')
      - DELETE: Allow where (auth.uid() = profile_id OR auth.user_role() = 'ADMIN')
```

*(Documents or institutional assets can be provisioned in a secondary private bucket `documents` when needed in future phases).*

---

## 18. Frontend API Replacement Map

| Current Django Endpoint | Method | Supabase Replacement Call | Type |
| :--- | :--- | :--- | :--- |
| `/api/auth/login/` | POST | `supabase.auth.signInWithPassword({ email, password })` | Auth |
| `/api/auth/token/refresh/`| POST | Automatically handled by `@supabase/supabase-js` session client | Auth |
| `/api/auth/logout/` | POST | `supabase.auth.signOut()` | Auth |
| `/api/auth/me/` | GET | `supabase.from('profiles').select('*').eq('id', user.id).single()`| Table Query |
| `/api/auth/profile/` | PATCH | `supabase.from('profiles').update(data).eq('id', user.id)` | Table Query |
| `/api/auth/profile/` | POST | `supabase.auth.updateUser({ password: newPassword })` | Auth |
| `/api/hms/dashboard/stats/`| GET | `supabase.from('view_admin_dashboard_stats').select('*').single()` | View Query |
| `/api/hms/hostels/` | GET, POST | `supabase.from('hostels').select('*, warden:hostel_wardens(*)')` | Table Query |
| `/api/hms/rooms/` | GET, POST | `supabase.from('hostel_rooms').select('*, occupants:hostel_students(*)')` | Table Query |
| `/api/hms/rooms/bulk_create_rooms/` | POST | `supabase.rpc('bulk_create_rooms', { p_hostel_id, p_floor, p_count, ... })` | RPC |
| `/api/hms/students/` | GET, POST | `supabase.from('hostel_students').select('*, room:hostel_rooms(*)')` | Table Query |
| `/api/student/students/allocate_room/` | POST | `supabase.rpc('allocate_student_room', { p_student_id, p_room_id, ... })` | RPC |
| `/api/student/students/{id}/vacate_room/` | POST | `supabase.rpc('vacate_student_room', { p_student_id })` | RPC |
| `/api/student/students/my_profile/` | GET | `supabase.from('hostel_students').select('*, room:hostel_rooms(*, hostel:hostels(*))').eq('profile_id', user.id).single()` | Table Query |
| `/api/hms/issues/` | GET, POST | `supabase.from('issues').select('*, student:hostel_students(*), updates:issue_updates(*)')` | Table Query |
| `/api/hms/issues/{id}/update_status/` | POST | `supabase.rpc('update_issue_status', { p_issue_id, p_status, p_note })` | RPC / Trigger |
| `/api/hms/gate-passes/` | GET, POST | `supabase.from('gate_passes').select('*')` | Table Query |
| `/api/security/gate-passes/my_passes/` | GET | `supabase.from('gate_passes').select('*')` (Filtered by RLS) | Table Query |
| `/api/security/gate-passes/{id}/warden_action/` | POST | `supabase.from('gate_passes').update({ status, action_note, approved_by: user.id, actioned_at: new Date() }).eq('id', id)` | Table Query |
| `/api/security/gate-passes/verify_token/` | GET | `supabase.from('gate_passes').select('*, student:hostel_students(*)').eq('token', token).single()` | Table Query |
| `/api/security/gate-passes/{id}/log_movement/` | POST | `supabase.rpc('log_gate_movement', { p_pass_id, p_movement_type })` | RPC |
| `/api/hms/visitor-logs/` | GET, POST | `supabase.from('visitor_logs').select('*')` | Table Query |
| `/api/security/visitors/{id}/check_out/` | POST | `supabase.from('visitor_logs').update({ check_out_time: new Date() }).eq('id', id)` | Table Query |
| `/api/warden/dashboard/` | GET | `supabase.from('view_warden_dashboard_stats').select('*')` | View Query |
| `/api/mess/menus/today_menu/` | GET | `supabase.from('menus').select('*, items:menu_items(*)').eq('day_of_week', dow)` | Table Query |
| `/api/mess/skips/` | GET, POST | `supabase.from('meal_skips').select('*')` | Table Query |

---

## 19. API Removal & Decommissioning Matrix

Every single Django endpoint will be completely removed upon cutover:
* **All DRF ViewSets & Routers**: Discarded.
* **SimpleJWT URLs**: Discarded.
* **Django CORS Middleware**: Discarded.
* **No legacy REST proxy needed**: The React frontend will communicate directly with Supabase.

---

## 20. Edge Functions Assessment

**VERDICT: No Edge Functions required initially.**  
All operations (QR verification, atomic room allocation, gate movements, status updates, and reporting views) execute faster and more reliably directly inside PostgreSQL as SQL functions and triggers. External integrations (e.g., SMS alerts via Twilio, automated email notifications) can be evaluated in post-migration enhancements.

---

## 21. Realtime Capabilities Tradeoff Assessment

| Channel / Table | Realtime Enabled? | Justification |
| :--- | :--- | :--- |
| `gate_passes` | **YES** | Security guards and wardens benefit immediately from live updates when a pass is approved or a student exits/enters. |
| `issues` | **YES** | Live ticketing feedback for students and maintenance staff. |
| `visitor_logs` | **OPTIONAL (NO initially)** | Visitor entry volume is modest; regular query on mount is sufficient. |
| `hostels` / `rooms` | **NO** | Static infrastructural data with low update frequency. |

---

## 22. End-to-End Data Migration Plan

```text
Step 1: Data Extraction
  • Run pg_dump / SQL export of Django tables from PostgreSQL:
    auth_user, hms_admin_*, student_*, warden_*, security_*, mess_*
  • Export as JSON / CSV staging format.

Step 2: User Account Creation in Supabase Auth
  • For each row in auth_user:
    - Insert into auth.users with generated UUID (or pass-through).
    - Insert into public.profiles with legacy_django_id = auth_user.id.

Step 3: Relational Transformation & Remapping
  • Build dictionary: django_user_id -> supabase_uuid.
  • Replace all user FKs in domain tables (HostelWarden, HostelCaretaker, HostelStudent, GatePass, etc.).

Step 4: Load Dependent Domain Tables (Foreign Key Order)
  1. hostel_courses
  2. hostel_wardens & hostel_caretakers
  3. hostels & hostel_course_assignments
  4. hostel_rooms
  5. hostel_students & hostel_outside_students
  6. issues & issue_updates
  7. gate_passes (preserve existing token UUIDs)
  8. visitor_logs
  9. meal_types, menu_items, menus, menu_item_links, meal_skips

Step 5: Automated Verification Queries
  • Assert COUNT(old_table) == COUNT(new_table) for all entities.
  • Assert zero orphan foreign keys.
  • Assert bed assignment uniqueness holds across existing dataset.
```

---

## 23. Production Cutover & Rollback Strategy

```text
Maintenance Window Sequence:
  1. Freeze writes on Django (set DEBUG=False, block POST/PUT in Nginx or redirect to maintenance notice).
  2. Perform final delta pg_dump from existing PostgreSQL.
  3. Run ETL script to migrate delta records into Supabase.
  4. Run integrity test suite on Supabase database.
  5. Deploy Vite frontend build with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY configured.
  6. Perform live smoke testing across all 4 roles (Admin, Warden, Security, Student).
  7. Lift maintenance mode.

Rollback Procedure:
  • If blocking bugs occur during smoke testing:
    - Revert DNS / frontend deployment back to Django API endpoint.
    - Re-enable writes on Django PostgreSQL.
    - Django database remains completely unmodified and valid throughout this process.
```

---

## 24. Test Strategy & Verification Matrix

Before and during migration, the following automated matrix must pass:

### 1. Authentication & Role Portals
- `TEST_AUTH_01`: Admin login $\rightarrow$ routed to `/admin/dashboard` $\rightarrow$ JWT claims role = `'ADMIN'`.
- `TEST_AUTH_02`: Warden login $\rightarrow$ routed to `/warden/dashboard` $\rightarrow$ restricted to assigned hostel.
- `TEST_AUTH_03`: Security login $\rightarrow$ routed to `/security/scanner`.
- `TEST_AUTH_04`: Student login $\rightarrow$ routed to `/student/dashboard`.

### 2. Authorization Security Checks
- `TEST_SEC_01`: Student attempting `UPDATE` on `issues.status` $\rightarrow$ Denied by RLS (0 rows affected).
- `TEST_SEC_02`: Student attempting `log_gate_movement` $\rightarrow$ Denied by RPC authorization.
- `TEST_SEC_03`: Warden querying unassigned hostel rooms $\rightarrow$ Returns empty set.

### 3. Room Allocation Concurrency
- `TEST_ALLOC_01`: Allocate resident to room with capacity 2 $\rightarrow$ Success.
- `TEST_ALLOC_02`: Concurrently allocate 2 residents to room with 1 vacant bed $\rightarrow$ Exactly 1 succeeds, 1 receives capacity error.
- `TEST_ALLOC_03`: Allocate resident to an already occupied bed number $\rightarrow$ Rejects with bed collision error.

### 4. Gate Movement State Sequence
- `TEST_GATE_01`: Call `ENTRY` movement before `EXIT` $\rightarrow$ Rejects with sequence error.
- `TEST_GATE_02`: Call `EXIT` twice on same pass $\rightarrow$ Rejects with duplicate exit error.
- `TEST_GATE_03`: Verify token using camera QR payload $\rightarrow$ Returns valid active pass.

---

## 25. Phased Implementation Roadmap

```text
Phase 0: Testing Baseline
  └── Write E2E smoke tests against running system (login, allocation, gate pass, issue flow).

Phase 1: Database DDL & Schema Provisioning
  └── Execute complete Supabase SQL DDL (Tables, Constraints, Indexes, Views).

Phase 2: RLS Policies & Security Hardening
  └── Apply RLS policies across all tables; deploy auth.get_warden_hostel_ids helper.

Phase 3: Stored Procedures & Triggers
  └── Deploy allocate_student_room, vacate_student_room, log_gate_movement, and audit triggers.

Phase 4: Storage Provisioning
  └── Create 'avatars' public bucket and configure storage RLS.

Phase 5: Data Migration ETL
  └── Run migration scripts; transform integer IDs to UUIDs; verify record counts.

Phase 6: Frontend SDK Integration
  └── Install @supabase/supabase-js; replace authService.ts and apiClient.ts with supabaseClient.

Phase 7: Component-by-Component Cutover
  ├── 7.1 Auth & Profile (Login.tsx, AuthContext.tsx, HMSProfile.tsx)
  ├── 7.2 Admin Portal (AdminDashboard, HostelManagement, RoomManagement, StudentManagement)
  ├── 7.3 Warden Portal (WardenDashboard, WardenGatePassManagement, WardenIssueManagement)
  ├── 7.4 Security Portal (GatePassScanner.tsx, VisitorLogsManagement.tsx)
  └── 7.5 Student Portal (StudentDashboard, StudentGatePasses, StudentIssues, StudentMeals)

Phase 8: End-to-End Regression & Acceptance Testing
  └── Run test suite; verify zero regressions and zero broken invariants.

Phase 9: Production Cutover & Go-Live
  └── Execute final delta sync, switch frontend environment variables, monitor telemetry.

Phase 10: Decommission Django
  └── Terminate Django server processes; archive legacy backend directory.
```

---

## 26. Final Design Review & Architecture Principles

### Must Decide Before Implementation
1. **User Password Migration Policy**: Confirm whether existing users will be imported with hashed passwords (Option 1) or sent password reset invites (Option 2).
2. **Outside Student Billing Scope**: Confirm whether outside students require future billing records or remain directory-only.

### Safe to Implement Immediately
1. Complete PostgreSQL DDL schema (Tables, Foreign Keys, Indexes, Constraints).
2. Database Views for dashboard telemetry.
3. RPC Stored Procedures (`allocate_student_room`, `vacate_student_room`, `log_gate_movement`).
4. Trigger-enforced status audit trail for maintenance issues.
5. All RLS security policies.

### High-Risk Design Areas Requiring Strict Review
1. **Concurrent Bed Booking**: Ensure the partial unique index and row locking (`FOR UPDATE`) are rigorously tested under automated parallel requests.
2. **Gate Movement Sequence**: Validate that mobile clock differences cannot compromise server-side `NOW()` timestamps.

### 10 Core Architecture Principles
1. **React is never the source of authorization truth**: Client checks only improve UX; all security is enforced by RLS and RPCs.
2. **RLS is mandatory on every public table**: Direct REST table access is locked down by default.
3. **Security-critical state transitions execute server-side**: Gate movement and issue status updates cannot be arbitrarily set by client REST patches.
4. **Room allocation is atomic**: No room can be overbooked under any concurrent load.
5. **Gate movement is strictly sequenced**: Students cannot enter before they exit.
6. **Audit records cannot be bypassed**: Triggers guarantee audit updates regardless of mutation vector.
7. **Derived state is never duplicated**: Room vacancy and metrics are computed dynamically to prevent drift.
8. **Cloudflare is discarded in favor of Supabase Storage**: Unneeded third-party baggage is eliminated.
9. **Zero Django legacy endpoints survive**: The cutover completely retires Django.
10. **Data integrity comes first**: Django is not decommissioned until regression testing passes completely.
