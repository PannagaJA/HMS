-- =====================================================================
-- Fix: Announcements RLS Policies & Realtime for Warden, Security, Admin, Caretaker
-- Run this in Supabase Dashboard → SQL Editor
-- =====================================================================

-- 1. Ensure helper functions exist
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
  SELECT coalesce(public.user_role(), '') = 'ADMIN';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_warden() 
RETURNS BOOLEAN AS $$
  SELECT coalesce(public.user_role(), '') = 'WARDEN';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_security() 
RETURNS BOOLEAN AS $$
  SELECT coalesce(public.user_role(), '') = 'SECURITY';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_caretaker() 
RETURNS BOOLEAN AS $$
  SELECT coalesce(public.user_role(), '') = 'CARETAKER';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Drop existing announcement policies
DROP POLICY IF EXISTS policy_announcements_select ON public.announcements;
DROP POLICY IF EXISTS policy_announcements_insert ON public.announcements;
DROP POLICY IF EXISTS policy_announcements_update ON public.announcements;
DROP POLICY IF EXISTS policy_announcements_delete ON public.announcements;

-- 3. SELECT policy: authenticated users can read announcements in their org
CREATE POLICY policy_announcements_select ON public.announcements FOR SELECT TO authenticated
USING (
  org_id IS NULL 
  OR public.user_org_id() IS NULL 
  OR org_id = public.user_org_id()
);

-- 4. INSERT policy: ADMIN, WARDEN, SECURITY, CARETAKER can create announcements
CREATE POLICY policy_announcements_insert ON public.announcements FOR INSERT TO authenticated
WITH CHECK (
  (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
  AND (public.is_admin() OR public.is_warden() OR public.is_security() OR public.is_caretaker())
);

-- 5. UPDATE policy: ADMIN, WARDEN, SECURITY, CARETAKER can update announcements in their org
CREATE POLICY policy_announcements_update ON public.announcements FOR UPDATE TO authenticated
USING (
  (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
  AND (public.is_admin() OR public.is_warden() OR public.is_security() OR public.is_caretaker())
)
WITH CHECK (
  (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
  AND (public.is_admin() OR public.is_warden() OR public.is_security() OR public.is_caretaker())
);

-- 6. DELETE policy: ADMIN, WARDEN, SECURITY, CARETAKER can delete announcements
CREATE POLICY policy_announcements_delete ON public.announcements FOR DELETE TO authenticated
USING (
  (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
  AND (public.is_admin() OR public.is_warden() OR public.is_security() OR public.is_caretaker())
);

-- 7. Ensure announcements_read policies allow all authenticated users in org
DROP POLICY IF EXISTS policy_announcements_read_all ON public.announcements_read;
CREATE POLICY policy_announcements_read_all ON public.announcements_read FOR ALL TO authenticated
USING (
  org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id()
)
WITH CHECK (
  org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id()
);

-- 8. Add to realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'announcements_read'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements_read;
  END IF;
END $$;
