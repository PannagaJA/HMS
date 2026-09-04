-- =============================================================================
-- Migration 025: Multi-Tenant Architecture Foundation
-- =============================================================================

-- 1. Create the organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Insert the default "Org 1"
INSERT INTO public.organizations (id, name, subdomain) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Org 1 (Default)', 'org1')
ON CONFLICT (id) DO NOTHING;

-- 2. Helper function to add org_id, backfill it, and make it NOT NULL
CREATE OR REPLACE FUNCTION public.add_org_id_to_table(target_table TEXT)
RETURNS void AS $$
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'org_id'
    ) THEN
        -- Add column (nullable initially)
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE', $1);
        
        -- Backfill with Org 1
        EXECUTE format('UPDATE public.%I SET org_id = ''00000000-0000-0000-0000-000000000001''', $1);
        
        -- Make NOT NULL
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET NOT NULL', $1);

        -- Create Index
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_org_id ON public.%I(org_id)', $1, $1);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Apply to all core tables
SELECT public.add_org_id_to_table('profiles');
SELECT public.add_org_id_to_table('hostels');
SELECT public.add_org_id_to_table('warden_hostel_assignments');
SELECT public.add_org_id_to_table('hostel_rooms');
SELECT public.add_org_id_to_table('beds');
SELECT public.add_org_id_to_table('hostel_courses');
SELECT public.add_org_id_to_table('students');
SELECT public.add_org_id_to_table('room_allocations');
SELECT public.add_org_id_to_table('issues');
SELECT public.add_org_id_to_table('issue_updates');
SELECT public.add_org_id_to_table('gate_passes');
SELECT public.add_org_id_to_table('visitor_logs');
SELECT public.add_org_id_to_table('meal_types');
SELECT public.add_org_id_to_table('menu_items');
SELECT public.add_org_id_to_table('menus');
SELECT public.add_org_id_to_table('menu_item_links');
SELECT public.add_org_id_to_table('student_meal_skips');
SELECT public.add_org_id_to_table('hostel_caretakers');
SELECT public.add_org_id_to_table('announcements');
SELECT public.add_org_id_to_table('announcements_read');
SELECT public.add_org_id_to_table('hostel_wardens');
SELECT public.add_org_id_to_table('security_staff');

-- Drop helper function as we don't need it in production runtime
DROP FUNCTION public.add_org_id_to_table(TEXT);

-- 4. Auth Helper to get current user's organization
CREATE OR REPLACE FUNCTION public.user_org_id() 
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Organizations table RLS
DROP POLICY IF EXISTS policy_orgs_select ON public.organizations;
CREATE POLICY policy_orgs_select ON public.organizations FOR SELECT TO authenticated
USING (id = public.user_org_id());

