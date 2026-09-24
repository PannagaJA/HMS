-- =============================================================================
-- HMS PASSWORD RESET SCRIPT: UNIFY ALL PASSWORDS TO 'password123'
-- Run this in your Supabase SQL Editor (gnmbmwplrjwkslvtcghr)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Update all existing accounts in auth.users to use 'password123'
UPDATE auth.users
SET 
  encrypted_password = crypt('password123', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW();

-- 2. Create or Replace Cloud Password Change RPC (For live profile password changes)
CREATE OR REPLACE FUNCTION public.change_user_password(
  p_identifier TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_password_hash TEXT;
BEGIN
  IF p_new_password IS NULL OR LENGTH(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long';
  END IF;

  -- Find user in auth.users by email
  SELECT u.id INTO v_user_id
  FROM auth.users u
  WHERE LOWER(u.email) = LOWER(TRIM(p_identifier))
  LIMIT 1;

  -- Or find in students table by enrollment_no / USN or email
  IF v_user_id IS NULL THEN
    SELECT s.profile_id INTO v_user_id
    FROM public.students s
    WHERE (LOWER(s.enrollment_no) = LOWER(TRIM(p_identifier)))
       OR (LOWER(s.email) = LOWER(TRIM(p_identifier)))
       OR (s.profile_id::TEXT = p_identifier)
       OR (p_identifier LIKE '%@%' AND LOWER(s.enrollment_no) = LOWER(SPLIT_PART(p_identifier, '@', 1)))
    LIMIT 1;
  END IF;

  -- Or find in profiles table
  IF v_user_id IS NULL THEN
    SELECT p.id INTO v_user_id
    FROM public.profiles p
    WHERE (LOWER(p.email) = LOWER(TRIM(p_identifier)))
       OR (p.id::TEXT = p_identifier)
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found for identifier: %', p_identifier;
  END IF;

  -- Encrypt and update password in auth.users directly
  v_password_hash := crypt(p_new_password, gen_salt('bf'));

  UPDATE auth.users
  SET encrypted_password = v_password_hash,
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_user_password(TEXT, TEXT) TO anon, authenticated;

-- 3. Cloud Login Verification RPC (Strict password validation across all environments)
CREATE OR REPLACE FUNCTION public.verify_user_login(
  p_identifier TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_profile RECORD;
  v_student RECORD;
  v_is_valid BOOLEAN := FALSE;
BEGIN
  IF p_identifier IS NULL OR p_password IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'MISSING_CREDENTIALS');
  END IF;

  -- 1. Find user in auth.users by email
  SELECT * INTO v_user
  FROM auth.users
  WHERE LOWER(email) = LOWER(TRIM(p_identifier))
  LIMIT 1;

  -- Or find in students table by enrollment_no / USN or email
  IF v_user IS NULL THEN
    SELECT u.* INTO v_user
    FROM auth.users u
    JOIN public.students s ON s.profile_id = u.id
    WHERE (LOWER(s.enrollment_no) = LOWER(TRIM(p_identifier)))
       OR (LOWER(s.email) = LOWER(TRIM(p_identifier)))
       OR (p_identifier LIKE '%@%' AND LOWER(s.enrollment_no) = LOWER(SPLIT_PART(p_identifier, '@', 1)))
    LIMIT 1;
  END IF;

  -- Or find via profiles table
  IF v_user IS NULL THEN
    SELECT u.* INTO v_user
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE (LOWER(p.email) = LOWER(TRIM(p_identifier)))
    LIMIT 1;
  END IF;

  -- If user exists in auth.users, verify their password
  IF v_user IS NOT NULL THEN
    IF v_user.encrypted_password = crypt(p_password, v_user.encrypted_password) THEN
      v_is_valid := TRUE;
    END IF;

    -- If password failed against auth.users, strictly reject without fallback
    IF NOT v_is_valid THEN
      RETURN jsonb_build_object('success', false, 'reason', 'INVALID_PASSWORD');
    END IF;

    -- Return full profile
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user.id LIMIT 1;
    SELECT * INTO v_student FROM public.students WHERE profile_id = v_user.id OR LOWER(email) = LOWER(v_user.email) LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_user.id,
      'email', v_user.email,
      'role', COALESCE(v_profile.role, 'STUDENT'),
      'first_name', COALESCE(v_student.student_name, v_profile.first_name, ''),
      'phone', COALESCE(v_student.phone, v_profile.phone, ''),
      'enrollment_no', v_student.enrollment_no,
      'org_id', COALESCE(v_profile.org_id, v_student.org_id)
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'reason', 'USER_NOT_FOUND_IN_AUTH');
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_user_login(TEXT, TEXT) TO anon, authenticated;

-- 4. Confirm updated users
SELECT id, email, role, created_at, updated_at 
FROM auth.users 
ORDER BY created_at DESC;
