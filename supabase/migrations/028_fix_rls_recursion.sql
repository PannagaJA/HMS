-- =============================================================================
-- Migration 028: Fix Infinite Recursion in Row Level Security (RLS) Policies
-- =============================================================================

-- 1. Helper function with SECURITY DEFINER to fetch active hostel student IDs
-- Running as SECURITY DEFINER bypasses RLS recursion completely.
CREATE OR REPLACE FUNCTION public.get_warden_accessible_student_ids(p_warden_id UUID)
RETURNS TABLE (student_id BIGINT) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT a.student_id
  FROM public.room_allocations a
  JOIN public.beds b ON a.bed_id = b.id
  JOIN public.hostel_rooms r ON b.room_id = r.id
  JOIN public.warden_hostel_assignments wha ON wha.hostel_id = r.hostel_id
  WHERE wha.warden_profile_id = p_warden_id AND a.is_active = TRUE;
$$;

-- 2. Helper function to fetch student ID for a given auth profile ID
CREATE OR REPLACE FUNCTION public.get_my_student_id(p_profile_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.students WHERE profile_id = p_profile_id LIMIT 1;
$$;

-- 3. Redefine Students Select Policy
DROP POLICY IF EXISTS policy_students_select ON public.students;
CREATE POLICY policy_students_select ON public.students FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin() 
    OR public.is_security()
    OR profile_id = auth.uid()
    OR (public.is_warden() AND id IN (SELECT public.get_warden_accessible_student_ids(auth.uid())))
  )
);

-- 4. Redefine Room Allocations Select Policy
DROP POLICY IF EXISTS policy_allocations_select ON public.room_allocations;
CREATE POLICY policy_allocations_select ON public.room_allocations FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR public.is_security()
    OR student_id = public.get_my_student_id(auth.uid())
    OR (public.is_warden() AND EXISTS (
      SELECT 1 FROM public.beds b
      JOIN public.hostel_rooms r ON b.room_id = r.id
      JOIN public.warden_hostel_assignments wha ON wha.hostel_id = r.hostel_id
      WHERE b.id = bed_id AND wha.warden_profile_id = auth.uid()
    ))
  )
);

-- 5. Redefine Gate Passes Select Policy
DROP POLICY IF EXISTS policy_gate_passes_select ON public.gate_passes;
CREATE POLICY policy_gate_passes_select ON public.gate_passes FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR public.is_security()
    OR student_id = public.get_my_student_id(auth.uid())
    OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
  )
);

-- 6. Redefine Issues Select Policy
DROP POLICY IF EXISTS policy_issues_select ON public.issues;
CREATE POLICY policy_issues_select ON public.issues FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR public.is_security()
    OR student_id = public.get_my_student_id(auth.uid())
    OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
  )
);

-- 7. Redefine Visitor Logs Select Policy
DROP POLICY IF EXISTS policy_visitor_logs_select ON public.visitor_logs;
CREATE POLICY policy_visitor_logs_select ON public.visitor_logs FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR public.is_security()
    OR student_id = public.get_my_student_id(auth.uid())
    OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
  )
);

-- 8. Redefine Meal Skips Select Policy
DROP POLICY IF EXISTS policy_meal_skips_select ON public.student_meal_skips;
CREATE POLICY policy_meal_skips_select ON public.student_meal_skips FOR SELECT TO authenticated
USING (
  org_id = public.user_org_id() AND (
    public.is_admin()
    OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
    OR student_id = public.get_my_student_id(auth.uid())
  )
);
