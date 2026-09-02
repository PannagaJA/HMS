-- =============================================================================
-- Migration 012: Hardened Business RPC Layer
-- =============================================================================

-- 1. Create Room With Beds (Enforces COUNT(beds) = capacity)
CREATE OR REPLACE FUNCTION public.create_room_with_beds(
  p_hostel_id BIGINT,
  p_room_no TEXT,
  p_floor INTEGER,
  p_capacity INTEGER,
  p_room_type CHAR(1) DEFAULT 'D'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_new_room_id BIGINT;
  i INTEGER;
BEGIN
  IF auth.user_role() != 'ADMIN' THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can create rooms';
  END IF;
  IF p_capacity < 1 THEN
    RAISE EXCEPTION 'Capacity must be at least 1';
  END IF;

  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type)
  VALUES (p_hostel_id, p_room_no, p_floor, p_capacity, p_room_type)
  RETURNING id INTO v_new_room_id;

  FOR i IN 1..p_capacity LOOP
    INSERT INTO public.beds (room_id, bed_number)
    VALUES (v_new_room_id, i);
  END LOOP;

  RETURN v_new_room_id;
END;
$$;

-- 2. Resize Room Capacity
CREATE OR REPLACE FUNCTION public.resize_room_capacity(
  p_room_id BIGINT,
  p_new_capacity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_old_capacity INTEGER;
  v_occupied_beds_in_excess INTEGER;
  i INTEGER;
BEGIN
  IF auth.user_role() != 'ADMIN' THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can resize room capacity';
  END IF;
  IF p_new_capacity < 1 THEN
    RAISE EXCEPTION 'Capacity must be at least 1';
  END IF;

  SELECT capacity INTO v_old_capacity 
  FROM public.hostel_rooms 
  WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Room % not found', p_room_id; END IF;
  IF p_new_capacity = v_old_capacity THEN
    RETURN jsonb_build_object('success', true, 'message', 'Capacity unchanged');
  END IF;

  IF p_new_capacity > v_old_capacity THEN
    UPDATE public.hostel_rooms SET capacity = p_new_capacity, updated_at = NOW() WHERE id = p_room_id;
    FOR i IN (v_old_capacity + 1)..p_new_capacity LOOP
      INSERT INTO public.beds (room_id, bed_number) VALUES (p_room_id, i);
    END LOOP;
  ELSE
    SELECT COUNT(*) INTO v_occupied_beds_in_excess
    FROM public.beds b
    JOIN public.room_allocations a ON a.bed_id = b.id AND a.is_active = TRUE
    WHERE b.room_id = p_room_id AND b.bed_number > p_new_capacity;

    IF v_occupied_beds_in_excess > 0 THEN
      RAISE EXCEPTION 'Cannot reduce capacity: % bed(s) in the reduction zone are currently occupied. Vacate or reassign residents first.', v_occupied_beds_in_excess;
    END IF;

    DELETE FROM public.beds
    WHERE room_id = p_room_id AND bed_number > p_new_capacity;

    UPDATE public.hostel_rooms SET capacity = p_new_capacity, updated_at = NOW() WHERE id = p_room_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'room_id', p_room_id, 'old_capacity', v_old_capacity, 'new_capacity', p_new_capacity);
END;
$$;

-- 3. Decommission Room
CREATE OR REPLACE FUNCTION public.decommission_room(p_room_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.user_role() != 'ADMIN' THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can decommission rooms';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.beds b
    JOIN public.room_allocations a ON a.bed_id = b.id AND a.is_active = TRUE
    WHERE b.room_id = p_room_id
  ) THEN
    RAISE EXCEPTION 'Cannot decommission room: Residents are currently allocated. Vacate all beds first.';
  END IF;

  UPDATE public.hostel_rooms SET is_active = FALSE, updated_at = NOW() WHERE id = p_room_id;
  RETURN jsonb_build_object('success', true, 'room_id', p_room_id, 'is_active', false);
END;
$$;

-- 4. Allocate Student Room
CREATE OR REPLACE FUNCTION public.allocate_student_room(
  p_student_id BIGINT,
  p_bed_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_room_id BIGINT;
  v_hostel_id BIGINT;
  v_student_status TEXT;
  v_existing_alloc_id BIGINT;
  v_new_alloc_id BIGINT;
BEGIN
  v_caller_role := auth.user_role();
  IF v_caller_role NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can allocate rooms';
  END IF;

  -- 1. Validate Target Bed & Room & Hostel
  SELECT b.room_id, r.hostel_id INTO v_room_id, v_hostel_id
  FROM public.beds b
  JOIN public.hostel_rooms r ON b.room_id = r.id
  JOIN public.hostels h ON r.hostel_id = h.id
  WHERE b.id = p_bed_id AND r.is_active = TRUE AND h.is_active = TRUE
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bed % not found or belongs to an inactive room/hostel', p_bed_id;
  END IF;

  -- Warden Scoping Check
  IF v_caller_role = 'WARDEN' AND NOT EXISTS (
    SELECT 1 FROM public.warden_hostel_assignments 
    WHERE warden_profile_id = auth.uid() AND hostel_id = v_hostel_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: You cannot allocate residents to an unassigned hostel block';
  END IF;

  -- 2. Lock Student and Check Status
  SELECT status INTO v_student_status
  FROM public.students
  WHERE id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Student % not found', p_student_id; END IF;
  IF v_student_status != 'ACTIVE' THEN
    RAISE EXCEPTION 'Cannot allocate inactive resident (Status: %)', v_student_status;
  END IF;

  -- 3. Check Bed Occupancy
  IF EXISTS (
    SELECT 1 FROM public.room_allocations 
    WHERE bed_id = p_bed_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Bed % is already occupied', p_bed_id;
  END IF;

  -- 4. Check for Existing Active Student Allocation (Atomic Reallocation)
  SELECT id INTO v_existing_alloc_id
  FROM public.room_allocations
  WHERE student_id = p_student_id AND is_active = TRUE
  FOR UPDATE;

  IF v_existing_alloc_id IS NOT NULL THEN
    UPDATE public.room_allocations
    SET is_active = FALSE, vacated_at = NOW(), updated_at = NOW()
    WHERE id = v_existing_alloc_id;
  END IF;

  -- 5. Insert New Allocation
  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active)
  VALUES (p_student_id, p_bed_id, auth.uid(), TRUE)
  RETURNING id INTO v_new_alloc_id;

  RETURN jsonb_build_object(
    'success', true,
    'allocation_id', v_new_alloc_id,
    'student_id', p_student_id,
    'bed_id', p_bed_id,
    'reallocated', v_existing_alloc_id IS NOT NULL
  );
END;
$$;

-- 5. Vacate Student Room
CREATE OR REPLACE FUNCTION public.vacate_student_room(p_student_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_alloc_id BIGINT;
  v_hostel_id BIGINT;
BEGIN
  v_caller_role := auth.user_role();
  IF v_caller_role NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can vacate rooms';
  END IF;

  SELECT a.id, r.hostel_id INTO v_alloc_id, v_hostel_id
  FROM public.room_allocations a
  JOIN public.beds b ON a.bed_id = b.id
  JOIN public.hostel_rooms r ON b.room_id = r.id
  WHERE a.student_id = p_student_id AND a.is_active = TRUE
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active room allocation found for student %', p_student_id;
  END IF;

  IF v_caller_role = 'WARDEN' AND NOT EXISTS (
    SELECT 1 FROM public.warden_hostel_assignments 
    WHERE warden_profile_id = auth.uid() AND hostel_id = v_hostel_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: You cannot vacate a resident from an unassigned hostel block';
  END IF;

  UPDATE public.room_allocations
  SET is_active = FALSE, vacated_at = NOW(), updated_at = NOW()
  WHERE id = v_alloc_id;

  RETURN jsonb_build_object('success', true, 'student_id', p_student_id, 'vacated_allocation_id', v_alloc_id);
END;
$$;

-- 6. Update Issue Status (With Atomic Audit Insertion)
CREATE OR REPLACE FUNCTION public.update_issue_status(
  p_issue_id BIGINT,
  p_new_status TEXT,
  p_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_old_status TEXT;
  v_hostel_id BIGINT;
BEGIN
  v_caller_role := auth.user_role();
  IF v_caller_role NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can update ticket status';
  END IF;

  SELECT status, hostel_id INTO v_old_status, v_hostel_id
  FROM public.issues
  WHERE id = p_issue_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Issue % not found', p_issue_id; END IF;

  IF v_caller_role = 'WARDEN' AND NOT EXISTS (
    SELECT 1 FROM public.warden_hostel_assignments 
    WHERE warden_profile_id = auth.uid() AND hostel_id = v_hostel_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: Issue belongs to an unassigned hostel block';
  END IF;

  IF p_new_status NOT IN ('pending', 'in_progress', 'waiting_for_workers', 'completed') THEN
    RAISE EXCEPTION 'Invalid status: %', p_new_status;
  END IF;

  UPDATE public.issues
  SET status = p_new_status,
      resolved_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE NULL END,
      updated_at = NOW()
  WHERE id = p_issue_id;

  INSERT INTO public.issue_updates (
    issue_id, old_status, new_status, note, updated_by, created_at
  ) VALUES (
    p_issue_id, v_old_status, p_new_status, p_note, auth.uid(), NOW()
  );

  RETURN jsonb_build_object('success', true, 'issue_id', p_issue_id, 'new_status', p_new_status);
END;
$$;

-- 7. Approve Gate Pass
CREATE OR REPLACE FUNCTION public.approve_gate_pass(
  p_pass_id BIGINT,
  p_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_hostel_id BIGINT;
  v_status TEXT;
BEGIN
  v_caller_role := auth.user_role();
  IF v_caller_role NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can approve gate passes';
  END IF;

  SELECT hostel_id, status INTO v_hostel_id, v_status
  FROM public.gate_passes WHERE id = p_pass_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Gate pass % not found', p_pass_id; END IF;
  IF v_status != 'pending' THEN RAISE EXCEPTION 'Only pending passes can be approved (Current: %)', v_status; END IF;

  IF v_caller_role = 'WARDEN' AND NOT EXISTS (
    SELECT 1 FROM public.warden_hostel_assignments 
    WHERE warden_profile_id = auth.uid() AND hostel_id = v_hostel_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: You cannot approve passes for an unassigned hostel block';
  END IF;

  UPDATE public.gate_passes
  SET status = 'approved',
      approved_by = auth.uid(),
      action_note = p_note,
      actioned_at = NOW(),
      updated_at = NOW()
  WHERE id = p_pass_id;

  RETURN jsonb_build_object('success', true, 'pass_id', p_pass_id, 'status', 'approved');
END;
$$;

-- 8. Reject Gate Pass
CREATE OR REPLACE FUNCTION public.reject_gate_pass(
  p_pass_id BIGINT,
  p_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_hostel_id BIGINT;
  v_status TEXT;
BEGIN
  v_caller_role := auth.user_role();
  IF v_caller_role NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can reject gate passes';
  END IF;

  SELECT hostel_id, status INTO v_hostel_id, v_status
  FROM public.gate_passes WHERE id = p_pass_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Gate pass % not found', p_pass_id; END IF;
  IF v_status != 'pending' THEN RAISE EXCEPTION 'Only pending passes can be rejected (Current: %)', v_status; END IF;

  IF v_caller_role = 'WARDEN' AND NOT EXISTS (
    SELECT 1 FROM public.warden_hostel_assignments 
    WHERE warden_profile_id = auth.uid() AND hostel_id = v_hostel_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: You cannot reject passes for an unassigned hostel block';
  END IF;

  UPDATE public.gate_passes
  SET status = 'rejected',
      approved_by = auth.uid(),
      action_note = p_note,
      actioned_at = NOW(),
      updated_at = NOW()
  WHERE id = p_pass_id;

  RETURN jsonb_build_object('success', true, 'pass_id', p_pass_id, 'status', 'rejected');
END;
$$;

-- 9. Log Gate Movement
CREATE OR REPLACE FUNCTION public.log_gate_movement(
  p_pass_id BIGINT,
  p_movement_type TEXT -- 'EXIT' or 'ENTRY'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_pass RECORD;
  v_is_late BOOLEAN := FALSE;
  v_deadline TIMESTAMPTZ;
BEGIN
  v_caller_role := auth.user_role();
  IF v_caller_role NOT IN ('ADMIN', 'SECURITY') THEN
    RAISE EXCEPTION 'Access Denied: Only Security Guards or Admins can log gate movements';
  END IF;

  SELECT * INTO v_pass FROM public.gate_passes WHERE id = p_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gate pass % not found', p_pass_id; END IF;

  IF v_pass.status != 'approved' THEN
    RAISE EXCEPTION 'Cannot log movement: Pass status is % (must be approved)', v_pass.status;
  END IF;

  v_deadline := (v_pass.expected_return_date + v_pass.expected_return_time);

  IF p_movement_type = 'EXIT' THEN
    IF v_pass.actual_exit_time IS NOT NULL THEN
      RAISE EXCEPTION 'Exit already stamped at %', v_pass.actual_exit_time;
    END IF;
    -- Expired check: If student never exited and return deadline has passed, reject EXIT
    IF NOW() > v_deadline THEN
      UPDATE public.gate_passes SET status = 'expired', updated_at = NOW() WHERE id = p_pass_id;
      RAISE EXCEPTION 'Cannot log EXIT: Return deadline has passed. Pass is expired.';
    END IF;

    UPDATE public.gate_passes
    SET actual_exit_time = NOW(), security_guard_id = auth.uid(), updated_at = NOW()
    WHERE id = p_pass_id;

  ELSIF p_movement_type = 'ENTRY' THEN
    IF v_pass.actual_exit_time IS NULL THEN
      RAISE EXCEPTION 'Invalid movement sequence: Cannot stamp ENTRY before EXIT';
    END IF;
    IF v_pass.actual_entry_time IS NOT NULL THEN
      RAISE EXCEPTION 'Entry already stamped at %', v_pass.actual_entry_time;
    END IF;

    v_is_late := NOW() > v_deadline;

    UPDATE public.gate_passes
    SET actual_entry_time = NOW(),
        status = 'completed',
        is_late = v_is_late,
        security_guard_id = auth.uid(),
        updated_at = NOW()
    WHERE id = p_pass_id;
  ELSE
    RAISE EXCEPTION 'Invalid movement type: %', p_movement_type;
  END IF;

  RETURN jsonb_build_object('success', true, 'pass_id', p_pass_id, 'movement', p_movement_type, 'is_late', v_is_late);
END;
$$;

-- 10. Checkout Visitor
CREATE OR REPLACE FUNCTION public.checkout_visitor(p_visitor_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  v_caller_role := auth.user_role();
  IF v_caller_role NOT IN ('ADMIN', 'SECURITY') THEN
    RAISE EXCEPTION 'Access Denied: Only Security Guards or Admins can check out visitors';
  END IF;

  UPDATE public.visitor_logs
  SET check_out_time = NOW(), updated_at = NOW()
  WHERE id = p_visitor_id AND check_out_time IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visitor log % not found or already checked out', p_visitor_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'visitor_id', p_visitor_id, 'checked_out_at', NOW());
END;
$$;

-- 11. Update Profile (Restricted Self-Service)
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_phone TEXT,
  p_avatar_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
  SET phone = p_phone,
      avatar_url = p_avatar_url,
      updated_at = NOW()
  WHERE id = auth.uid();

  UPDATE public.students
  SET phone = p_phone, updated_at = NOW()
  WHERE profile_id = auth.uid();

  RETURN jsonb_build_object('success', true, 'profile_id', auth.uid());
END;
$$;
