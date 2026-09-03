-- =============================================================================
-- Migration 023: Add Warden and Caretaker ID to Hostels
-- =============================================================================

ALTER TABLE public.hostels 
ADD COLUMN IF NOT EXISTS warden_id TEXT,
ADD COLUMN IF NOT EXISTS caretaker_id TEXT;
