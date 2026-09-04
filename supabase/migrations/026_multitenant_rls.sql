-- Re-applying policies with org_id checks
-- =============================================================================
-- Migration 014: Row Level Security (RLS) Policies
-- =============================================================================

-- Enable RLS on all domain tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warden_hostel_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_meal_skips ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
DROP POLICY IF EXISTS policy_profiles_select ON public.profiles;
DROP POLICY IF EXISTS policy_profiles_select ON public.profiles;
DROP POLICY IF EXISTS policy_profiles_select ON public.profiles;
CREATE POLICY policy_profiles_select ON public.profiles FOR SELECT TO authenticated
USING (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden() OR public.is_security() OR id = auth.uid()));

DROP POLICY IF EXISTS policy_profiles_update_admin ON public.profiles;
DROP POLICY IF EXISTS policy_profiles_update_admin ON public.profiles;
DROP POLICY IF EXISTS policy_profiles_update_admin ON public.profiles;
CREATE POLICY policy_profiles_update_admin ON public.profiles FOR UPDATE TO authenticated
USING (org_id = public.user_org_id() AND (public.is_admin())) WITH CHECK (org_id = public.user_org_id() AND (public.is_admin()));

-- 2. Hostels
DROP POLICY IF EXISTS policy_hostels_select ON public.hostels;
DROP POLICY IF EXISTS policy_hostels_select ON public.hostels;
DROP POLICY IF EXISTS policy_hostels_select ON public.hostels;
CREATE POLICY policy_hostels_select ON public.hostels FOR SELECT TO authenticated USING (org_id = public.user_org_id() AND (true));
DROP POLICY IF EXISTS policy_hostels_admin ON public.hostels;
DROP POLICY IF EXISTS policy_hostels_admin ON public.hostels;
DROP POLICY IF EXISTS policy_hostels_admin ON public.hostels;
CREATE POLICY policy_hostels_admin ON public.hostels FOR ALL TO authenticated USING (org_id = public.user_org_id() AND (public.is_admin()));

-- 3. Warden Assignments
DROP POLICY IF EXISTS policy_warden_assignments_select ON public.warden_hostel_assignments;
DROP POLICY IF EXISTS policy_warden_assignments_select ON public.warden_hostel_assignments;
DROP POLICY IF EXISTS policy_warden_assignments_select ON public.warden_hostel_assignments;
CREATE POLICY policy_warden_assignments_select ON public.warden_hostel_assignments FOR SELECT TO authenticated USING (org_id = public.user_org_id() AND (true));
DROP POLICY IF EXISTS policy_warden_assignments_admin ON public.warden_hostel_assignments;
DROP POLICY IF EXISTS policy_warden_assignments_admin ON public.warden_hostel_assignments;
DROP POLICY IF EXISTS policy_warden_assignments_admin ON public.warden_hostel_assignments;
CREATE POLICY policy_warden_assignments_admin ON public.warden_hostel_assignments FOR ALL TO authenticated USING (org_id = public.user_org_id() AND (public.is_admin()));

-- 4. Hostel Rooms & Beds (Direct mutations revoked; Read allowed)
DROP POLICY IF EXISTS policy_rooms_select ON public.hostel_rooms;
DROP POLICY IF EXISTS policy_rooms_select ON public.hostel_rooms;
DROP POLICY IF EXISTS policy_rooms_select ON public.hostel_rooms;
CREATE POLICY policy_rooms_select ON public.hostel_rooms FOR SELECT TO authenticated USING (org_id = public.user_org_id() AND (true));
DROP POLICY IF EXISTS policy_beds_select ON public.beds;
DROP POLICY IF EXISTS policy_beds_select ON public.beds;
DROP POLICY IF EXISTS policy_beds_select ON public.beds;
CREATE POLICY policy_beds_select ON public.beds FOR SELECT TO authenticated USING (org_id = public.user_org_id() AND (true));
DROP POLICY IF EXISTS policy_courses_select ON public.hostel_courses;
DROP POLICY IF EXISTS policy_courses_select ON public.hostel_courses;
DROP POLICY IF EXISTS policy_courses_select ON public.hostel_courses;
CREATE POLICY policy_courses_select ON public.hostel_courses FOR SELECT TO authenticated USING (org_id = public.user_org_id() AND (true));
DROP POLICY IF EXISTS policy_courses_admin ON public.hostel_courses;
DROP POLICY IF EXISTS policy_courses_admin ON public.hostel_courses;
DROP POLICY IF EXISTS policy_courses_admin ON public.hostel_courses;
CREATE POLICY policy_courses_admin ON public.hostel_courses FOR ALL TO authenticated USING (org_id = public.user_org_id() AND (public.is_admin()));

-- 5. Students
DROP POLICY IF EXISTS policy_students_select ON public.students;
DROP POLICY IF EXISTS policy_students_select ON public.students;
DROP POLICY IF EXISTS policy_students_select ON public.students;
CREATE POLICY policy_students_select ON public.students FOR SELECT TO authenticated
USING (org_id = public.user_org_id() AND (
  public.is_admin() 
  OR profile_id = auth.uid()
  OR public.is_security()
  OR (public.is_warden() AND EXISTS (
    SELECT 1 FROM public.room_allocations a
    JOIN public.beds b ON a.bed_id = b.id
    JOIN public.hostel_rooms r ON b.room_id = r.id
    WHERE a.student_id = public.students.id 
      AND a.is_active = TRUE 
      AND r.hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid()))
  ))
));

DROP POLICY IF EXISTS policy_students_admin ON public.students;
DROP POLICY IF EXISTS policy_students_admin ON public.students;
DROP POLICY IF EXISTS policy_students_admin ON public.students;
CREATE POLICY policy_students_admin ON public.students FOR ALL TO authenticated USING (org_id = public.user_org_id() AND (public.is_admin()));

-- 6. Room Allocations
DROP POLICY IF EXISTS policy_allocations_select ON public.room_allocations;
DROP POLICY IF EXISTS policy_allocations_select ON public.room_allocations;
DROP POLICY IF EXISTS policy_allocations_select ON public.room_allocations;
CREATE POLICY policy_allocations_select ON public.room_allocations FOR SELECT TO authenticated
USING (org_id = public.user_org_id() AND (
  public.is_admin()
  OR public.is_security()
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid())
  OR (public.is_warden() AND EXISTS (
    SELECT 1 FROM public.beds b
    JOIN public.hostel_rooms r ON b.room_id = r.id
    WHERE b.id = bed_id AND r.hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid()))
  ))
));

-- 7. Issues
DROP POLICY IF EXISTS policy_issues_select ON public.issues;
DROP POLICY IF EXISTS policy_issues_select ON public.issues;
DROP POLICY IF EXISTS policy_issues_select ON public.issues;
CREATE POLICY policy_issues_select ON public.issues FOR SELECT TO authenticated
USING (org_id = public.user_org_id() AND (
  public.is_admin()
  OR public.is_security()
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid())
  OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
));

DROP POLICY IF EXISTS policy_issues_insert_student ON public.issues;
DROP POLICY IF EXISTS policy_issues_insert_student ON public.issues;
DROP POLICY IF EXISTS policy_issues_insert_student ON public.issues;
CREATE POLICY policy_issues_insert_student ON public.issues FOR INSERT TO authenticated
WITH CHECK (org_id = public.user_org_id() AND (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid())
  OR public.is_admin()
));

DROP POLICY IF EXISTS policy_issue_updates_select ON public.issue_updates;
DROP POLICY IF EXISTS policy_issue_updates_select ON public.issue_updates;
DROP POLICY IF EXISTS policy_issue_updates_select ON public.issue_updates;
CREATE POLICY policy_issue_updates_select ON public.issue_updates FOR SELECT TO authenticated
USING (org_id = public.user_org_id() AND (
  public.is_admin()
  OR (public.is_warden() AND EXISTS (
    SELECT 1 FROM public.issues i WHERE i.id = issue_id AND i.hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid()))
  ))
  OR EXISTS (
    SELECT 1 FROM public.issues i 
    JOIN public.students s ON i.student_id = s.id 
    WHERE i.id = issue_id AND s.profile_id = auth.uid()
  )
));

-- 8. Gate Passes
DROP POLICY IF EXISTS policy_gate_passes_select ON public.gate_passes;
DROP POLICY IF EXISTS policy_gate_passes_select ON public.gate_passes;
DROP POLICY IF EXISTS policy_gate_passes_select ON public.gate_passes;
CREATE POLICY policy_gate_passes_select ON public.gate_passes FOR SELECT TO authenticated
USING (org_id = public.user_org_id() AND (
  public.is_admin()
  OR public.is_security()
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid())
  OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
));

DROP POLICY IF EXISTS policy_gate_passes_insert ON public.gate_passes;
DROP POLICY IF EXISTS policy_gate_passes_insert ON public.gate_passes;
DROP POLICY IF EXISTS policy_gate_passes_insert ON public.gate_passes;
CREATE POLICY policy_gate_passes_insert ON public.gate_passes FOR INSERT TO authenticated
WITH CHECK (org_id = public.user_org_id() AND (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid())
  OR public.is_admin()
));

DROP POLICY IF EXISTS policy_gate_passes_update ON public.gate_passes;
DROP POLICY IF EXISTS policy_gate_passes_update ON public.gate_passes;
DROP POLICY IF EXISTS policy_gate_passes_update ON public.gate_passes;
CREATE POLICY policy_gate_passes_update ON public.gate_passes FOR UPDATE TO authenticated
USING (org_id = public.user_org_id() AND (
  public.is_admin()
  OR public.is_security()
  OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
))
WITH CHECK (org_id = public.user_org_id() AND (
  public.is_admin()
  OR public.is_security()
  OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
));

-- 9. Visitor Logs
DROP POLICY IF EXISTS policy_visitor_logs_select ON public.visitor_logs;
DROP POLICY IF EXISTS policy_visitor_logs_select ON public.visitor_logs;
DROP POLICY IF EXISTS policy_visitor_logs_select ON public.visitor_logs;
CREATE POLICY policy_visitor_logs_select ON public.visitor_logs FOR SELECT TO authenticated
USING (org_id = public.user_org_id() AND (
  public.is_admin()
  OR public.is_security()
  OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid())
));

DROP POLICY IF EXISTS policy_visitor_logs_insert ON public.visitor_logs;
DROP POLICY IF EXISTS policy_visitor_logs_insert ON public.visitor_logs;
DROP POLICY IF EXISTS policy_visitor_logs_insert ON public.visitor_logs;
CREATE POLICY policy_visitor_logs_insert ON public.visitor_logs FOR INSERT TO authenticated
WITH CHECK (org_id = public.user_org_id() AND (public.is_admin() OR public.is_security()));

-- 10. Dining
DROP POLICY IF EXISTS policy_meal_types_select ON public.meal_types;
DROP POLICY IF EXISTS policy_meal_types_select ON public.meal_types;
DROP POLICY IF EXISTS policy_meal_types_select ON public.meal_types;
CREATE POLICY policy_meal_types_select ON public.meal_types FOR SELECT TO authenticated USING (org_id = public.user_org_id() AND (true));
DROP POLICY IF EXISTS policy_meal_types_admin ON public.meal_types;
DROP POLICY IF EXISTS policy_meal_types_admin ON public.meal_types;
DROP POLICY IF EXISTS policy_meal_types_admin ON public.meal_types;
CREATE POLICY policy_meal_types_admin ON public.meal_types FOR ALL TO authenticated USING (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden())) WITH CHECK (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden()));

DROP POLICY IF EXISTS policy_menu_items_select ON public.menu_items;
DROP POLICY IF EXISTS policy_menu_items_select ON public.menu_items;
DROP POLICY IF EXISTS policy_menu_items_select ON public.menu_items;
CREATE POLICY policy_menu_items_select ON public.menu_items FOR SELECT TO authenticated USING (org_id = public.user_org_id() AND (true));
DROP POLICY IF EXISTS policy_menu_items_admin ON public.menu_items;
DROP POLICY IF EXISTS policy_menu_items_admin ON public.menu_items;
DROP POLICY IF EXISTS policy_menu_items_admin ON public.menu_items;
CREATE POLICY policy_menu_items_admin ON public.menu_items FOR ALL TO authenticated USING (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden())) WITH CHECK (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden()));

DROP POLICY IF EXISTS policy_menus_select ON public.menus;
DROP POLICY IF EXISTS policy_menus_select ON public.menus;
DROP POLICY IF EXISTS policy_menus_select ON public.menus;
CREATE POLICY policy_menus_select ON public.menus FOR SELECT TO authenticated USING (org_id = public.user_org_id() AND (true));
DROP POLICY IF EXISTS policy_menus_admin ON public.menus;
DROP POLICY IF EXISTS policy_menus_admin ON public.menus;
DROP POLICY IF EXISTS policy_menus_admin ON public.menus;
CREATE POLICY policy_menus_admin ON public.menus FOR ALL TO authenticated USING (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden())) WITH CHECK (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden()));

DROP POLICY IF EXISTS policy_menu_item_links_select ON public.menu_item_links;
DROP POLICY IF EXISTS policy_menu_item_links_select ON public.menu_item_links;
DROP POLICY IF EXISTS policy_menu_item_links_select ON public.menu_item_links;
CREATE POLICY policy_menu_item_links_select ON public.menu_item_links FOR SELECT TO authenticated USING (org_id = public.user_org_id() AND (true));
DROP POLICY IF EXISTS policy_menu_item_links_admin ON public.menu_item_links;
DROP POLICY IF EXISTS policy_menu_item_links_admin ON public.menu_item_links;
DROP POLICY IF EXISTS policy_menu_item_links_admin ON public.menu_item_links;
CREATE POLICY policy_menu_item_links_admin ON public.menu_item_links FOR ALL TO authenticated USING (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden())) WITH CHECK (org_id = public.user_org_id() AND (public.is_admin() OR public.is_warden()));

DROP POLICY IF EXISTS policy_meal_skips_select ON public.student_meal_skips;
DROP POLICY IF EXISTS policy_meal_skips_select ON public.student_meal_skips;
DROP POLICY IF EXISTS policy_meal_skips_select ON public.student_meal_skips;
CREATE POLICY policy_meal_skips_select ON public.student_meal_skips FOR SELECT TO authenticated
USING (org_id = public.user_org_id() AND (
  public.is_admin()
  OR (public.is_warden() AND hostel_id IN (SELECT public.get_warden_hostel_ids(auth.uid())))
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid())
));

DROP POLICY IF EXISTS policy_meal_skips_insert ON public.student_meal_skips;
DROP POLICY IF EXISTS policy_meal_skips_insert ON public.student_meal_skips;
DROP POLICY IF EXISTS policy_meal_skips_insert ON public.student_meal_skips;
CREATE POLICY policy_meal_skips_insert ON public.student_meal_skips FOR INSERT TO authenticated
WITH CHECK (org_id = public.user_org_id() AND (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid())
  OR public.is_admin()
));

DROP POLICY IF EXISTS policy_meal_skips_delete ON public.student_meal_skips;
DROP POLICY IF EXISTS policy_meal_skips_delete ON public.student_meal_skips;
DROP POLICY IF EXISTS policy_meal_skips_delete ON public.student_meal_skips;
CREATE POLICY policy_meal_skips_delete ON public.student_meal_skips FOR DELETE TO authenticated
USING (org_id = public.user_org_id() AND (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.profile_id = auth.uid())
  OR public.is_admin()
));

-- Enable RLS on announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read announcements
DROP POLICY IF EXISTS "Allow read access to all users" ON announcements;
CREATE POLICY "Allow read access to all users" ON announcements FOR SELECT 
USING (org_id = public.user_org_id() AND (true));

-- Allow authenticated users to insert announcements
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON announcements;
CREATE POLICY "Allow insert access to authenticated users" ON announcements FOR INSERT 
WITH CHECK (org_id = public.user_org_id() AND (auth.role() = 'authenticated' OR true));

-- (Optional) If you are not using Supabase Auth strictly, you can just allow anon access:
DROP POLICY IF EXISTS "Allow anon insert access" ON announcements;
CREATE POLICY "Allow anon insert access" ON announcements FOR INSERT
WITH CHECK (org_id = public.user_org_id() AND (true));

-- Enable RLS on announcements_read
ALTER TABLE announcements_read ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to announcements_read" ON announcements_read;
CREATE POLICY "Allow all access to announcements_read" ON announcements_read FOR ALL 
USING (org_id = public.user_org_id() AND (true)) WITH CHECK (org_id = public.user_org_id() AND (true));

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
DROP POLICY IF EXISTS policy_gate_passes_update ON public.gate_passes;
DROP POLICY IF EXISTS policy_gate_passes_update ON public.gate_passes;
CREATE POLICY policy_gate_passes_update ON public.gate_passes FOR UPDATE TO authenticated
USING (org_id = public.user_org_id() AND (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('ADMIN', 'SECURITY', 'WARDEN')
  )
))
WITH CHECK (org_id = public.user_org_id() AND (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('ADMIN', 'SECURITY', 'WARDEN')
  )
));

