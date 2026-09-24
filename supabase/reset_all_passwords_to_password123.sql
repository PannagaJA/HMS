-- =============================================================================
-- HMS PASSWORD RESET SCRIPT: UNIFY ALL PASSWORDS TO 'password123'
-- + COMPLETE CLOUD AUTH PROVISIONING FOR ALL STUDENTS & STAFF
-- Run this in your Supabase SQL Editor (gnmbmwplrjwkslvtcghr)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Reset all existing accounts in auth.users to use 'password123'
UPDATE auth.users
SET 
  encrypted_password = crypt('password123', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW();

-- 2. Auto-provision all students in public.students into auth.users and profiles
DO $$
DECLARE
  st RECORD;
  v_uid UUID;
  v_std_email TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_pwd_hash TEXT := crypt('password123', gen_salt('bf'));
BEGIN
  FOR st IN SELECT * FROM public.students LOOP
    -- Standardize email for student
    IF st.email IS NOT NULL AND TRIM(st.email) != '' THEN
      v_std_email := LOWER(TRIM(st.email));
    ELSE
      v_std_email := LOWER(REGEXP_REPLACE(st.enrollment_no, '[^a-zA-Z0-9]', '', 'g')) || '@student.hms.edu';
    END IF;

    -- Check if auth.users already exists for this email or profile_id
    v_uid := NULL;
    SELECT id INTO v_uid FROM auth.users WHERE LOWER(email) = v_std_email LIMIT 1;
    
    IF v_uid IS NULL AND st.profile_id IS NOT NULL THEN
      SELECT id INTO v_uid FROM auth.users WHERE id = st.profile_id LIMIT 1;
    END IF;

    -- If no auth.users record exists, create one
    IF v_uid IS NULL THEN
      v_uid := gen_random_uuid();
      v_first_name := SPLIT_PART(st.student_name, ' ', 1);
      v_last_name := SUBSTRING(st.student_name FROM LENGTH(v_first_name) + 2);

      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_uid,
        'authenticated',
        'authenticated',
        v_std_email,
        v_pwd_hash,
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
          'first_name', v_first_name,
          'last_name', COALESCE(v_last_name, ''),
          'role', 'STUDENT',
          'enrollment_no', st.enrollment_no,
          'phone', COALESCE(st.phone, '')
        ),
        NOW(),
        NOW()
      );
    ELSE
      -- Ensure password is reset to password123
      UPDATE auth.users
      SET encrypted_password = v_pwd_hash,
          email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
          updated_at = NOW()
      WHERE id = v_uid;
    END IF;

    -- Upsert corresponding row in public.profiles
    INSERT INTO public.profiles (
      id, email, first_name, last_name, role, phone, org_id, is_active, created_at, updated_at
    ) VALUES (
      v_uid,
      v_std_email,
      SPLIT_PART(st.student_name, ' ', 1),
      COALESCE(SUBSTRING(st.student_name FROM LENGTH(SPLIT_PART(st.student_name, ' ', 1)) + 2), ''),
      'STUDENT',
      COALESCE(st.phone, ''),
      st.org_id,
      TRUE,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      role = 'STUDENT',
      org_id = COALESCE(public.profiles.org_id, EXCLUDED.org_id),
      updated_at = NOW();

    -- Link student.profile_id to auth.users id
    UPDATE public.students
    SET profile_id = v_uid,
        email = COALESCE(public.students.email, v_std_email)
    WHERE id = st.id;
  END LOOP;
END $$;

-- 3. Create or Replace Cloud Password Change RPC (Universal for Students & Staff)
CREATE OR REPLACE FUNCTION public.change_user_password(
  p_identifier TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_password_hash TEXT;
  v_student RECORD;
  v_profile RECORD;
  v_email TEXT;
BEGIN
  IF p_new_password IS NULL OR LENGTH(p_new_password) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Password must be at least 6 characters long');
  END IF;

  -- 1. Check auth.users by email
  SELECT u.id, u.email INTO v_user_id, v_email
  FROM auth.users u
  WHERE LOWER(u.email) = LOWER(TRIM(p_identifier))
  LIMIT 1;

  -- 2. Check students table by enrollment_no, email, profile_id, or USN prefix
  IF v_user_id IS NULL THEN
    SELECT * INTO v_student
    FROM public.students s
    WHERE (LOWER(s.enrollment_no) = LOWER(TRIM(p_identifier)))
       OR (LOWER(s.email) = LOWER(TRIM(p_identifier)))
       OR (s.profile_id::TEXT = p_identifier)
       OR (p_identifier LIKE '%@%' AND LOWER(s.enrollment_no) = LOWER(SPLIT_PART(p_identifier, '@', 1)))
    LIMIT 1;

    IF v_student IS NOT NULL THEN
      -- If student already has a valid profile_id in auth.users
      IF v_student.profile_id IS NOT NULL THEN
        SELECT u.id, u.email INTO v_user_id, v_email
        FROM auth.users u
        WHERE u.id = v_student.profile_id
        LIMIT 1;
      END IF;

      -- If no auth.users record exists yet, create one now!
      IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        v_email := COALESCE(LOWER(TRIM(v_student.email)), LOWER(REGEXP_REPLACE(v_student.enrollment_no, '[^a-zA-Z0-9]', '', 'g')) || '@student.hms.edu');
        v_password_hash := crypt(p_new_password, gen_salt('bf'));

        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          v_user_id,
          'authenticated',
          'authenticated',
          v_email,
          v_password_hash,
          NOW(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object(
            'first_name', SPLIT_PART(v_student.student_name, ' ', 1),
            'role', 'STUDENT',
            'enrollment_no', v_student.enrollment_no
          ),
          NOW(),
          NOW()
        );

        -- Upsert profile
        INSERT INTO public.profiles (id, email, first_name, role, org_id, is_active)
        VALUES (v_user_id, v_email, v_student.student_name, 'STUDENT', v_student.org_id, TRUE)
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'STUDENT';

        -- Link student
        UPDATE public.students
        SET profile_id = v_user_id, email = COALESCE(public.students.email, v_email)
        WHERE id = v_student.id;

        RETURN jsonb_build_object('success', true, 'message', 'Password changed successfully!');
      END IF;
    END IF;
  END IF;

  -- 3. Check profiles table
  IF v_user_id IS NULL THEN
    SELECT p.id, p.email INTO v_user_id, v_email
    FROM public.profiles p
    WHERE (LOWER(p.email) = LOWER(TRIM(p_identifier)))
       OR (p.id::TEXT = p_identifier)
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found in system for identifier: ' || p_identifier);
  END IF;

  -- Encrypt and update password in auth.users directly
  v_password_hash := crypt(p_new_password, gen_salt('bf'));

  UPDATE auth.users
  SET encrypted_password = v_password_hash,
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Password changed successfully!');
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_user_password(TEXT, TEXT) TO anon, authenticated;

-- 4. Cloud Login Verification RPC (Strict password validation across all environments)
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

  -- Or find via direct student query without join
  IF v_user IS NULL THEN
    SELECT * INTO v_student
    FROM public.students
    WHERE (LOWER(enrollment_no) = LOWER(TRIM(p_identifier)))
       OR (LOWER(email) = LOWER(TRIM(p_identifier)))
       OR (p_identifier LIKE '%@%' AND LOWER(enrollment_no) = LOWER(SPLIT_PART(p_identifier, '@', 1)))
    LIMIT 1;

    IF v_student IS NOT NULL AND v_student.profile_id IS NOT NULL THEN
      SELECT * INTO v_user FROM auth.users WHERE id = v_student.profile_id LIMIT 1;
    END IF;
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

-- 5. Confirmation Query
SELECT id, email, role, created_at, updated_at 
FROM auth.users 
ORDER BY created_at DESC;
