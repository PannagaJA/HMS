-- =============================================================================
-- Migration 027: Multi-Tenant Auto-Assignment Triggers
-- =============================================================================

-- Trigger function to auto-assign org_id on insert
CREATE OR REPLACE FUNCTION public.set_org_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.user_org_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
DROP TRIGGER IF EXISTS trg_set_org_id_profiles ON public.profiles;
CREATE TRIGGER trg_set_org_id_profiles BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_hostels ON public.hostels;
CREATE TRIGGER trg_set_org_id_hostels BEFORE INSERT ON public.hostels FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_warden_assignments ON public.warden_hostel_assignments;
CREATE TRIGGER trg_set_org_id_warden_assignments BEFORE INSERT ON public.warden_hostel_assignments FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_hostel_rooms ON public.hostel_rooms;
CREATE TRIGGER trg_set_org_id_hostel_rooms BEFORE INSERT ON public.hostel_rooms FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_beds ON public.beds;
CREATE TRIGGER trg_set_org_id_beds BEFORE INSERT ON public.beds FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_hostel_courses ON public.hostel_courses;
CREATE TRIGGER trg_set_org_id_hostel_courses BEFORE INSERT ON public.hostel_courses FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_students ON public.students;
CREATE TRIGGER trg_set_org_id_students BEFORE INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_room_allocations ON public.room_allocations;
CREATE TRIGGER trg_set_org_id_room_allocations BEFORE INSERT ON public.room_allocations FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_issues ON public.issues;
CREATE TRIGGER trg_set_org_id_issues BEFORE INSERT ON public.issues FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_issue_updates ON public.issue_updates;
CREATE TRIGGER trg_set_org_id_issue_updates BEFORE INSERT ON public.issue_updates FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_gate_passes ON public.gate_passes;
CREATE TRIGGER trg_set_org_id_gate_passes BEFORE INSERT ON public.gate_passes FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_visitor_logs ON public.visitor_logs;
CREATE TRIGGER trg_set_org_id_visitor_logs BEFORE INSERT ON public.visitor_logs FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_meal_types ON public.meal_types;
CREATE TRIGGER trg_set_org_id_meal_types BEFORE INSERT ON public.meal_types FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_menu_items ON public.menu_items;
CREATE TRIGGER trg_set_org_id_menu_items BEFORE INSERT ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_menus ON public.menus;
CREATE TRIGGER trg_set_org_id_menus BEFORE INSERT ON public.menus FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_menu_item_links ON public.menu_item_links;
CREATE TRIGGER trg_set_org_id_menu_item_links BEFORE INSERT ON public.menu_item_links FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_student_meal_skips ON public.student_meal_skips;
CREATE TRIGGER trg_set_org_id_student_meal_skips BEFORE INSERT ON public.student_meal_skips FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_hostel_caretakers ON public.hostel_caretakers;
CREATE TRIGGER trg_set_org_id_hostel_caretakers BEFORE INSERT ON public.hostel_caretakers FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_announcements ON public.announcements;
CREATE TRIGGER trg_set_org_id_announcements BEFORE INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_announcements_read ON public.announcements_read;
CREATE TRIGGER trg_set_org_id_announcements_read BEFORE INSERT ON public.announcements_read FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_hostel_wardens ON public.hostel_wardens;
CREATE TRIGGER trg_set_org_id_hostel_wardens BEFORE INSERT ON public.hostel_wardens FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
DROP TRIGGER IF EXISTS trg_set_org_id_security_staff ON public.security_staff;
CREATE TRIGGER trg_set_org_id_security_staff BEFORE INSERT ON public.security_staff FOR EACH ROW EXECUTE FUNCTION public.set_org_id_on_insert();
