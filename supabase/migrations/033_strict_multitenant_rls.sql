-- =============================================================================
-- HMS MASTER MULTI-TENANT ISOLATION & RESTORATION SCRIPT
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: Ensure org_id Columns Exist and Drop Legacy Triggers Early
-- -----------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.hostels ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.hostel_rooms ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.room_allocations ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.hostel_courses ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.meal_types ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.menu_item_links ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.student_meal_skips ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.gate_passes ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.issue_updates ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.visitor_logs ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.announcements_read ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.hostel_caretakers ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.security_staff ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.warden_hostel_assignments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Drop legacy triggers early
DROP TRIGGER IF EXISTS tr_set_org_id_hostels ON public.hostels;
DROP TRIGGER IF EXISTS tr_set_org_id_rooms ON public.hostel_rooms;
DROP TRIGGER IF EXISTS tr_set_org_id_beds ON public.beds;
DROP TRIGGER IF EXISTS tr_set_org_id_students ON public.students;
DROP TRIGGER IF EXISTS tr_set_org_id_allocations ON public.room_allocations;
DROP TRIGGER IF EXISTS tr_set_org_id_courses ON public.hostel_courses;
DROP TRIGGER IF EXISTS tr_set_org_id_meal_types ON public.meal_types;
DROP TRIGGER IF EXISTS tr_set_org_id_menu_items ON public.menu_items;
DROP TRIGGER IF EXISTS tr_set_org_id_menus ON public.menus;
DROP TRIGGER IF EXISTS tr_set_org_id_menu_links ON public.menu_item_links;
DROP TRIGGER IF EXISTS tr_set_org_id_skips ON public.student_meal_skips;
DROP TRIGGER IF EXISTS tr_set_org_id_gate_passes ON public.gate_passes;
DROP TRIGGER IF EXISTS tr_set_org_id_issues ON public.issues;
DROP TRIGGER IF EXISTS tr_set_org_id_issue_updates ON public.issue_updates;
DROP TRIGGER IF EXISTS tr_set_org_id_visitor_logs ON public.visitor_logs;
DROP TRIGGER IF EXISTS tr_set_org_id_announcements ON public.announcements;
DROP TRIGGER IF EXISTS tr_set_org_id_announcements_read ON public.announcements_read;
DROP TRIGGER IF EXISTS tr_set_org_id_wardens ON public.hostel_wardens;
DROP TRIGGER IF EXISTS tr_set_org_id_caretakers ON public.hostel_caretakers;
DROP TRIGGER IF EXISTS tr_set_org_id_security ON public.security_staff;
DROP TRIGGER IF EXISTS tr_set_org_id_warden_assignments ON public.warden_hostel_assignments;

-- -----------------------------------------------------------------------------
-- SECTION 2: Restore & Re-Align AMC and Starlight Data
-- -----------------------------------------------------------------------------

-- Ensure Default AMC Organization
INSERT INTO public.organizations (id, name, subdomain) 
VALUES ('00000000-0000-0000-0000-000000000001', 'AMC Engineering College (Default)', 'amc')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  amc_org_id UUID := '00000000-0000-0000-0000-000000000001';
  starlight_org_id UUID;
BEGIN
  -- Find Starlight Organization if it exists
  SELECT id INTO starlight_org_id 
  FROM public.organizations 
  WHERE name ILIKE '%starlight%' OR name ILIKE '%stalight%' 
  ORDER BY created_at DESC 
  LIMIT 1;

  -- 1. If Starlight exists, tag its specific hostels, profiles, students
  IF starlight_org_id IS NOT NULL THEN
    UPDATE public.hostels SET org_id = starlight_org_id 
    WHERE name ILIKE '%starlight%' OR name ILIKE '%stalight%';

    UPDATE public.profiles SET org_id = starlight_org_id 
    WHERE email ILIKE '%starlight%' OR email ILIKE '%stalight%';

    UPDATE public.students SET org_id = starlight_org_id 
    WHERE email ILIKE '%starlight%' OR email ILIKE '%stalight%';
  END IF;

  -- 2. Any hostels without org_id belong to AMC
  UPDATE public.hostels SET org_id = amc_org_id WHERE org_id IS NULL;
  UPDATE public.profiles SET org_id = amc_org_id WHERE org_id IS NULL;
  UPDATE public.students SET org_id = amc_org_id WHERE org_id IS NULL;

  -- 3. Re-align rooms and beds to parent hostel's org_id
  UPDATE public.hostel_rooms r
  SET org_id = h.org_id
  FROM public.hostels h
  WHERE r.hostel_id = h.id;

  UPDATE public.beds b
  SET org_id = r.org_id
  FROM public.hostel_rooms r
  WHERE b.room_id = r.id;

  -- 4. Re-align allocations, passes, issues, skips, logs to student's org_id
  UPDATE public.room_allocations a
  SET org_id = s.org_id
  FROM public.students s
  WHERE a.student_id = s.id;

  UPDATE public.gate_passes gp
  SET org_id = s.org_id
  FROM public.students s
  WHERE gp.student_id = s.id;

  UPDATE public.issues i
  SET org_id = s.org_id
  FROM public.students s
  WHERE i.student_id = s.id;

  UPDATE public.issue_updates iu
  SET org_id = i.org_id
  FROM public.issues i
  WHERE iu.issue_id = i.id;

  UPDATE public.student_meal_skips ms
  SET org_id = s.org_id
  FROM public.students s
  WHERE ms.student_id = s.id;

  UPDATE public.visitor_logs vl
  SET org_id = s.org_id
  FROM public.students s
  WHERE vl.student_id = s.id;

  -- 5. Re-align menus and warden assignments
  UPDATE public.menus m
  SET org_id = h.org_id
  FROM public.hostels h
  WHERE m.hostel_id = h.id;

  UPDATE public.menu_item_links ml
  SET org_id = m.org_id
  FROM public.menus m
  WHERE ml.menu_id = m.id;

  UPDATE public.warden_hostel_assignments wha
  SET org_id = h.org_id
  FROM public.hostels h
  WHERE wha.hostel_id = h.id;

  -- 6. Ensure default meal types for all organizations
  UPDATE public.meal_types SET org_id = amc_org_id WHERE org_id IS NULL;
  UPDATE public.menu_items SET org_id = amc_org_id WHERE org_id IS NULL;
END;
$$;

-- Seed missing meal types for each organization
DO $$
DECLARE
  org_rec RECORD;
BEGIN
  FOR org_rec IN SELECT id FROM public.organizations WHERE id IS NOT NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM public.meal_types WHERE org_id = org_rec.id AND name = 'BR') THEN
      INSERT INTO public.meal_types (name, description, time_from, time_to, org_id)
      VALUES ('BR', 'Breakfast', '07:30:00', '09:00:00', org_rec.id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.meal_types WHERE org_id = org_rec.id AND name = 'LN') THEN
      INSERT INTO public.meal_types (name, description, time_from, time_to, org_id)
      VALUES ('LN', 'Lunch', '12:30:00', '14:00:00', org_rec.id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.meal_types WHERE org_id = org_rec.id AND name = 'SN') THEN
      INSERT INTO public.meal_types (name, description, time_from, time_to, org_id)
      VALUES ('SN', 'Snacks', '16:30:00', '17:30:00', org_rec.id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.meal_types WHERE org_id = org_rec.id AND name = 'DN') THEN
      INSERT INTO public.meal_types (name, description, time_from, time_to, org_id)
      VALUES ('DN', 'Dinner', '19:30:00', '21:00:00', org_rec.id);
    END IF;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- SECTION 3: Helper Functions for Fast, Recursion-Free Auth & Tenancy
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_org_id() 
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.user_role() 
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.user_student_id()
RETURNS BIGINT AS $$
  SELECT id FROM public.students WHERE profile_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
  SELECT public.user_role() = 'ADMIN';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_warden() 
RETURNS BOOLEAN AS $$
  SELECT public.user_role() = 'WARDEN';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_security() 
RETURNS BOOLEAN AS $$
  SELECT public.user_role() = 'SECURITY';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_student() 
RETURNS BOOLEAN AS $$
  SELECT public.user_role() = 'STUDENT';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.get_warden_hostel_ids(p_warden_id UUID)
RETURNS SETOF BIGINT AS $$
  SELECT hostel_id FROM public.warden_hostel_assignments WHERE warden_profile_id = p_warden_id
  UNION
  SELECT id FROM public.hostels WHERE warden_id = p_warden_id::TEXT;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- SECTION 4: Auto-Assign org_id Triggers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trig_fn_set_org_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL OR NEW.org_id = '00000000-0000-0000-0000-000000000001'::UUID THEN
    NEW.org_id := COALESCE(public.user_org_id(), NEW.org_id, '00000000-0000-0000-0000-000000000001'::UUID);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Attach triggers
DROP TRIGGER IF EXISTS tr_set_org_id_hostels ON public.hostels;
CREATE TRIGGER tr_set_org_id_hostels BEFORE INSERT ON public.hostels FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_rooms ON public.hostel_rooms;
CREATE TRIGGER tr_set_org_id_rooms BEFORE INSERT ON public.hostel_rooms FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_beds ON public.beds;
CREATE TRIGGER tr_set_org_id_beds BEFORE INSERT ON public.beds FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_students ON public.students;
CREATE TRIGGER tr_set_org_id_students BEFORE INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_allocations ON public.room_allocations;
CREATE TRIGGER tr_set_org_id_allocations BEFORE INSERT ON public.room_allocations FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_courses ON public.hostel_courses;
CREATE TRIGGER tr_set_org_id_courses BEFORE INSERT ON public.hostel_courses FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_meal_types ON public.meal_types;
CREATE TRIGGER tr_set_org_id_meal_types BEFORE INSERT ON public.meal_types FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_menu_items ON public.menu_items;
CREATE TRIGGER tr_set_org_id_menu_items BEFORE INSERT ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_menus ON public.menus;
CREATE TRIGGER tr_set_org_id_menus BEFORE INSERT ON public.menus FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_menu_links ON public.menu_item_links;
CREATE TRIGGER tr_set_org_id_menu_links BEFORE INSERT ON public.menu_item_links FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_skips ON public.student_meal_skips;
CREATE TRIGGER tr_set_org_id_skips BEFORE INSERT ON public.student_meal_skips FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_gate_passes ON public.gate_passes;
CREATE TRIGGER tr_set_org_id_gate_passes BEFORE INSERT ON public.gate_passes FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_issues ON public.issues;
CREATE TRIGGER tr_set_org_id_issues BEFORE INSERT ON public.issues FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_issue_updates ON public.issue_updates;
CREATE TRIGGER tr_set_org_id_issue_updates BEFORE INSERT ON public.issue_updates FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_visitor_logs ON public.visitor_logs;
CREATE TRIGGER tr_set_org_id_visitor_logs BEFORE INSERT ON public.visitor_logs FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_announcements ON public.announcements;
CREATE TRIGGER tr_set_org_id_announcements BEFORE INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_announcements_read ON public.announcements_read;
CREATE TRIGGER tr_set_org_id_announcements_read BEFORE INSERT ON public.announcements_read FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_wardens ON public.hostel_wardens;
CREATE TRIGGER tr_set_org_id_wardens BEFORE INSERT ON public.hostel_wardens FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_caretakers ON public.hostel_caretakers;
CREATE TRIGGER tr_set_org_id_caretakers BEFORE INSERT ON public.hostel_caretakers FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_security ON public.security_staff;
CREATE TRIGGER tr_set_org_id_security BEFORE INSERT ON public.security_staff FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

DROP TRIGGER IF EXISTS tr_set_org_id_warden_assignments ON public.warden_hostel_assignments;
CREATE TRIGGER tr_set_org_id_warden_assignments BEFORE INSERT ON public.warden_hostel_assignments FOR EACH ROW EXECUTE FUNCTION public.trig_fn_set_org_id();

-- -----------------------------------------------------------------------------
-- SECTION 5: Drop Wide-Open & Legacy Policies
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'organizations', 'profiles', 'hostels', 'hostel_rooms', 'beds', 
        'students', 'room_allocations', 'hostel_courses', 'meal_types', 
        'menu_items', 'menus', 'menu_item_links', 'student_meal_skips', 
        'gate_passes', 'issues', 'issue_updates', 'visitor_logs', 
        'announcements', 'announcements_read', 'hostel_wardens', 
        'hostel_caretakers', 'security_staff', 'warden_hostel_assignments'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END;
$$;

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_meal_skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements_read ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_wardens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_caretakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warden_hostel_assignments ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- SECTION 6: Multi-Tenant RLS Policies (Works for JWT and Scoped Anon Queries)
-- -----------------------------------------------------------------------------

-- 6.1 Organizations
CREATE POLICY policy_org_all ON public.organizations FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 6.2 Profiles
CREATE POLICY policy_profiles_all ON public.profiles FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR id = auth.uid())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR id = auth.uid());

-- 6.3 Hostels
CREATE POLICY policy_hostels_all ON public.hostels FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

-- 6.4 Rooms & Beds
CREATE POLICY policy_rooms_all ON public.hostel_rooms FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

CREATE POLICY policy_beds_all ON public.beds FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

-- 6.5 Students
CREATE POLICY policy_students_all ON public.students FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR profile_id = auth.uid())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR profile_id = auth.uid());

-- 6.6 Room Allocations
CREATE POLICY policy_allocations_all ON public.room_allocations FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR student_id = public.user_student_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR student_id = public.user_student_id());

-- 6.7 Staff & Assignments
CREATE POLICY policy_wardens_all ON public.hostel_wardens FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

CREATE POLICY policy_caretakers_all ON public.hostel_caretakers FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

CREATE POLICY policy_security_all ON public.security_staff FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

CREATE POLICY policy_warden_assignments_all ON public.warden_hostel_assignments FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

CREATE POLICY policy_courses_all ON public.hostel_courses FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

-- 6.8 Dining & Menu
CREATE POLICY policy_meal_types_all ON public.meal_types FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

CREATE POLICY policy_menu_items_all ON public.menu_items FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

CREATE POLICY policy_menus_all ON public.menus FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

CREATE POLICY policy_menu_links_all ON public.menu_item_links FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

CREATE POLICY policy_skips_all ON public.student_meal_skips FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR student_id = public.user_student_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR student_id = public.user_student_id());

-- 6.9 Gate Passes
CREATE POLICY policy_gate_passes_all ON public.gate_passes FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR student_id = public.user_student_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR student_id = public.user_student_id());

-- 6.10 Issues & Updates
CREATE POLICY policy_issues_all ON public.issues FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR student_id = public.user_student_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR student_id = public.user_student_id());

CREATE POLICY policy_issue_updates_all ON public.issue_updates FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

-- 6.11 Visitor Logs
CREATE POLICY policy_visitor_logs_all ON public.visitor_logs FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR student_id = public.user_student_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id() OR student_id = public.user_student_id());

-- 6.12 Announcements
CREATE POLICY policy_announcements_all ON public.announcements FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

CREATE POLICY policy_announcements_read_all ON public.announcements_read FOR ALL TO anon, authenticated
USING (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id())
WITH CHECK (org_id IS NULL OR public.user_org_id() IS NULL OR org_id = public.user_org_id());

-- -----------------------------------------------------------------------------
-- SECTION 7: Grant Schema & Table Permissions
-- -----------------------------------------------------------------------------

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.user_org_id TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_role TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_student_id TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_warden TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_security TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_student TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_warden_hostel_ids TO anon, authenticated, service_role;
