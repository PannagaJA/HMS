-- =============================================================================
-- Migration 017: Grants and Revocations
-- =============================================================================

-- Revoke direct mutation on controlled business tables
REVOKE INSERT, UPDATE, DELETE ON public.hostel_rooms FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.beds FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.room_allocations FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE ON public.issue_updates FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON public.issue_updates FROM PUBLIC, anon, authenticated;

-- Direct update on issues is revoked (must use update_issue_status RPC)
REVOKE UPDATE ON public.issues FROM PUBLIC, anon, authenticated;

-- Direct update on gate_passes is revoked (must use approve/reject/movement RPCs)
REVOKE UPDATE ON public.gate_passes FROM PUBLIC, anon, authenticated;

-- Revoke execution from PUBLIC on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.create_room_with_beds FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resize_room_capacity FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decommission_room FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.allocate_student_room FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vacate_student_room FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_issue_status FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_gate_pass FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_gate_pass FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_gate_movement FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.checkout_visitor FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_my_profile FROM PUBLIC;

-- Grant execution to authenticated users (role checks handled inside functions)
GRANT EXECUTE ON FUNCTION public.create_room_with_beds TO authenticated;
GRANT EXECUTE ON FUNCTION public.resize_room_capacity TO authenticated;
GRANT EXECUTE ON FUNCTION public.decommission_room TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_student_room TO authenticated;
GRANT EXECUTE ON FUNCTION public.vacate_student_room TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_issue_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_gate_pass TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_gate_pass TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_gate_movement TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_visitor TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile TO authenticated;
