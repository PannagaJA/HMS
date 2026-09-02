-- =============================================================================
-- Migration 013: Snapshot Triggers & Data Integrity
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trig_fn_snapshot_student_location()
RETURNS TRIGGER AS $$
DECLARE
  v_hostel_id BIGINT;
  v_room_id BIGINT;
BEGIN
  SELECT r.hostel_id, r.id INTO v_hostel_id, v_room_id
  FROM public.room_allocations a
  JOIN public.beds b ON a.bed_id = b.id
  JOIN public.hostel_rooms r ON b.room_id = r.id
  WHERE a.student_id = NEW.student_id AND a.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot create record: Student % has no active room allocation.', NEW.student_id;
  END IF;

  NEW.hostel_id := v_hostel_id;
  IF TG_TABLE_NAME IN ('issues', 'gate_passes', 'visitor_logs') THEN
    NEW.room_id := v_room_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- Attach to historical tables
DROP TRIGGER IF EXISTS tr_snapshot_issues_loc ON public.issues;
CREATE TRIGGER tr_snapshot_issues_loc 
BEFORE INSERT ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.trig_fn_snapshot_student_location();

DROP TRIGGER IF EXISTS tr_snapshot_gate_loc ON public.gate_passes;
CREATE TRIGGER tr_snapshot_gate_loc 
BEFORE INSERT ON public.gate_passes
FOR EACH ROW EXECUTE FUNCTION public.trig_fn_snapshot_student_location();

DROP TRIGGER IF EXISTS tr_snapshot_visitor_loc ON public.visitor_logs;
CREATE TRIGGER tr_snapshot_visitor_loc 
BEFORE INSERT ON public.visitor_logs
FOR EACH ROW EXECUTE FUNCTION public.trig_fn_snapshot_student_location();

DROP TRIGGER IF EXISTS tr_snapshot_mealskip_loc ON public.student_meal_skips;
CREATE TRIGGER tr_snapshot_mealskip_loc 
BEFORE INSERT ON public.student_meal_skips
FOR EACH ROW EXECUTE FUNCTION public.trig_fn_snapshot_student_location();
