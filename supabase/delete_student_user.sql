-- =============================================================================
-- SAFELY DELETE USER: student@amc.edu (AND FIX ALL DELETION CASCADE CONSTRAINTS)
-- Run this in your Supabase SQL Editor
-- =============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_student_id BIGINT;
BEGIN
  -- 1. Locate the user by email or specific UID
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE LOWER(email) = 'student@amc.edu' OR id = '72bfe61a-276b-42a3-ac2b-993172a4c083'::UUID
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Find corresponding student record if any
    SELECT id INTO v_student_id FROM public.students WHERE profile_id = v_user_id;

    -- Clean up student-related records in correct dependency order
    IF v_student_id IS NOT NULL THEN
      -- Delete issue updates linked to this student's issues first
      DELETE FROM public.issue_updates WHERE issue_id IN (SELECT id FROM public.issues WHERE student_id = v_student_id);
      
      -- Delete issues
      DELETE FROM public.issues WHERE student_id = v_student_id;
      
      -- Delete gate passes
      DELETE FROM public.gate_passes WHERE student_id = v_student_id;
      
      -- Delete room allocations
      DELETE FROM public.room_allocations WHERE student_id = v_student_id;
      
      -- Delete dining attendance/tokens if table exists
      BEGIN
        DELETE FROM public.dining_qr_tokens WHERE student_id = v_student_id;
      EXCEPTION WHEN undefined_table THEN NULL; END;

      -- Delete student record
      DELETE FROM public.students WHERE id = v_student_id;
    END IF;

    -- Clean up any remaining direct profile/user references in issue_updates / gate_passes / issues
    BEGIN
      DELETE FROM public.issue_updates WHERE updated_by = v_user_id;
    EXCEPTION WHEN undefined_column THEN NULL; END;

    BEGIN
      DELETE FROM public.gate_passes WHERE approved_by = v_user_id;
    EXCEPTION WHEN undefined_column THEN NULL; END;

    BEGIN
      DELETE FROM public.issues WHERE resolved_by = v_user_id;
    EXCEPTION WHEN undefined_column THEN NULL; END;

    -- Delete profile record
    DELETE FROM public.profiles WHERE id = v_user_id;

    -- Clean up auth tables
    DELETE FROM auth.identities WHERE user_id = v_user_id;
    DELETE FROM auth.sessions WHERE user_id = v_user_id;
    
    BEGIN
      DELETE FROM auth.mfa_factors WHERE user_id = v_user_id;
    EXCEPTION WHEN undefined_table THEN NULL; END;
    
    DELETE FROM auth.users WHERE id = v_user_id;

    RAISE NOTICE 'Successfully deleted user student@amc.edu (UID: %)', v_user_id;
  ELSE
    RAISE NOTICE 'User student@amc.edu was not found in auth.users.';
  END IF;
END $$;

-- 2. Add ON DELETE CASCADE to foreign keys so deleting issues/profiles/users cascades automatically
DO $$
BEGIN
  -- Fix issue_updates -> issues cascade
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'issue_updates_issue_id_fkey') THEN
    ALTER TABLE public.issue_updates DROP CONSTRAINT issue_updates_issue_id_fkey;
    ALTER TABLE public.issue_updates ADD CONSTRAINT issue_updates_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.issues(id) ON DELETE CASCADE;
  END IF;

  -- Fix profiles -> auth.users cascade
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'profiles_id_fkey') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Fix students -> profiles cascade
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'students_profile_id_fkey') THEN
    ALTER TABLE public.students DROP CONSTRAINT students_profile_id_fkey;
    ALTER TABLE public.students ADD CONSTRAINT students_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
