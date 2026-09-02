-- =============================================================================
-- Migration 001: Extensions and Core Configuration
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure clean search path
SET search_path = public, auth, pg_temp;
