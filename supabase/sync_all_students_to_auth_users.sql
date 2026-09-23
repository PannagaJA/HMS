-- =============================================================================
-- HMS MIGRATION: FULL SUPABASE AUTH CLOUD BACKEND (auth.users) FOR ALL STUDENTS
-- Run this in your Supabase SQL Editor (gnmbmwplrjwkslvtcghr)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create or replace the automatic sync trigger function for students
CREATE OR REPLACE FUNCTION public.sync_student_to_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_password_hash TEXT;
  v_org_id UUID;
BEGIN
  -- Standardize email
  IF NEW.email IS NOT NULL AND TRIM(NEW.email) != '' THEN
    v_email := LOWER(TRIM(NEW.email));
  ELSE
    v_email := LOWER(REGEXP_REPLACE(NEW.enrollment_no, '[^a-zA-Z0-9]', '', 'g')) || '@student.hms.edu';
    NEW.email := v_email;
  END IF;

  v_org_id := COALESCE(NEW.org_id, '00000000-0000-0000-0000-000000000001'::uuid);
  v_first_name := SPLIT_PART(NEW.student_name, ' ', 1);
  v_last_name := SUBSTRING(NEW.student_name FROM LENGTH(v_first_name) + 2);

  -- Check if auth.users already exists for this email
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = v_email LIMIT 1;

  -- Create auth user if not exists with default password: password123
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_password_hash := crypt('password123', gen_salt('bf'));

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
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
        'first_name', v_first_name,
        'last_name', COALESCE(v_last_name, ''),
        'role', 'STUDENT',
        'enrollment_no', NEW.enrollment_no,
        'phone', COALESCE(NEW.phone, '')
      ),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_email,
      NOW(),
      NOW(),
      NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Upsert into public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    role,
    first_name,
    last_name,
    phone,
    is_active,
    org_id,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_email,
    'STUDENT',
    v_first_name,
    COALESCE(v_last_name, ''),
    COALESCE(NEW.phone, ''),
    TRUE,
    v_org_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    updated_at = NOW();

  -- Set foreign key link
  NEW.profile_id := v_user_id;

  RETURN NEW;
END;
$$;

-- 2. Attach trigger to public.students table on INSERT or UPDATE
DROP TRIGGER IF EXISTS trg_sync_student_to_auth ON public.students;
CREATE TRIGGER trg_sync_student_to_auth
BEFORE INSERT OR UPDATE OF email, student_name, phone
ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_to_auth_user();

-- 3. One-time Migration: Provision auth.users & profiles for ALL existing students
DO $$
DECLARE
  r RECORD;
  v_user_id UUID;
  v_email TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_password_hash TEXT;
  v_org_id UUID;
BEGIN
  FOR r IN SELECT * FROM public.students LOOP
    IF r.email IS NOT NULL AND TRIM(r.email) != '' THEN
      v_email := LOWER(TRIM(r.email));
    ELSE
      v_email := LOWER(REGEXP_REPLACE(r.enrollment_no, '[^a-zA-Z0-9]', '', 'g')) || '@student.hms.edu';
      UPDATE public.students SET email = v_email WHERE id = r.id;
    END IF;

    v_org_id := COALESCE(r.org_id, '00000000-0000-0000-0000-000000000001'::uuid);
    v_first_name := SPLIT_PART(r.student_name, ' ', 1);
    v_last_name := SUBSTRING(r.student_name FROM LENGTH(v_first_name) + 2);

    -- Check if user exists in auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = v_email LIMIT 1;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      v_password_hash := crypt('password123', gen_salt('bf'));

      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
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
          'first_name', v_first_name,
          'last_name', COALESCE(v_last_name, ''),
          'role', 'STUDENT',
          'enrollment_no', r.enrollment_no,
          'phone', COALESCE(r.phone, '')
        ),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
      );

      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        v_email,
        NOW(),
        NOW(),
        NOW()
      ) ON CONFLICT DO NOTHING;
    END IF;

    -- Upsert profile
    INSERT INTO public.profiles (
      id,
      email,
      role,
      first_name,
      last_name,
      phone,
      is_active,
      org_id,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_email,
      'STUDENT',
      v_first_name,
      COALESCE(v_last_name, ''),
      COALESCE(r.phone, ''),
      TRUE,
      v_org_id,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      phone = EXCLUDED.phone,
      updated_at = NOW();

    -- Update student row profile_id
    UPDATE public.students SET profile_id = v_user_id WHERE id = r.id;
  END LOOP;
END;
$$;

-- 4. Cloud Password Management RPC: Update auth.users password across all devices
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

-- 5. Cloud Login Verification RPC: Verify encrypted password in auth.users directly
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
    RETURN NULL;
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

  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Verify encrypted password using crypt
  IF v_user.encrypted_password = crypt(p_password, v_user.encrypted_password) THEN
    v_is_valid := TRUE;
  END IF;

  IF NOT v_is_valid THEN
    RETURN NULL;
  END IF;

  -- 3. Return profile & student metadata
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user.id LIMIT 1;
  SELECT * INTO v_student FROM public.students WHERE profile_id = v_user.id OR LOWER(email) = LOWER(v_user.email) LIMIT 1;

  RETURN jsonb_build_object(
    'user_id', v_user.id,
    'email', v_user.email,
    'role', COALESCE(v_profile.role, 'STUDENT'),
    'first_name', COALESCE(v_student.student_name, v_profile.first_name, ''),
    'phone', COALESCE(v_student.phone, v_profile.phone, ''),
    'enrollment_no', v_student.enrollment_no,
    'org_id', COALESCE(v_profile.org_id, v_student.org_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_user_login(TEXT, TEXT) TO anon, authenticated;


