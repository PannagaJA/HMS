-- =============================================================================
-- Migration 016: Operational Views
-- =============================================================================

CREATE OR REPLACE VIEW public.view_admin_dashboard_stats AS
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

CREATE OR REPLACE VIEW public.view_warden_dashboard_stats 
WITH (security_invoker = true) AS
SELECT 
  h.id AS hostel_id,
  h.name AS hostel_name,
  h.gender,
  h.floor_count,
  COUNT(DISTINCT hr.id) AS total_rooms,
  COUNT(DISTINCT b.id) AS total_capacity,
  COUNT(DISTINCT a.id) FILTER (WHERE a.is_active = TRUE) AS occupied_beds,
  COUNT(DISTINCT b.id) - COUNT(DISTINCT a.id) FILTER (WHERE a.is_active = TRUE) AS vacant_beds,
  (SELECT COUNT(*) FROM public.gate_passes gp WHERE gp.hostel_id = h.id AND gp.status = 'pending') AS pending_gate_passes,
  (SELECT COUNT(*) FROM public.issues iss WHERE iss.hostel_id = h.id AND iss.status != 'completed') AS open_issues
FROM public.hostels h
JOIN public.warden_hostel_assignments wha ON wha.hostel_id = h.id AND wha.warden_profile_id = auth.uid()
LEFT JOIN public.hostel_rooms hr ON hr.hostel_id = h.id AND hr.is_active = TRUE
LEFT JOIN public.beds b ON b.room_id = hr.id
LEFT JOIN public.room_allocations a ON a.bed_id = b.id AND a.is_active = TRUE
GROUP BY h.id, h.name, h.gender, h.floor_count;
