-- =====================================================================
-- Fix: update_issue_status RPC & RLS Policies for Real-Time Sync
-- Run this in Supabase Dashboard → SQL Editor
-- =====================================================================

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
  v_sanitized_status TEXT;
  v_note_text TEXT;
BEGIN
  v_caller_role := upper(coalesce(public.user_role(), ''));

  -- Allow ADMIN or WARDEN
  IF v_caller_role NOT IN ('ADMIN', 'WARDEN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins and Wardens can update ticket status';
  END IF;

  SELECT status, hostel_id, org_id INTO v_old_status, v_hostel_id, v_org_id
  FROM public.issues
  WHERE id = p_issue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issue % not found', p_issue_id;
  END IF;

  -- Validate org if present on both
  IF v_org_id IS NOT NULL AND public.user_org_id() IS NOT NULL AND v_org_id != public.user_org_id() THEN
    RAISE EXCEPTION 'Access Denied: Issue does not belong to your organisation';
  END IF;

  -- Normalize status (e.g. 'IN PROGRESS' -> 'in_progress', 'Pending' -> 'pending')
  v_sanitized_status := lower(replace(trim(p_new_status), ' ', '_'));

  IF v_sanitized_status NOT IN ('pending', 'in_progress', 'waiting_for_workers', 'completed') THEN
    RAISE EXCEPTION 'Invalid status: %', p_new_status;
  END IF;

  v_note_text := trim(coalesce(p_note, ''));
  IF v_note_text = '' THEN
    v_note_text := 'Status changed to ' || replace(v_sanitized_status, '_', ' ');
  END IF;

  -- Update issues table
  UPDATE public.issues
  SET status = v_sanitized_status,
      resolved_at = CASE WHEN v_sanitized_status = 'completed' THEN NOW() ELSE NULL END,
      updated_at = NOW()
  WHERE id = p_issue_id;

  -- Insert history record into issue_updates
  INSERT INTO public.issue_updates (
    issue_id, old_status, new_status, note, updated_by, org_id, created_at
  ) VALUES (
    p_issue_id, v_old_status, v_sanitized_status, v_note_text, auth.uid(), coalesce(v_org_id, public.user_org_id()), NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'issue_id', p_issue_id,
    'new_status', v_sanitized_status,
    'old_status', v_old_status
  );
END;
$$;

-- Allow authenticated users to execute the RPC
REVOKE EXECUTE ON FUNCTION public.update_issue_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_issue_status TO authenticated, service_role;

-- Fix the issue_updates SELECT policy so wardens and admins can read all updates in their org
DROP POLICY IF EXISTS policy_issue_updates_select ON public.issue_updates;
CREATE POLICY policy_issue_updates_select ON public.issue_updates FOR SELECT TO authenticated
USING (
  (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id()) AND (
    public.is_admin()
    OR public.is_warden()
    OR EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = issue_id AND i.student_id = public.user_student_id()
    )
  )
);

-- Ensure Realtime is enabled on issues and issue_updates tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.issues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.issue_updates;
