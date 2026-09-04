-- =============================================================================
-- Migration 031: Fix Staff Tables Multi-Tenant RLS Policies
-- =============================================================================

-- 1. Hostel Wardens
DROP POLICY IF EXISTS "Authenticated users can view wardens" ON public.hostel_wardens;
DROP POLICY IF EXISTS "Admins can manage wardens" ON public.hostel_wardens;

CREATE POLICY policy_wardens_select ON public.hostel_wardens FOR SELECT TO authenticated
USING (org_id = public.user_org_id());

CREATE POLICY policy_wardens_admin ON public.hostel_wardens FOR ALL TO authenticated
USING (org_id = public.user_org_id() AND public.is_admin())
WITH CHECK (org_id = public.user_org_id() AND public.is_admin());


-- 2. Hostel Caretakers
DROP POLICY IF EXISTS "Authenticated users can view caretakers" ON public.hostel_caretakers;
DROP POLICY IF EXISTS "Admins can manage caretakers" ON public.hostel_caretakers;

CREATE POLICY policy_caretakers_select ON public.hostel_caretakers FOR SELECT TO authenticated
USING (org_id = public.user_org_id());

CREATE POLICY policy_caretakers_admin ON public.hostel_caretakers FOR ALL TO authenticated
USING (org_id = public.user_org_id() AND public.is_admin())
WITH CHECK (org_id = public.user_org_id() AND public.is_admin());


-- 3. Security Staff
DROP POLICY IF EXISTS "Authenticated users can view security staff" ON public.security_staff;
DROP POLICY IF EXISTS "Admins can manage security staff" ON public.security_staff;

CREATE POLICY policy_security_staff_select ON public.security_staff FOR SELECT TO authenticated
USING (org_id = public.user_org_id());

CREATE POLICY policy_security_staff_admin ON public.security_staff FOR ALL TO authenticated
USING (org_id = public.user_org_id() AND public.is_admin())
WITH CHECK (org_id = public.user_org_id() AND public.is_admin());
