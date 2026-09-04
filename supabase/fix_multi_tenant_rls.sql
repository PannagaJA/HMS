-- =============================================================================
-- HMS MULTI-TENANT FIX: RECURSION-FREE RLS & TENANCY TRIGGERS
-- Run this in your Supabase SQL Editor (gnmbmwplrjwkslvtcghr)
-- =============================================================================

-- 0. Ensure announcement and menu_items columns exist
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS circular_number TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Main Course';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email TEXT;

-- 1. Helper function for fast, recursion-free student lookup
CREATE OR REPLACE FUNCTION public.user_student_id()
RETURNS BIGINT AS $$
  SELECT id FROM public.students WHERE profile_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Drop recursive policies
DROP POLICY IF EXISTS policy_students_select ON public.students;
DROP POLICY IF EXISTS policy_allocations_select ON public.room_allocations;
DROP POLICY IF EXISTS policy_issues_select ON public.issues;
DROP POLICY IF EXISTS policy_issues_insert_student ON public.issues;
DROP POLICY IF EXISTS policy_issue_updates_select ON public.issue_updates;
DROP POLICY IF EXISTS policy_gate_passes_select ON public.gate_passes;
DROP POLICY IF EXISTS policy_gate_passes_insert ON public.gate_passes;
DROP POLICY IF EXISTS policy_visitor_logs_select ON public.visitor_logs;
DROP POLICY IF EXISTS policy_visitor_logs_insert ON public.visitor_logs;
DROP POLICY IF EXISTS policy_visitor_logs_update ON public.visitor_logs;
DROP POLICY IF EXISTS policy_meal_skips_select ON public.student_meal_skips;
DROP POLICY IF EXISTS policy_meal_skips_insert ON public.student_meal_skips;
DROP POLICY IF EXISTS policy_meal_skips_delete ON public.student_meal_skips;

-- 3. Recreate recursion-free policies
CREATE POLICY policy_students_select ON public.students FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin() 
    OR profile_id = auth.uid()
    OR public.is_security()
    OR (public.is_warden() AND EXISTS (
      SELECT 1 FROM public.room_allocations a
      JOIN public.beds b ON a.bed_id = b.id
      JOIN public.hostel_rooms r ON b.room_id = r.id
      WHERE a.student_id = public.students.id 
        AND a.is_active = TRUE 
        AND r.hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid()))
    ))
  )
);

CREATE POLICY policy_allocations_select ON public.room_allocations FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR public.is_security()
    OR student_id = public.user_student_id()
    OR (public.is_warden() AND EXISTS (
      SELECT 1 FROM public.beds b
      JOIN public.hostel_rooms r ON b.room_id = r.id
      WHERE b.id = bed_id AND r.hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid()))
    ))
  )
);

CREATE POLICY policy_issues_select ON public.issues FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR public.is_security()
    OR student_id = public.user_student_id()
    OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
  )
);

CREATE POLICY policy_issues_insert_student ON public.issues FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.user_org_id() AND (
    student_id = public.user_student_id()
    OR public.is_admin()
  )
);

CREATE POLICY policy_issue_updates_select ON public.issue_updates FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR (public.is_warden() AND EXISTS (
      SELECT 1 FROM public.issues i WHERE i.id = issue_id AND i.hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid()))
    ))
    OR EXISTS (
      SELECT 1 FROM public.issues i 
      WHERE i.id = issue_id AND i.student_id = public.user_student_id()
    )
  )
);

CREATE POLICY policy_gate_passes_select ON public.gate_passes FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR public.is_security()
    OR student_id = public.user_student_id()
    OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
  )
);

CREATE POLICY policy_gate_passes_insert ON public.gate_passes FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.user_org_id() AND (
    student_id = public.user_student_id()
    OR public.is_admin()
  )
);

CREATE POLICY policy_visitor_logs_select ON public.visitor_logs FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR public.is_security()
    OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
    OR student_id = public.user_student_id()
  )
);

CREATE POLICY policy_visitor_logs_insert ON public.visitor_logs FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR public.is_security()
    OR public.is_warden()
  )
);

CREATE POLICY policy_visitor_logs_update ON public.visitor_logs FOR UPDATE TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR public.is_security()
    OR public.is_warden()
  )
)
WITH CHECK (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR public.is_security()
    OR public.is_warden()
  )
);

CREATE POLICY policy_meal_skips_select ON public.student_meal_skips FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
    OR student_id = public.user_student_id()
  )
);

CREATE POLICY policy_meal_skips_insert ON public.student_meal_skips FOR INSERT TO authenticated
WITH CHECK (
  org_id = public.user_org_id() AND (
    student_id = public.user_student_id()
    OR public.is_admin()
  )
);

CREATE POLICY policy_meal_skips_delete ON public.student_meal_skips FOR DELETE TO authenticated
USING (
  org_id = public.user_org_id() AND (
    student_id = public.user_student_id()
    OR public.is_admin()
  )
);

-- 4. Auto-assign org_id on insert trigger function
CREATE OR REPLACE FUNCTION public.trig_fn_set_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL OR NEW.org_id = '00000000-0000-0000-0000-000000000001'::UUID THEN
    NEW.org_id := COALESCE(public.user_org_id(), '00000000-0000-0000-0000-000000000001'::UUID);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Attach BEFORE INSERT triggers
DROP TRIGGER IF EXISTS tr_set_org_id_hostels ON public.hostels;
CREATE TRIGGER tr_set_org_id_hostels BEFORE INSERT ON public.hostels FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_warden_assignments ON public.warden_hostel_assignments;
CREATE TRIGGER tr_set_org_id_warden_assignments BEFORE INSERT ON public.warden_hostel_assignments FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_courses ON public.hostel_courses;
CREATE TRIGGER tr_set_org_id_courses BEFORE INSERT ON public.hostel_courses FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_rooms ON public.hostel_rooms;
CREATE TRIGGER tr_set_org_id_rooms BEFORE INSERT ON public.hostel_rooms FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_beds ON public.beds;
CREATE TRIGGER tr_set_org_id_beds BEFORE INSERT ON public.beds FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_students ON public.students;
CREATE TRIGGER tr_set_org_id_students BEFORE INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_allocations ON public.room_allocations;
CREATE TRIGGER tr_set_org_id_allocations BEFORE INSERT ON public.room_allocations FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_meal_types ON public.meal_types;
CREATE TRIGGER tr_set_org_id_meal_types BEFORE INSERT ON public.meal_types FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_menu_items ON public.menu_items;
CREATE TRIGGER tr_set_org_id_menu_items BEFORE INSERT ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_menus ON public.menus;
CREATE TRIGGER tr_set_org_id_menus BEFORE INSERT ON public.menus FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_menu_links ON public.menu_item_links;
CREATE TRIGGER tr_set_org_id_menu_links BEFORE INSERT ON public.menu_item_links FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_wardens ON public.hostel_wardens;
CREATE TRIGGER tr_set_org_id_wardens BEFORE INSERT ON public.hostel_wardens FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_caretakers ON public.hostel_caretakers;
CREATE TRIGGER tr_set_org_id_caretakers BEFORE INSERT ON public.hostel_caretakers FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_security ON public.security_staff;
CREATE TRIGGER tr_set_org_id_security BEFORE INSERT ON public.security_staff FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_announcements ON public.announcements;
CREATE TRIGGER tr_set_org_id_announcements BEFORE INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_announcements_read ON public.announcements_read;
CREATE TRIGGER tr_set_org_id_announcements_read BEFORE INSERT ON public.announcements_read FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_visitor_logs ON public.visitor_logs;
CREATE TRIGGER tr_set_org_id_visitor_logs BEFORE INSERT ON public.visitor_logs FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

-- 6. Update Location Snapshot Trigger
CREATE OR REPLACE FUNCTION public.trig_fn_snapshot_student_location()
RETURNS TRIGGER AS $$
DECLARE
  v_hostel_id BIGINT;
  v_room_id BIGINT;
  v_org_id UUID;
BEGIN
  SELECT r.hostel_id, r.id, r.org_id INTO v_hostel_id, v_room_id, v_org_id
  FROM public.room_allocations a
  JOIN public.beds b ON a.bed_id = b.id
  JOIN public.hostel_rooms r ON b.room_id = r.id
  WHERE a.student_id = NEW.student_id AND a.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot create record: Student % has no active room allocation.', NEW.student_id;
  END IF;

  NEW.hostel_id := v_hostel_id;
  NEW.org_id := COALESCE(NEW.org_id, v_org_id, public.user_org_id());
  IF TG_TABLE_NAME IN ('issues', 'gate_passes', 'visitor_logs') THEN
    NEW.room_id := v_room_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7. Stored Procedures (RPCs)
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_room_id BIGINT;
  v_org_id UUID;
  i INTEGER;
BEGIN
  IF public.user_role() != 'ADMIN' THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can create rooms';
  END IF;
  IF p_capacity < 1 THEN
    RAISE EXCEPTION 'Capacity must be at least 1';
  END IF;

  SELECT org_id INTO v_org_id FROM public.hostels WHERE id = p_hostel_id;

  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, org_id)
  VALUES (p_hostel_id, p_room_no, p_floor, p_capacity, p_room_type, COALESCE(v_org_id, public.user_org_id()))
  RETURNING id INTO v_new_room_id;

  FOR i IN 1..p_capacity LOOP
    INSERT INTO public.beds (room_id, bed_number, org_id)
    VALUES (v_new_room_id, i, COALESCE(v_org_id, public.user_org_id()));
  END LOOP;

  RETURN v_new_room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resize_room_capacity(
  p_room_id BIGINT,
  p_new_capacity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_capacity INTEGER;
  v_occupied_beds_in_excess INTEGER;
  v_org_id UUID;
  i INTEGER;
BEGIN
  IF public.user_role() != 'ADMIN' THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can resize room capacity';
  END IF;
  IF p_new_capacity < 1 THEN
    RAISE EXCEPTION 'Capacity must be at least 1';
  END IF;

  SELECT capacity, org_id INTO v_old_capacity, v_org_id 
  FROM public.hostel_rooms 
  WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Room % not found', p_room_id; END IF;
  IF p_new_capacity = v_old_capacity THEN
    RETURN jsonb_build_object('success', true, 'message', 'Capacity unchanged');
  END IF;

  IF p_new_capacity > v_old_capacity THEN
    UPDATE public.hostel_rooms SET capacity = p_new_capacity, updated_at = NOW() WHERE id = p_room_id;
    FOR i IN (v_old_capacity + 1)..p_new_capacity LOOP
      INSERT INTO public.beds (room_id, bed_number, org_id) VALUES (p_room_id, i, v_org_id);
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

CREATE OR REPLACE FUNCTION public.decommission_room(p_room_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.user_role() NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can decommission rooms';
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

CREATE OR REPLACE FUNCTION public.allocate_student_room(
  p_student_id BIGINT,
  p_bed_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_room_id BIGINT;
  v_hostel_id BIGINT;
  v_student_status TEXT;
  v_existing_alloc_id BIGINT;
  v_new_alloc_id BIGINT;
  v_org_id UUID;
BEGIN
  v_caller_role := public.user_role();
  IF v_caller_role NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can allocate rooms';
  END IF;

  SELECT b.room_id, r.hostel_id, b.org_id INTO v_room_id, v_hostel_id, v_org_id
  FROM public.beds b
  JOIN public.hostel_rooms r ON b.room_id = r.id
  JOIN public.hostels h ON r.hostel_id = h.id
  WHERE b.id = p_bed_id AND r.is_active = TRUE AND h.is_active = TRUE
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bed % not found or belongs to an inactive room/hostel', p_bed_id;
  END IF;

  IF v_caller_role = 'WARDEN' AND NOT EXISTS (
    SELECT 1 FROM public.warden_hostel_assignments 
    WHERE warden_profile_id = auth.uid() AND hostel_id = v_hostel_id
  ) THEN
    RAISE EXCEPTION 'Access Denied: You cannot allocate residents to an unassigned hostel block';
  END IF;

  SELECT status INTO v_student_status
  FROM public.students
  WHERE id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Student % not found', p_student_id; END IF;
  IF v_student_status != 'ACTIVE' THEN
    RAISE EXCEPTION 'Cannot allocate inactive resident (Status: %)', v_student_status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.room_allocations 
    WHERE bed_id = p_bed_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Bed % is already occupied', p_bed_id;
  END IF;

  SELECT id INTO v_existing_alloc_id
  FROM public.room_allocations
  WHERE student_id = p_student_id AND is_active = TRUE
  FOR UPDATE;

  IF v_existing_alloc_id IS NOT NULL THEN
    UPDATE public.room_allocations
    SET is_active = FALSE, vacated_at = NOW(), updated_at = NOW()
    WHERE id = v_existing_alloc_id;
  END IF;

  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active, org_id)
  VALUES (p_student_id, p_bed_id, auth.uid(), TRUE, v_org_id)
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

CREATE OR REPLACE FUNCTION public.vacate_student_room(p_student_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_alloc_id BIGINT;
  v_hostel_id BIGINT;
BEGIN
  v_caller_role := public.user_role();
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

CREATE OR REPLACE FUNCTION public.update_issue_status(
  p_issue_id BIGINT,
  p_new_status TEXT,
  p_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_old_status TEXT;
  v_hostel_id BIGINT;
  v_org_id UUID;
BEGIN
  v_caller_role := public.user_role();
  IF v_caller_role NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can update ticket status';
  END IF;

  SELECT status, hostel_id, org_id INTO v_old_status, v_hostel_id, v_org_id
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
    issue_id, old_status, new_status, note, updated_by, org_id, created_at
  ) VALUES (
    p_issue_id, v_old_status, p_new_status, p_note, auth.uid(), v_org_id, NOW()
  );

  RETURN jsonb_build_object('success', true, 'issue_id', p_issue_id, 'new_status', p_new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_gate_pass(
  p_pass_id BIGINT,
  p_note TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_hostel_id BIGINT;
  v_status TEXT;
BEGIN
  v_caller_role := public.user_role();
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

CREATE OR REPLACE FUNCTION public.reject_gate_pass(
  p_pass_id BIGINT,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_hostel_id BIGINT;
  v_status TEXT;
BEGIN
  v_caller_role := public.user_role();
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

CREATE OR REPLACE FUNCTION public.log_gate_movement(
  p_pass_id BIGINT,
  p_movement_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pass RECORD;
  v_deadline TIMESTAMPTZ;
  v_is_late BOOLEAN := FALSE;
BEGIN
  IF public.user_role() NOT IN ('SECURITY', 'ADMIN') THEN
    RAISE EXCEPTION 'Access Denied: Only Security Guards or Admins can log gate movements';
  END IF;

  SELECT * INTO v_pass FROM public.gate_passes WHERE id = p_pass_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gate pass % not found', p_pass_id; END IF;

  IF v_pass.status NOT IN ('approved', 'pending') AND p_movement_type = 'OUT' THEN
    RAISE EXCEPTION 'Cannot checkout: Gate pass is %', v_pass.status;
  END IF;

  v_deadline := (v_pass.expected_return_date || ' ' || v_pass.expected_return_time)::TIMESTAMPTZ;

  IF p_movement_type = 'OUT' THEN
    IF v_pass.actual_exit_time IS NOT NULL THEN
      RAISE EXCEPTION 'Exit already stamped at %', v_pass.actual_exit_time;
    END IF;

    UPDATE public.gate_passes
    SET actual_exit_time = NOW(),
        security_guard_id = auth.uid(),
        updated_at = NOW()
    WHERE id = p_pass_id;
  ELSIF p_movement_type = 'IN' THEN
    IF v_pass.actual_exit_time IS NULL THEN
      RAISE EXCEPTION 'Student has not checked out yet';
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

CREATE OR REPLACE FUNCTION public.checkout_visitor(p_visitor_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  v_caller_role := public.user_role();
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

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_phone TEXT,
  p_avatar_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- 8. Table & RPC Permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_room_with_beds TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resize_room_capacity TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decommission_room TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.allocate_student_room TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vacate_student_room TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_issue_status TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_gate_pass TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_gate_pass TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_gate_movement TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.checkout_visitor TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_my_profile TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_student_id TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_role TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_org_id TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_warden TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_security TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_student TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_warden_hostel_ids TO authenticated, service_role;
