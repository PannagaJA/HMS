-- =============================================================================
-- Migration 016: Add image_url to issues table
-- =============================================================================

ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS image_url TEXT;
