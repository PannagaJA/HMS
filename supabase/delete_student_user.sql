-- =============================================================================
-- COMPLETE & CLEAN REMOVAL OF ORPHANED USER: student@amc.edu
-- Run this in your Supabase SQL Editor
-- =============================================================================

DO $$
DECLARE
  v_rec RECORD;
  v_st_id BIGINT;
BEGIN
  -- Loop through any auth user matching 'student@amc.edu' or known test UIDs
  FOR v_rec IN (
    SELECT id, email 
    FROM auth.users 
    WHERE LOWER(email) = 'student@amc.edu' 
       OR id IN ('72bfe61a-276b-42a3-ac2b-993172a4c083'::uuid, 'c9fabe92-0e0f-4c43-a54b-2c84a8b8a469'::uuid)
  ) LOOP

    RAISE NOTICE 'Cleaning up user: % (ID: %)', v_rec.email, v_rec.id;

    -- 1. If linked to any student record in public.students, clean up student child tables first
    FOR v_st_id IN (SELECT id FROM public.students WHERE profile_id = v_rec.id) LOOP
      -- Clean issue updates on this student's issues
      DELETE FROM public.issue_updates WHERE issue_id IN (SELECT id FROM public.issues WHERE student_id = v_st_id);
      
      -- Clean issues
      DELETE FROM public.issues WHERE student_id = v_st_id;
      
      -- Clean gate passes
      DELETE FROM public.gate_passes WHERE student_id = v_st_id;
      
      -- Clean room allocations
      DELETE FROM public.room_allocations WHERE student_id = v_st_id;
      
      -- Clean optional dining/mess records
      BEGIN DELETE FROM public.dining_qr_tokens WHERE student_id = v_st_id; EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN DELETE FROM public.mess_attendance WHERE student_id = v_st_id; EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN DELETE FROM public.visitor_logs WHERE student_id = v_st_id; EXCEPTION WHEN OTHERS THEN NULL; END;

      -- Delete student row
      DELETE FROM public.students WHERE id = v_st_id;
    END LOOP;

    -- 2. Clean up any other references where this user acted as updater/admin/creator
    BEGIN DELETE FROM public.issue_updates WHERE updated_by = v_rec.id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.gate_passes WHERE approved_by = v_rec.id OR action_by = v_rec.id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.issues WHERE resolved_by = v_rec.id OR assigned_to = v_rec.id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.room_allocations WHERE allocated_by = v_rec.id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.announcements WHERE created_by = v_rec.id OR author_id = v_rec.id; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 3. Delete from public.profiles
    DELETE FROM public.profiles WHERE id = v_rec.id OR LOWER(email) = 'student@amc.edu';

    -- 4. Delete from auth schema child tables
    BEGIN DELETE FROM auth.mfa_amr_claims WHERE session_id IN (SELECT id FROM auth.sessions WHERE user_id = v_rec.id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM auth.mfa_challenges WHERE factor_id IN (SELECT id FROM auth.mfa_factors WHERE user_id = v_rec.id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM auth.mfa_factors WHERE user_id = v_rec.id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM auth.sessions WHERE user_id = v_rec.id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM auth.identities WHERE user_id = v_rec.id; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 5. Finally delete the auth user
    DELETE FROM auth.users WHERE id = v_rec.id;

    RAISE NOTICE 'Successfully and permanently deleted: %', v_rec.email;
  END LOOP;
END $$;

-- Verify it is completely gone from both auth.users and profiles
SELECT 'Remaining in auth.users:' as check_type, COUNT(*) as count 
FROM auth.users 
WHERE LOWER(email) = 'student@amc.edu'
UNION ALL
SELECT 'Remaining in profiles:' as check_type, COUNT(*) as count 
FROM public.profiles 
WHERE LOWER(email) = 'student@amc.edu';
