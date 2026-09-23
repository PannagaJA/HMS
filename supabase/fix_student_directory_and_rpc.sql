-- =============================================================================
-- HMS FIX: SECURE RESIDENT STUDENT PROFILE & LOGIN RPC
-- Run this in your Supabase SQL Editor (gnmbmwplrjwkslvtcghr)
-- =============================================================================

-- 1. Create a SECURITY DEFINER RPC to resolve student profile & room allocation
-- This allows student sessions (even before full auth linkage) to load their genuine
-- name, USN, contact info, and room allocation without being blocked by RLS.

CREATE OR REPLACE FUNCTION public.get_student_profile(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student RECORD;
  v_alloc RECORD;
  v_result JSONB;
BEGIN
  IF p_identifier IS NULL OR TRIM(p_identifier) = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Find student by profile_id UUID, email, enrollment_no (USN), or phone
  SELECT s.*
  INTO v_student
  FROM public.students s
  WHERE 
    (s.profile_id::TEXT = p_identifier)
    OR (LOWER(s.email) = LOWER(p_identifier))
    OR (LOWER(s.enrollment_no) = LOWER(p_identifier))
    OR (p_identifier LIKE '%@%' AND LOWER(s.enrollment_no) = LOWER(SPLIT_PART(p_identifier, '@', 1)))
    OR (s.phone = p_identifier)
  LIMIT 1;

  IF v_student IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Find active room allocation
  SELECT 
    ra.id AS alloc_id,
    ra.allocated_at,
    ra.vacated_at,
    ra.is_active,
    b.id AS bed_id,
    b.bed_number,
    hr.id AS room_id,
    hr.no AS room_no,
    hr.floor,
    h.id AS hostel_id,
    h.name AS hostel_name
  INTO v_alloc
  FROM public.room_allocations ra
  JOIN public.beds b ON ra.bed_id = b.id
  JOIN public.hostel_rooms hr ON b.room_id = hr.id
  JOIN public.hostels h ON hr.hostel_id = h.id
  WHERE ra.student_id = v_student.id AND ra.is_active = TRUE
  LIMIT 1;

  -- 3. Find active co-residents / roommates in the exact same room
  DECLARE
    v_roommates JSONB := '[]'::jsonb;
  BEGIN
    IF v_alloc.room_id IS NOT NULL THEN
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', st.id,
            'student_name', st.student_name,
            'enrollment_no', st.enrollment_no,
            'phone', COALESCE(st.phone, ''),
            'gender', COALESCE(st.gender, 'M'),
            'bed_number', bd.bed_number,
            'room_no', v_alloc.room_no
          )
        ),
        '[]'::jsonb
      )
      INTO v_roommates
      FROM public.room_allocations r_co
      JOIN public.beds bd ON r_co.bed_id = bd.id
      JOIN public.students st ON r_co.student_id = st.id
      WHERE bd.room_id = v_alloc.room_id
        AND r_co.is_active = TRUE
        AND r_co.student_id != v_student.id;
    END IF;

    -- 4. Construct clean JSON response
    v_result := jsonb_build_object(
      'id', v_student.id,
      'profile_id', v_student.profile_id,
      'student_name', v_student.student_name,
      'enrollment_no', v_student.enrollment_no,
      'email', v_student.email,
      'phone', COALESCE(v_student.phone, ''),
      'gender', COALESCE(v_student.gender, 'M'),
      'father_name', COALESCE(v_student.father_name, ''),
      'guardian_phone', COALESCE(v_student.guardian_phone, ''),
      'emergency_contact', COALESCE(v_student.emergency_contact, ''),
      'status', COALESCE(v_student.status, 'ACTIVE'),
      'room_allotted', (v_alloc.alloc_id IS NOT NULL),
      'hostel', v_alloc.hostel_id,
      'hostel_id', v_alloc.hostel_id,
      'hostel_name', COALESCE(v_alloc.hostel_name, ''),
      'room_id', v_alloc.room_id,
      'room_no', COALESCE(v_alloc.room_no, ''),
      'room_number', COALESCE(v_alloc.room_no, ''),
      'floor', v_alloc.floor,
      'bed_id', v_alloc.bed_id,
      'bed_number', v_alloc.bed_number,
      'allocated_at', v_alloc.allocated_at,
      'roommates', v_roommates,
      'room_detail', CASE WHEN v_alloc.room_id IS NOT NULL THEN
        jsonb_build_object(
          'id', v_alloc.room_id,
          'no', v_alloc.room_no,
          'floor', v_alloc.floor,
          'hostel', jsonb_build_object('id', v_alloc.hostel_id, 'name', v_alloc.hostel_name)
        )
      ELSE NULL END
    );

    RETURN v_result;
  END;
END;
$$;

-- Allow authenticated and anonymous clients to execute get_student_profile
GRANT EXECUTE ON FUNCTION public.get_student_profile(TEXT) TO anon, authenticated;

-- 2. Allow SELECT on students table for authenticated and anon to match email/USN for login & profile lookup
DROP POLICY IF EXISTS policy_students_public_read ON public.students;
CREATE POLICY policy_students_public_read ON public.students
FOR SELECT
TO anon, authenticated
USING (true);
