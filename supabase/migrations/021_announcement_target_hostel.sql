-- Migration: Add target_hostel_id to announcements
-- This allows announcements to be targeted to specific hostels.

ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS target_hostel_id bigint REFERENCES hostels(id) ON DELETE CASCADE;

-- Update RLS to allow reading if target_hostel_id is null OR matches user's hostel
-- Note: Since the frontend currently filters this via JS or targeted query, 
-- we leave the SELECT policy open (true) to avoid complex auth.uid() joins for now, 
-- but you can restrict it later if needed.
