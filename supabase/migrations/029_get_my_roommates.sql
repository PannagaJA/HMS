-- =============================================================================
-- Migration 029: Helper RPC Function & RLS Policy for Roommates Lookup
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_roommates(p_profile_id UUID DEFAULT NULL)
RETURNS TABLE (
  id BIGINT,
  student_name TEXT,
  enrollment_no TEXT,
  bed_number INTEGER,
  phone TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_my_student_id BIGINT;
  v_my_room_id BIGINT;
BEGIN
  -- 1. Find student ID by profile_id or fallback to first active student if null
  IF p_profile_id IS NOT NULL THEN
    SELECT s.id INTO v_my_student_id FROM public.students s WHERE s.profile_id = p_profile_id LIMIT 1;
  END IF;

  IF v_my_student_id IS NULL THEN
    SELECT a.student_id INTO v_my_student_id FROM public.room_allocations a WHERE a.is_active = TRUE LIMIT 1;
  END IF;

  IF v_my_student_id IS NULL THEN RETURN; END IF;

  -- 2. Find current active room ID for this student
  SELECT b.room_id INTO v_my_room_id
  FROM public.room_allocations a
  JOIN public.beds b ON a.bed_id = b.id
  WHERE a.student_id = v_my_student_id AND a.is_active = TRUE;

  IF v_my_room_id IS NULL THEN RETURN; END IF;

  -- 3. Return all co-residents in the same room
  RETURN QUERY
  SELECT 
    s.id,
    s.student_name,
    s.enrollment_no,
    b.bed_number,
    s.phone,
    p.avatar_url
  FROM public.room_allocations a
  JOIN public.beds b ON a.bed_id = b.id
  JOIN public.students s ON a.student_id = s.id
  LEFT JOIN public.profiles p ON s.profile_id = p.id
  WHERE b.room_id = v_my_room_id 
    AND a.is_active = TRUE 
    AND s.id != v_my_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_roommates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_roommates(UUID) TO service_role;
