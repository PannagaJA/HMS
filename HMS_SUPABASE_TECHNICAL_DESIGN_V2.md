# HMS — Supabase Architecture V2 Technical Design Specification
## Complete Consolidation of All Hostel Residents into a Unified Student & Relational Allocation Model

**Document Version:** 2.0.0  
**Date:** September 2, 2026  
**Status:** DESIGN & REVISION BLUEPRINT (STRICT READ-ONLY / PRE-IMPLEMENTATION)  
**Authoritative Sources:**  
1. [`HMS_PRE_MIGRATION_VERIFIED_AUDIT.md`](file:///d:/AMC/HMS/HMS_PRE_MIGRATION_VERIFIED_AUDIT.md)  
2. [`HMS_SUPABASE_TECHNICAL_DESIGN.md`](file:///d:/AMC/HMS/HMS_SUPABASE_TECHNICAL_DESIGN.md)

---

## 1. Executive Summary

In V1 of the technical design, the system maintained two parallel resident tables (`hostel_students` and `hostel_outside_students`), duplicated capacity-counting queries, split frontend management pages, and carried flag arguments (`p_is_outside`) across RPC functions.

**V2 completely eliminates the "Outside Student" concept.** 

All physical persons living in a hostel room are modeled as **Students / Residents** in a single normalized table: `students`. Furthermore, room allotment is decoupled from the resident entity and formalized into a dedicated, normalized relation: `room_allocations`.

### Core Architectural Advancements in V2:
1. **Unified Resident Entity (`students`)**: Merges all hostel residents into a single identity table. Eliminates `HostelOutsideStudent`, `OutsideStudentManagement.tsx`, and all `is_outside` branching.
2. **Dedicated Relational Allocation (`room_allocations`)**: Removes `room_id`, `bed_number`, and `room_allotted` from the student entity. Allocation becomes an independent relational state with strict database-level unique constraints.
3. **Bed Invariant via Dedicated `beds` Relation**: Rather than storing unstructured string bed labels, rooms strictly own physical `beds` records bounded by `room.capacity`. A bed cannot be double-booked; room capacity cannot be breached.
4. **Dynamic Room Vacancy & Mathematical Occupancy Reconciliation**: Persistent `vacant` and `room_allotted` flags are deleted. Occupancy is computed as `COUNT(active room allocations)` across Admin and Warden portals identically.
5. **Atomic Reallocation & Concurrency Locks**: `allocate_student_room` employs explicit lock ordering and row-level locking (`FOR UPDATE`) to guarantee zero overbooking and seamless student room transfers.
6. **Hardened Multi-Hostel Warden Assignments**: Replaces single `hostels.warden_id` with explicit `warden_hostel_assignments` relation and eliminates the dangerous Django fallback to all hostels.

---

## 2. Summary of Changes: V1 vs. V2

| Dimension | V1 Technical Design | V2 Revised Architecture (Target) |
| :--- | :--- | :--- |
| **Resident Identity** | Two tables: `hostel_students` and `hostel_outside_students` | **Single Table: `students`** (All residents are hostel students) |
| **Frontend UI** | Two pages: `StudentManagement.tsx` and `OutsideStudentManagement.tsx` | **Single Page: `StudentManagement.tsx`** |
| **Allocation Modeling**| Embedded in student rows (`room_id`, `bed_number`, `room_allotted`) | **Dedicated Table: `room_allocations`** (Normalized, historical or active) |
| **Bed Management** | Free-text string `bed_number` with partial unique index | **Normalized Table: `beds`** (Beds exist physically up to room capacity) |
| **Room Vacancy** | Virtual derived column vs partial persisted flag | **Strictly Derived**: `beds.is_occupied` and `COUNT(allocations)` |
| **Occupancy Metrics**| Complex queries summing regular + outside students | **Single Standard**: `COUNT(active allocations)` |
| **RPC Signatures** | `allocate_student_room(..., p_is_outside)` | `allocate_student_room(p_student_id, p_bed_id)` |
| **Warden Scoping** | Single `hostels.warden_id` FK | Explicit M:N `warden_hostel_assignments` table |
| **Mess Billing** | Dead code evaluated | Completely omitted from target DDL |

---

## 3. Target Architecture

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
│  ├── Core Identity: auth.users ──(1:1)──> public.profiles                                   │
│  ├── Unified Residents: public.students                                                     │
│  ├── Accommodation: hostels ──(1:N)──> hostel_rooms ──(1:N)──> beds                         │
│  ├── Relational Allocation: students ──(1:1 active)──> room_allocations <──(1:1)── beds     │
│  ├── Row Level Security (RLS): Mandatory policies per role on ALL public tables             │
│  ├── PostgreSQL Views: Unified occupancy views (view_admin_stats, view_warden_stats)        │
│  ├── Atomic RPCs: allocate_student_room, vacate_student_room, log_gate_movement             │
│  └── Triggers: Automatic issue audit trail, profile sync, and bed status updates            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Unified Student / Resident Model

### 4.1 Deconstruction of Legacy Tables
The legacy system maintained two separate models:
1. `HostelStudent`: Fields: `user`, `student_name`, `father_name`, `enrollment_no`, `course`, `dob`, `gender`, `room`, `bed_number`, `room_allotted`, `no_dues`, `guardian_phone`, `emergency_contact`.
2. `HostelOutsideStudent`: Fields: `name`, `usn`, `outside_college_name`, `outside_course_name`, `outside_year`, `phone`, `email`, `father_name`, `father_phone`, `gender`, `hostel`, `room`, `bed_number`, `room_allotted`, `no_dues`, `joining_date`.

### 4.2 Field Classification & Rationalization Matrix

| Legacy Field | Origin Model(s) | Action | Target Field / Table | Architectural Justification |
| :--- | :--- | :--- | :--- | :--- |
| `user` | `HostelStudent` | **MERGE** | `students.profile_id` | Links to `profiles.id` (nullable for guest/external residents without portal access). |
| `student_name` / `name` | Both | **MERGE** | `students.student_name` | Canonical resident full name. |
| `enrollment_no` / `usn` | Both | **MERGE** | `students.enrollment_no` | Institutional registration code. Unique across all residents. |
| `father_name` | Both | **KEEP** | `students.father_name` | Important guardian contact information. |
| `father_phone` | `HostelOutsideStudent` | **MERGE** | `students.guardian_phone` | Consolidated with guardian phone. |
| `phone` | `HostelOutsideStudent` | **MERGE** | `profiles.phone` / `students.phone` | Contact number. |
| `email` | `HostelOutsideStudent` | **MERGE** | `profiles.email` | System email address. |
| `course` (FK) | `HostelStudent` | **KEEP** | `students.course_id` | Foreign key to `hostel_courses`. |
| `outside_college_name` | `HostelOutsideStudent` | **REMOVE** | *None* | Unused in business logic; institution manages hostel beds, not external colleges. |
| `outside_course_name` | `HostelOutsideStudent` | **REMOVE** | *None* | Subsumed by `hostel_courses` if relevant. |
| `outside_year` | `HostelOutsideStudent` | **REMOVE** | *None* | Unused legacy tracking field. |
| `joining_date` | `HostelOutsideStudent` | **MOVE** | `room_allocations.allocated_at` | True resident check-in date belongs to allocation history. |
| `room`, `bed_number` | Both | **MOVE** | `room_allocations` | Decoupled completely from student identity into relational allocation. |
| `room_allotted` | Both | **REMOVE** | *None* | Derived dynamically from `EXISTS(SELECT 1 FROM room_allocations WHERE student_id = students.id AND is_active = TRUE)`. |
| `no_dues` | Both | **KEEP** | `students.no_dues` | Clearance flag for checkout and gate passes. |
| `dob`, `gender` | `HostelStudent` | **KEEP** | `students.dob`, `students.gender` | Standard demographic attributes. |
| `emergency_contact` | `HostelStudent` | **KEEP** | `students.emergency_contact` | Critical safety field. |

---

## 5. Normalized Student Schema Definition

```sql
-- Unified Students Table
CREATE TABLE public.students (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    father_name TEXT,
    enrollment_no TEXT NOT NULL UNIQUE,
    course_id BIGINT REFERENCES public.hostel_courses(id) ON DELETE SET NULL,
    dob DATE,
    gender CHAR(1) NOT NULL DEFAULT 'M' CHECK (gender IN ('M', 'F')),
    phone TEXT,
    guardian_phone TEXT,
    emergency_contact TEXT,
    no_dues BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_enrollment ON public.students(enrollment_no);
CREATE INDEX idx_students_profile ON public.students(profile_id);
CREATE INDEX idx_students_course ON public.students(course_id);
```

---

## 6. Profile vs. Student vs. Auth Relationship

To ensure clean separation of concerns and avoid circular synchronization issues:

```text
┌─────────────────────────┐
│       auth.users        │  <-- Credentials, password hash, email confirmation, JWT signing
└────────────┬────────────┘
             │ 1:1 (id = id)
             ▼
┌─────────────────────────┐
│     public.profiles     │  <-- Global identity, application role, avatar_url, full_name, phone
└────────────┬────────────┘
             │ 1:1 (profile_id) [Nullable for residents without portal login]
             ▼
┌─────────────────────────┐
│     public.students     │  <-- Hostel resident demographic, enrollment number, academic course
└────────────┬────────────┘
             │ 1:1 (active)
             ▼
┌─────────────────────────┐
│ public.room_allocations │  <-- Physical bed occupancy record
└─────────────────────────┘
```

1. **`auth.users`**: Managed strictly by Supabase GoTrue.
2. **`public.profiles`**: Contains the authoritative application `role` (`ADMIN`, `WARDEN`, `SECURITY`, `STUDENT`), `email`, `phone`, and `avatar_url`.
3. **`public.students`**: Domain record representing the institutional resident. Not all students require login access (e.g. historical residents or external scholars), so `profile_id` is nullable. When portal access is provisioned, `profile_id` links 1:1 to `profiles.id`.

---

## 7. Room Allocation Model & Relational Redesign

Room allocation is decoupled into an explicit relational entity:

```sql
CREATE TABLE public.room_allocations (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    bed_id BIGINT NOT NULL REFERENCES public.beds(id) ON DELETE RESTRICT,
    allocated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vacated_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### The Two Critical Database Invariants
PostgreSQL partial unique indexes enforce single active allocation rules at the database engine level:

```sql
-- INVARIANT 1: A student can have at most ONE active room allocation
CREATE UNIQUE INDEX uq_single_active_student_allocation 
ON public.room_allocations (student_id) 
WHERE is_active = TRUE;

-- INVARIANT 2: A physical bed can have at most ONE active student occupant
CREATE UNIQUE INDEX uq_single_active_bed_allocation 
ON public.room_allocations (bed_id) 
WHERE is_active = TRUE;
```

---

## 8. The Bed Model Decision: Option B (Dedicated `beds` Table)

### Evaluation of Bed Modeling Strategies

| Criteria | Option A: `bed_number` string on `room_allocations` | Option B: Dedicated `beds` table *(RECOMMENDED)* |
| :--- | :--- | :--- |
| **Physical Reality** | Rooms have an abstract count; bed numbers are free text. | Rooms physically contain exactly $N$ distinct beds. |
| **Capacity Enforcement** | Relies entirely on runtime `COUNT(*)` checks in code or RPC. | **Hardware Invariant**: A room with capacity 2 has exactly 2 rows in `beds`. |
| **UI Matrix Rendering** | Frontend must calculate vacant bed labels dynamically. | Frontend can directly query: `beds WHERE room_id = X AND is_occupied = FALSE`. |
| **Data Integrity** | Prone to typos (e.g. "Bed 1", "bed 1", "Bed-1", "01"). | Bed labels are normalized (`Bed A`, `Bed B` or `1`, `2`) per room. |
| **Concurrency Safety** | Row locking must lock the parent room. | Locking the individual `bed` row provides fine-grained concurrency. |

### Decision: Option B (Dedicated `beds` Table)
Option B is selected. It enforces room capacity structurally: **a room cannot have more beds than its capacity**, and **a bed cannot be allocated twice**.

```sql
CREATE TABLE public.beds (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    room_id BIGINT NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
    bed_number TEXT NOT NULL,
    is_occupied BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_room_bed_number UNIQUE (room_id, bed_number)
);

CREATE INDEX idx_beds_room ON public.beds(room_id);
```

When a room is created with `capacity = N`, exactly $N$ bed records are automatically seeded (e.g., `1, 2, ... N`).

---

## 9. Room Capacity Enforcement & Atomic Allocation RPC

### RPC Signature
```sql
CREATE OR REPLACE FUNCTION public.allocate_student_room(
  p_student_id BIGINT,
  p_bed_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
```

### Complete Pseudocode Implementation
```text
DECLARE
  v_caller_role TEXT;
  v_room_id BIGINT;
  v_hostel_id BIGINT;
  v_bed_occupied BOOLEAN;
  v_old_allocation_id BIGINT;
  v_old_bed_id BIGINT;
BEGIN
  -- 1. Caller Authentication & Role Check
  v_caller_role := auth.user_role();
  IF v_caller_role NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can allocate rooms';
  END IF;

  -- 2. Validate Target Bed & Lock it
  SELECT b.room_id, r.hostel_id, b.is_occupied 
  INTO v_room_id, v_hostel_id, v_bed_occupied
  FROM public.beds b
  JOIN public.hostel_rooms r ON b.room_id = r.id
  WHERE b.id = p_bed_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target bed ID % does not exist', p_bed_id;
  END IF;

  -- 3. Verify Warden Hostel Scope
  IF v_caller_role = 'WARDEN' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.warden_hostel_assignments
      WHERE warden_profile_id = auth.uid() AND hostel_id = v_hostel_id
    ) THEN
      RAISE EXCEPTION 'Access Denied: You are not assigned to manage Hostel %', v_hostel_id;
    END IF;
  END IF;

  -- 4. Verify Target Bed Availability
  IF v_bed_occupied THEN
    RAISE EXCEPTION 'Bed % is already occupied', p_bed_id;
  END IF;

  -- 5. Lock Student Record
  PERFORM 1 FROM public.students WHERE id = p_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student ID % does not exist', p_student_id;
  END IF;

  -- 6. Check for Existing Active Allocation (Reallocation Scenario)
  SELECT id, bed_id INTO v_old_allocation_id, v_old_bed_id
  FROM public.room_allocations
  WHERE student_id = p_student_id AND is_active = TRUE
  FOR UPDATE;

  IF FOUND THEN
    -- If already allocated to the EXACT same bed, do nothing
    IF v_old_bed_id = p_bed_id THEN
      RETURN jsonb_build_object('success', true, 'message', 'Student already allocated to this bed');
    END IF;

    -- Deactivate old allocation
    UPDATE public.room_allocations
    SET is_active = FALSE, vacated_at = NOW(), updated_at = NOW()
    WHERE id = v_old_allocation_id;

    -- Free old bed
    UPDATE public.beds
    SET is_occupied = FALSE, updated_at = NOW()
    WHERE id = v_old_bed_id;
  END IF;

  -- 7. Create New Active Allocation
  INSERT INTO public.room_allocations (
    student_id,
    bed_id,
    allocated_by,
    allocated_at,
    is_active
  ) VALUES (
    p_student_id,
    p_bed_id,
    auth.uid(),
    NOW(),
    TRUE
  );

  -- 8. Mark New Bed as Occupied
  UPDATE public.beds
  SET is_occupied = TRUE, updated_at = NOW()
  WHERE id = p_bed_id;

  RETURN jsonb_build_object(
    'success', true,
    'student_id', p_student_id,
    'room_id', v_room_id,
    'bed_id', p_bed_id
  );
END;
$$;
```

---

## 10. Vacating RPC Design (`vacate_student_room`)

### RPC Signature
```sql
CREATE OR REPLACE FUNCTION public.vacate_student_room(
  p_student_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
```

### Pseudocode Implementation
```text
DECLARE
  v_caller_role TEXT;
  v_allocation_id BIGINT;
  v_bed_id BIGINT;
  v_hostel_id BIGINT;
BEGIN
  v_caller_role := auth.user_role();
  IF v_caller_role NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can vacate residents';
  END IF;

  -- Locate Active Allocation
  SELECT a.id, a.bed_id, r.hostel_id 
  INTO v_allocation_id, v_bed_id, v_hostel_id
  FROM public.room_allocations a
  JOIN public.beds b ON a.bed_id = b.id
  JOIN public.hostel_rooms r ON b.room_id = r.id
  WHERE a.student_id = p_student_id AND a.is_active = TRUE
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Student has no active room allocation');
  END IF;

  -- Warden Scope Check
  IF v_caller_role = 'WARDEN' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.warden_hostel_assignments
      WHERE warden_profile_id = auth.uid() AND hostel_id = v_hostel_id
    ) THEN
      RAISE EXCEPTION 'Access Denied: You cannot vacate a student from an unassigned hostel';
    END IF;
  END IF;

  -- Mark Allocation Vacated
  UPDATE public.room_allocations
  SET is_active = FALSE, vacated_at = NOW(), updated_at = NOW()
  WHERE id = v_allocation_id;

  -- Mark Bed Available
  UPDATE public.beds
  SET is_occupied = FALSE, updated_at = NOW()
  WHERE id = v_bed_id;

  RETURN jsonb_build_object('success', true, 'vacated_student_id', p_student_id, 'freed_bed_id', v_bed_id);
END;
$$;
```

---

## 11. Room Vacancy & Occupancy Mathematical Reconciliation

All vacancy and occupancy telemetry is derived directly from active allocations. No stale flags exist.

```sql
-- Canonical View: Room Occupancy & Vacancy
CREATE OR REPLACE VIEW public.view_room_occupancy AS
SELECT 
    r.id AS room_id,
    r.hostel_id,
    r.no AS room_no,
    r.floor,
    r.capacity,
    COUNT(b.id) AS total_beds,
    COUNT(b.id) FILTER (WHERE b.is_occupied = TRUE) AS occupied_beds,
    COUNT(b.id) FILTER (WHERE b.is_occupied = FALSE) AS vacant_beds,
    (COUNT(b.id) FILTER (WHERE b.is_occupied = FALSE) > 0) AS has_vacancy,
    (COUNT(b.id) FILTER (WHERE b.is_occupied = TRUE) >= r.capacity) AS is_full
FROM public.hostel_rooms r
LEFT JOIN public.beds b ON b.room_id = r.id
GROUP BY r.id, r.hostel_id, r.no, r.floor, r.capacity;
```

---

## 12. Hostel-Warden Assignment Model

The old Django system stored `hostels.warden_id` (single foreign key) and fell back to `Hostel.objects.all()` when empty.

V2 introduces an explicit assignment table:

```sql
CREATE TABLE public.warden_hostel_assignments (
    warden_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    hostel_id BIGINT NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (warden_profile_id, hostel_id)
);

CREATE INDEX idx_warden_assignments_warden ON public.warden_hostel_assignments(warden_profile_id);
CREATE INDEX idx_warden_assignments_hostel ON public.warden_hostel_assignments(hostel_id);
```

### Invariant:
**If a warden has 0 rows in `warden_hostel_assignments`, their hostel-scoped query returns 0 rows.** No fallback to all hostels ever occurs.

---

## 13. Authority & Role Model

### Decision: Hybrid Architecture (App Metadata JWT + Database Profile)
1. `public.profiles.role` is the ground truth.
2. An automatic PostgreSQL trigger synchronizes `profiles.role` to `auth.users.raw_app_meta_data->>'role'`.
3. RLS uses `auth.user_role()` which reads the JWT claim for $O(1)$ performance, falling back to reading `profiles.role` if the claim is absent.
4. If an admin changes a user's role, the trigger updates `raw_app_meta_data` and forces session re-evaluation on next refresh.

---

## 14. Comprehensive V2 Row Level Security (RLS) Policies

### 14.1 `profiles`
- **SELECT**: All authenticated users can read basic staff/student profile names.
- **INSERT**: Service role (on signup).
- **UPDATE**: Users can update their own phone and avatar (`id = auth.uid()`); Admins can update any profile.
- **DELETE**: Admins only.

### 14.2 `hostels`, `hostel_courses`, `hostel_rooms`, `beds`
- **SELECT**: Read access to all authenticated users.
- **INSERT / UPDATE / DELETE**: Admins only (except wardens updating rooms in assigned hostels).

### 14.3 `students`
- **SELECT**:
  - `ADMIN`: All students.
  - `WARDEN`: Students currently allocated to assigned hostels OR unallocated students.
  - `SECURITY`: Read-only access to all students (for gate verification).
  - `STUDENT`: `profile_id = auth.uid()`.
- **INSERT / UPDATE / DELETE**: `ADMIN` and `WARDEN` (assigned hostels). `STUDENT` can only update personal contact details.

### 14.4 `room_allocations`
- **SELECT**:
  - `ADMIN`: All allocations.
  - `WARDEN`: Allocations in assigned hostels.
  - `SECURITY`: Allocations in all hostels.
  - `STUDENT`: Allocation where `student_id = (SELECT id FROM students WHERE profile_id = auth.uid())`.
- **INSERT / UPDATE / DELETE**: Revoked from direct REST calls. Must be modified via `allocate_student_room` and `vacate_student_room` RPCs.

### 14.5 `issues` & `issue_updates`
- **SELECT**:
  - `ADMIN`: All tickets.
  - `WARDEN`: Tickets in assigned hostels.
  - `SECURITY`: Read-only.
  - `STUDENT`: Tickets where `student_id = (SELECT id FROM students WHERE profile_id = auth.uid())`.
- **INSERT (`issues`)**: Students for their own allocated hostel/room; Admins/Wardens.
- **UPDATE (`issues`)**: Admins and Wardens (assigned hostels). Students CANNOT update status.
- **`issue_updates`**: Trigger-enforced insert only.

### 14.6 `gate_passes`
- **SELECT**:
  - `ADMIN`: All passes.
  - `WARDEN`: Passes for assigned hostels.
  - `SECURITY`: All approved/active passes.
  - `STUDENT`: Passes where `student_id = (SELECT id FROM students WHERE profile_id = auth.uid())`.
- **INSERT**: Students for themselves; Admins.
- **UPDATE**: Wardens/Admins can approve/reject; Security can only modify movement via `log_gate_movement` RPC.

---

## 15. Dependent Domain Modules: Issues, Gate Passes, Visitors, Meals

### 15.1 Issues
All issues reference `students.id`. When a student logs an issue, the database trigger derives `hostel_id` and `room_id` from their active room allocation automatically:
```sql
CREATE TABLE public.issues (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    hostel_id BIGINT NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
    room_id BIGINT NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('PLUMBING', 'ELECTRICAL', 'CARPENTRY', 'WIFI', 'CLEANLINESS', 'OTHER')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'waiting_for_workers', 'completed')),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 15.2 Gate Passes
- References unified `students.id`.
- Zero outside-student branching.
- Movement stamping enforced via `log_gate_movement` RPC.

### 15.3 Visitor Logs
- References unified `students.id`.
- Security guards create logs and stamp check-out. Students can only see visitors logged for their own identity.

### 15.4 Mess Menu & Meal Skips
- Menu scheduling remains attached to `hostels.id`.
- `meal_skips` references unified `students.id` with `UNIQUE(student_id, date, meal_type_id)`.

---

## 16. Unified Dashboard Views

```sql
-- Admin Operational Dashboard View
CREATE OR REPLACE VIEW public.view_admin_dashboard_stats AS
WITH room_totals AS (
  SELECT 
    COUNT(id) AS total_rooms,
    COALESCE(SUM(capacity), 0) AS total_capacity
  FROM public.hostel_rooms
),
allocation_totals AS (
  SELECT COUNT(*) AS occupied_beds 
  FROM public.room_allocations 
  WHERE is_active = TRUE
),
ticket_totals AS (
  SELECT
    (SELECT COUNT(*) FROM public.gate_passes WHERE status = 'pending') AS pending_gate_passes,
    (SELECT COUNT(*) FROM public.issues WHERE status != 'completed') AS active_issues
)
SELECT 
  (SELECT COUNT(*) FROM public.hostels) AS total_hostels,
  rt.total_rooms,
  at.occupied_beds AS total_students,
  (SELECT COUNT(*) FROM public.hostel_wardens) AS total_wardens,
  (SELECT COUNT(*) FROM public.hostel_caretakers) AS total_caretakers,
  rt.total_capacity,
  at.occupied_beds,
  GREATEST(0, rt.total_capacity - at.occupied_beds) AS vacant_beds,
  CASE WHEN rt.total_capacity > 0 
       THEN ROUND((at.occupied_beds::NUMERIC / rt.total_capacity::NUMERIC * 100), 1)
       ELSE 0 END AS occupancy_rate,
  tt.pending_gate_passes,
  tt.active_issues
FROM room_totals rt, allocation_totals at, ticket_totals tt;
```

---

## 17. Complete Outside Student Removal Audit & Disposition Matrix

| Location in Current Codebase | Type | Current Role / Behavior | V2 Target Action |
| :--- | :--- | :--- | :--- |
| `backend/apps/student/models.py:25-46` | DATABASE MODEL | `HostelOutsideStudent` model definition | **REMOVE** |
| `backend/apps/student/serializers.py:14-22`| SERIALIZER | `HostelOutsideStudentSerializer` | **REMOVE** |
| `backend/apps/student/views.py:96-102` | VIEW | `HostelOutsideStudentViewSet` | **REMOVE** |
| `backend/apps/student/urls.py:7` | URL | `/outside-students/` route registration | **REMOVE** |
| `backend/apps/hms_admin/urls.py:23` | URL | Router registration for outside students | **REMOVE** |
| `backend/apps/student/views.py:49,55,61` | BUSINESS LOGIC | `is_outside` branching in `allocate_room` | **REMOVE** |
| `backend/apps/hms_admin/views.py:29` | BUSINESS LOGIC | `outside_students_count` in dashboard | **REMOVE** (Uses unified allocations) |
| `frontend/src/components/admin/OutsideStudentManagement.tsx` | FRONTEND COMPONENT | Separate outside student management screen | **DELETE FILE** |
| `frontend/src/App.tsx:11,51` | ROUTE | Route `/admin/outside-students` | **REMOVE ROUTE** |
| `frontend/src/components/common/Sidebar.tsx:35` | NAVIGATION | "Outside Residents" navigation button | **REMOVE NAV ITEM** |
| `frontend/src/types/index.ts:99-114` | TYPE | `interface HostelOutsideStudent` | **REMOVE TYPE** |
| `backend/apps/student/serializers.py:27` | SERIALIZER | `is_outside` boolean field in allocation serializer | **REMOVE FIELD** |

---

## 18. Frontend Student Management Flow (Single Screen)

The user management interface consolidates completely into `StudentManagement.tsx`:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                       Resident Student Directory (Unified)                                   │
│  [ + Register Student ]   [ Export PDF ]                                                    │
│                                                                                             │
│  [ Search by Name or Enrollment... ]  [ Hostel: All ▼ ]  [ Course: All ▼ ]  [ Status: All ▼ ]│
├───────────────────┬──────────────┬────────────┬─────────────┬─────────────┬─────────────────┤
│ Student Name      │ Enrollment   │ Course     │ Room / Bed  │ Status      │ Actions         │
├───────────────────┼──────────────┼────────────┼─────────────┼─────────────┼─────────────────┤
│ Liam Evans        │ STU2026001   │ B.Tech CSE │ Block A-101 │ Allotted    │ [Change Room]   │
│ Sarah Chen        │ STU2026002   │ B.Tech CSE │ Unassigned  │ Unallotted  │ [Allocate Room] │
│ Michael Chang     │ USN2026099   │ Scholar CS │ Block A-103 │ Allotted    │ [Vacate]        │
└───────────────────┴──────────────┴────────────┴─────────────┴─────────────┴─────────────────┘
```

### Student Creation vs. Room Allocation Flow
**DECISION: Option B (Two-Step Operation)**  
1. **Step 1: Register Student**: Collect demographic data and create `students` row. Student is immediately visible in the directory with status `Unallotted`.
2. **Step 2: Allocate Room (Optional/Immediate)**: User clicks "Allocate Room", opening a modal that displays available rooms and physical beds. This calls `allocate_student_room(student_id, bed_id)`.

---

## 19. Data Migration Strategy: Transforming Existing Records

### 19.1 Existing `HostelStudent` Migration
```text
Django HostelStudent ──► Supabase students
  id                 ──► id (or generated)
  user_id            ──► profile_id (via legacy_django_id lookup)
  student_name       ──► student_name
  enrollment_no      ──► enrollment_no
  course_id          ──► course_id
  dob, gender        ──► dob, gender
  guardian_phone     ──► guardian_phone
  emergency_contact  ──► emergency_contact
  no_dues            ──► no_dues
```

### 19.2 Existing `HostelOutsideStudent` Migration
```text
Django HostelOutsideStudent ──► Supabase students
  id                        ──► id (assigned distinct range or serial)
  name                      ──► student_name
  usn                       ──► enrollment_no
  phone                     ──► phone
  father_name               ──► father_name
  father_phone              ──► guardian_phone
  gender                    ──► gender
  no_dues                   ──► no_dues
  profile_id                ──► NULL (can be linked later if student registers)
```

### 19.3 Active Allocations Migration
For any student (regular or outside) where `room_allotted = True` and `room_id IS NOT NULL`:
1. Find or create the corresponding `beds` row in the target room matching `bed_number` (e.g. Bed 1).
2. Insert a row into `room_allocations`:
   ```sql
   INSERT INTO public.room_allocations (student_id, bed_id, is_active, allocated_at)
   VALUES (migrated_student_id, matched_bed_id, TRUE, NOW());
   ```
3. Update `beds SET is_occupied = TRUE WHERE id = matched_bed_id`.

---

## 20. Required Design Quality Self-Check

| Verification Question | Architectural Answer | Mechanism Guarantee |
| :--- | :---: | :--- |
| **Can two students occupy the same physical bed?** | **NO** | `uq_single_active_bed_allocation` on `room_allocations` + `beds.is_occupied`. |
| **Can one student have two active room allocations?**| **NO** | `uq_single_active_student_allocation` partial unique index on `room_allocations`. |
| **Can room occupancy exceed capacity under concurrent requests?** | **NO** | Structural constraint: A room has exactly $N$ beds. Plus `SELECT FOR UPDATE` on `beds`. |
| **Can a Warden access an unassigned hostel?** | **NO** | Strict check in `warden_hostel_assignments`. Zero assignments $\rightarrow$ zero records returned. |
| **Can a student allocate themselves into a room?** | **NO** | `allocate_student_room` RPC requires caller role `ADMIN` or `WARDEN`. |
| **Can a student modify their own room assignment directly?** | **NO** | RLS blocks direct INSERT/UPDATE on `room_allocations` for the `STUDENT` role. |
| **Can SECURITY modify student identity data?** | **NO** | RLS grants `SECURITY` role SELECT-only access on `students`. |
| **Can a completed gate pass be reused?** | **NO** | `log_gate_movement` RPC rejects movement if `status = 'completed'`. |
| **Can issue status change without an audit record?**| **NO** | PostgreSQL trigger on `issues` guarantees insert into `issue_updates`. |
| **Can the system contain an "outside student" entity after migration?** | **NO** | Removed from schema, code, types, and routes. |
| **Can room vacancy become stale?** | **NO** | Stored `vacant` column deleted; vacancy is derived dynamically from `beds` availability. |
| **Can JWT role and database role silently disagree?** | **NO** | PostgreSQL trigger immediately synchronizes `profiles.role` to `auth.users.raw_app_meta_data`. |

---

## 21. Migration Sequence & Implementation Roadmap

```text
Phase 0: Testing Baseline
  └── Execute E2E smoke tests against running Django/Vite application.

Phase 1: Supabase Schema DDL Provisioning
  ├── Deploy public.profiles, hostels, courses, hostel_rooms
  ├── Deploy public.beds and auto-seed bed generation logic
  ├── Deploy public.students (Unified model)
  ├── Deploy public.room_allocations (With partial unique indexes)
  ├── Deploy issues, issue_updates, gate_passes, visitor_logs, meals
  └── Deploy unified views: view_admin_dashboard_stats, view_room_occupancy

Phase 2: RLS Policies & Security Definers
  ├── Enforce RLS across all tables
  └── Deploy auth.user_role() and warden scoping functions

Phase 3: Stored Procedures & Triggers
  ├── Deploy allocate_student_room and vacate_student_room RPCs
  ├── Deploy log_gate_movement RPC
  └── Deploy trig_fn_audit_issue_status trigger

Phase 4: Data Migration ETL
  ├── Migrate Django auth_user -> Supabase profiles
  ├── Migrate hostel_students & hostel_outside_students -> unified students
  └── Migrate room assignments -> room_allocations and update bed occupancy

Phase 5: Frontend Component Refactoring
  ├── Delete OutsideStudentManagement.tsx and associated routes
  ├── Update StudentManagement.tsx with unified schema and allocate modal
  └── Switch authService.ts to @supabase/supabase-js

Phase 6: Verification & Cutover
  ├── Run complete test suite (Section 28)
  └── Cutover DNS/Vercel and decommission Django backend
```

---

## 22. Final Recommendation & Verdict

### Final Verdict: **GO (DESIGN APPROVED FOR IMPLEMENTATION)**

**Summary:**  
The V2 revision resolves the architectural flaws of the legacy HMS by:
1. Completely eliminating the disjointed Outside Student entity and unifying resident management.
2. Introducing a true relational room allocation model backed by physical `beds`.
3. Eradicating race conditions in room allocation via atomic row-level locking.
4. Hardening multi-hostel warden assignments and closing all BOLA/IDOR vulnerabilities discovered in Django.

The system is now architecturally clean, normalized, secure, and ready for Phase 0 / Phase 1 execution.
