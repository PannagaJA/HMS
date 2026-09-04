-- =============================================================================
-- Migration 030: Grant Full CRUD Permissions to Warden Role
-- =============================================================================

-- 1. Update stored procedures to allow Wardens to create, resize & decommission rooms
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
  i INTEGER;
BEGIN
  IF public.user_role() NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can create rooms';
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
  i INTEGER;
BEGIN
  IF public.user_role() NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can resize room capacity';
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

-- 2. Update RLS policies for Students, Rooms, Beds, Allocations to grant Wardens full CRUD
DROP POLICY IF EXISTS policy_students_admin ON public.students;
CREATE POLICY policy_students_admin ON public.students FOR ALL TO authenticated 
USING (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden()))
WITH CHECK (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden()));

DROP POLICY IF EXISTS policy_rooms_admin ON public.hostel_rooms;
CREATE POLICY policy_rooms_admin ON public.hostel_rooms FOR ALL TO authenticated 
USING (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden()))
WITH CHECK (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden()));

DROP POLICY IF EXISTS policy_beds_admin ON public.beds;
CREATE POLICY policy_beds_admin ON public.beds FOR ALL TO authenticated 
USING (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden()))
WITH CHECK (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden()));

DROP POLICY IF EXISTS policy_allocations_admin ON public.room_allocations;
CREATE POLICY policy_allocations_admin ON public.room_allocations FOR ALL TO authenticated 
USING (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden()))
WITH CHECK (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden()));
