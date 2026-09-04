-- =============================================================================
-- Migration 032: Secure Admin Dashboard Stats View
-- =============================================================================

-- The view_admin_dashboard_stats was created without security_invoker = true,
-- which means it was running as the view creator (bypassing RLS) and returning
-- stats across all organizations. 
-- We replace it here with security_invoker = true to enforce RLS.

CREATE OR REPLACE VIEW public.view_admin_dashboard_stats 
WITH (security_invoker = true) AS
SELECT 
  (SELECT COUNT(*) FROM public.hostels WHERE is_active = TRUE) AS total_hostels,
  (SELECT COUNT(*) FROM public.hostel_rooms WHERE is_active = TRUE) AS total_rooms,
  (SELECT COUNT(*) FROM public.beds b JOIN public.hostel_rooms r ON b.room_id = r.id WHERE r.is_active = TRUE) AS total_capacity,
  (SELECT COUNT(*) FROM public.room_allocations WHERE is_active = TRUE) AS occupied_beds,
  (SELECT COUNT(*) FROM public.beds b JOIN public.hostel_rooms r ON b.room_id = r.id WHERE r.is_active = TRUE) - 
  (SELECT COUNT(*) FROM public.room_allocations WHERE is_active = TRUE) AS vacant_beds,
  CASE WHEN (SELECT COUNT(*) FROM public.beds b JOIN public.hostel_rooms r ON b.room_id = r.id WHERE r.is_active = TRUE) > 0 
       THEN ROUND(((SELECT COUNT(*) FROM public.room_allocations WHERE is_active = TRUE)::NUMERIC / 
            (SELECT COUNT(*) FROM public.beds b JOIN public.hostel_rooms r ON b.room_id = r.id WHERE r.is_active = TRUE)::NUMERIC * 100), 1)
       ELSE 0 END AS occupancy_rate,
  (SELECT COUNT(*) FROM public.gate_passes WHERE status = 'pending') AS pending_gate_passes,
  (SELECT COUNT(*) FROM public.issues WHERE status != 'completed') AS active_issues;
