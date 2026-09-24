-- =============================================================================
-- FIX RLS FOR GATE PASSES & ISSUES (42501 UNAUTHORIZED ERROR)
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gnmbmwplrjwkslvtcghr/sql/new
-- =============================================================================

-- 1. Ensure Table Columns and Defaults are Clean
ALTER TABLE public.gate_passes ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::UUID;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::UUID;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.issue_updates ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::UUID;
ALTER TABLE public.issue_updates ADD COLUMN IF NOT EXISTS updated_by_name TEXT;

-- 2. Clean up & re-apply RLS Policies for gate_passes
ALTER TABLE public.gate_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_gate_passes_select ON public.gate_passes;
DROP POLICY IF EXISTS policy_gate_passes_insert ON public.gate_passes;
DROP POLICY IF EXISTS policy_gate_passes_update ON public.gate_passes;
DROP POLICY IF EXISTS policy_gate_passes_delete ON public.gate_passes;
DROP POLICY IF EXISTS policy_gate_passes_all ON public.gate_passes;

CREATE POLICY policy_gate_passes_select ON public.gate_passes 
FOR SELECT TO public 
USING (true);

CREATE POLICY policy_gate_passes_insert ON public.gate_passes 
FOR INSERT TO public 
WITH CHECK (true);

CREATE POLICY policy_gate_passes_update ON public.gate_passes 
FOR UPDATE TO public 
USING (true) 
WITH CHECK (true);

CREATE POLICY policy_gate_passes_all ON public.gate_passes 
FOR ALL TO public 
USING (true) 
WITH CHECK (true);

-- 3. Clean up & re-apply RLS Policies for issues
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_issues_select ON public.issues;
DROP POLICY IF EXISTS policy_issues_insert ON public.issues;
DROP POLICY IF EXISTS policy_issues_insert_student ON public.issues;
DROP POLICY IF EXISTS policy_issues_update ON public.issues;
DROP POLICY IF EXISTS policy_issues_delete ON public.issues;
DROP POLICY IF EXISTS policy_issues_all ON public.issues;

CREATE POLICY policy_issues_select ON public.issues 
FOR SELECT TO public 
USING (true);

CREATE POLICY policy_issues_insert ON public.issues 
FOR INSERT TO public 
WITH CHECK (true);

CREATE POLICY policy_issues_update ON public.issues 
FOR UPDATE TO public 
USING (true) 
WITH CHECK (true);

CREATE POLICY policy_issues_all ON public.issues 
FOR ALL TO public 
USING (true) 
WITH CHECK (true);

-- 4. Clean up & re-apply RLS Policies for issue_updates
ALTER TABLE public.issue_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_issue_updates_select ON public.issue_updates;
DROP POLICY IF EXISTS policy_issue_updates_insert ON public.issue_updates;
DROP POLICY IF EXISTS policy_issue_updates_all ON public.issue_updates;

CREATE POLICY policy_issue_updates_select ON public.issue_updates 
FOR SELECT TO public 
USING (true);

CREATE POLICY policy_issue_updates_insert ON public.issue_updates 
FOR INSERT TO public 
WITH CHECK (true);

CREATE POLICY policy_issue_updates_all ON public.issue_updates 
FOR ALL TO public 
USING (true) 
WITH CHECK (true);

-- 5. Ensure lookup tables (hostels, hostel_rooms, students) are readable by public/anon
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_hostels_public_read ON public.hostels;
CREATE POLICY policy_hostels_public_read ON public.hostels FOR SELECT TO public USING (true);

ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_rooms_public_read ON public.hostel_rooms;
CREATE POLICY policy_rooms_public_read ON public.hostel_rooms FOR SELECT TO public USING (true);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_students_public_read ON public.students;
CREATE POLICY policy_students_public_read ON public.students FOR SELECT TO public USING (true);

-- 6. Grant Permissions to authenticated, anon, and service_role
GRANT ALL ON public.gate_passes TO authenticated, anon, service_role;
GRANT ALL ON public.issues TO authenticated, anon, service_role;
GRANT ALL ON public.issue_updates TO authenticated, anon, service_role;
GRANT SELECT ON public.hostels TO authenticated, anon, service_role;
GRANT SELECT ON public.hostel_rooms TO authenticated, anon, service_role;
GRANT SELECT ON public.students TO authenticated, anon, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;

-- 7. Fallback SECURITY DEFINER RPCs for Guaranteed Submissions

-- RPC: submit_student_issue
CREATE OR REPLACE FUNCTION public.submit_student_issue(
  p_student_id BIGINT,
  p_hostel_id BIGINT,
  p_room_id BIGINT,
  p_title TEXT,
  p_category TEXT,
  p_description TEXT,
  p_image_url TEXT DEFAULT NULL,
  p_org_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_issue_id BIGINT;
  v_org_id UUID := COALESCE(p_org_id, '00000000-0000-0000-0000-000000000001'::UUID);
  v_result JSONB;
BEGIN
  INSERT INTO public.issues (
    student_id,
    hostel_id,
    room_id,
    title,
    category,
    description,
    image_url,
    status,
    org_id,
    created_at,
    updated_at
  ) VALUES (
    p_student_id,
    p_hostel_id,
    p_room_id,
    p_title,
    COALESCE(p_category, 'OTHER'),
    p_description,
    p_image_url,
    'pending',
    v_org_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_issue_id;

  -- Create initial issue update entry
  INSERT INTO public.issue_updates (
    issue_id,
    old_status,
    new_status,
    note,
    org_id,
    created_at
  ) VALUES (
    v_issue_id,
    NULL,
    'pending',
    'Ticket submitted: ' || p_title,
    v_org_id,
    NOW()
  );

  SELECT to_jsonb(i) INTO v_result
  FROM public.issues i
  WHERE i.id = v_issue_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_student_issue TO authenticated, anon, service_role;

-- RPC: submit_student_gate_pass
CREATE OR REPLACE FUNCTION public.submit_student_gate_pass(
  p_student_id BIGINT,
  p_hostel_id BIGINT,
  p_room_id BIGINT,
  p_pass_type TEXT,
  p_reason TEXT,
  p_out_date DATE,
  p_out_time TIME,
  p_expected_return_date DATE,
  p_expected_return_time TIME,
  p_org_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pass_id BIGINT;
  v_org_id UUID := COALESCE(p_org_id, '00000000-0000-0000-0000-000000000001'::UUID);
  v_result JSONB;
BEGIN
  INSERT INTO public.gate_passes (
    student_id,
    hostel_id,
    room_id,
    pass_type,
    reason,
    out_date,
    out_time,
    expected_return_date,
    expected_return_time,
    status,
    org_id,
    created_at,
    updated_at
  ) VALUES (
    p_student_id,
    p_hostel_id,
    p_room_id,
    COALESCE(p_pass_type, 'DAY_OUT'),
    p_reason,
    p_out_date,
    p_out_time,
    p_expected_return_date,
    p_expected_return_time,
    'pending',
    v_org_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_pass_id;

  SELECT to_jsonb(gp) INTO v_result
  FROM public.gate_passes gp
  WHERE gp.id = v_pass_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_student_gate_pass TO authenticated, anon, service_role;
