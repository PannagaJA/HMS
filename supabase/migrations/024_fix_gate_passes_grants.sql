-- =============================================================================
-- Migration 024: Fix Gate Passes Permissions & Self-Contained UPDATE Policy
-- =============================================================================

-- 1. Helper functions in public schema (safe across all Supabase configurations)
CREATE OR REPLACE FUNCTION public.user_role() 
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
  SELECT public.user_role() = 'ADMIN';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_security() 
RETURNS BOOLEAN AS $$
  SELECT public.user_role() = 'SECURITY';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_warden() 
RETURNS BOOLEAN AS $$
  SELECT public.user_role() = 'WARDEN';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Grant table access to authenticated users and service_role
GRANT SELECT, INSERT, UPDATE ON public.gate_passes TO authenticated;
GRANT ALL ON public.gate_passes TO service_role;

-- 3. Add UPDATE policy for staff using direct profile lookup
DROP POLICY IF EXISTS policy_gate_passes_update ON public.gate_passes;
CREATE POLICY policy_gate_passes_update ON public.gate_passes FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('ADMIN', 'SECURITY', 'WARDEN')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('ADMIN', 'SECURITY', 'WARDEN')
  )
);

