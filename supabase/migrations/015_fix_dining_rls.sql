-- =============================================================================
-- Migration 015: Add Admin & Warden RLS Policies for Dining Tables
-- =============================================================================

-- Ensure helper functions exist
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_warden()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'WARDEN' AND is_active = true
  );
$$;

-- 1. Meal Types (allow admin & warden full control)
DROP POLICY IF EXISTS policy_meal_types_admin ON public.meal_types;
CREATE POLICY policy_meal_types_admin ON public.meal_types 
FOR ALL TO authenticated 
USING (public.is_admin() OR public.is_warden()) 
WITH CHECK (public.is_admin() OR public.is_warden());

-- 2. Menu Items (allow admin & warden full control)
DROP POLICY IF EXISTS policy_menu_items_admin ON public.menu_items;
CREATE POLICY policy_menu_items_admin ON public.menu_items 
FOR ALL TO authenticated 
USING (public.is_admin() OR public.is_warden()) 
WITH CHECK (public.is_admin() OR public.is_warden());

-- 3. Menus (allow admin & warden full control)
DROP POLICY IF EXISTS policy_menus_admin ON public.menus;
CREATE POLICY policy_menus_admin ON public.menus 
FOR ALL TO authenticated 
USING (public.is_admin() OR public.is_warden()) 
WITH CHECK (public.is_admin() OR public.is_warden());

-- 4. Menu Item Links (allow admin & warden full control)
DROP POLICY IF EXISTS policy_menu_item_links_admin ON public.menu_item_links;
CREATE POLICY policy_menu_item_links_admin ON public.menu_item_links 
FOR ALL TO authenticated 
USING (public.is_admin() OR public.is_warden()) 
WITH CHECK (public.is_admin() OR public.is_warden());
