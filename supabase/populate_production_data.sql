-- =============================================================================
-- HMS PRODUCTION SEED & DATA POPULATION SCRIPT
-- =============================================================================

DO $$
DECLARE
  v_admin_id UUID;
  v_warden_id UUID;
  v_security_id UUID;
  v_student_id UUID;
  v_org_id UUID := '00000000-0000-0000-0000-000000000001';

  -- Courses
  v_c_btech BIGINT;
  v_c_mtech BIGINT;
  v_c_mca BIGINT;
  v_c_mba BIGINT;

  -- Hostels
  v_hostel_a BIGINT;
  v_hostel_b BIGINT;

  -- Rooms (Hostel A)
  v_rm_a101 BIGINT;
  v_rm_a102 BIGINT;
  v_rm_a103 BIGINT;
  v_rm_a201 BIGINT;
  v_rm_a202 BIGINT;
  v_rm_a301 BIGINT;

  -- Rooms (Hostel B)
  v_rm_b101 BIGINT;
  v_rm_b102 BIGINT;
  v_rm_b201 BIGINT;
  v_rm_b202 BIGINT;

  -- Students
  v_stu_1 BIGINT;
  v_stu_2 BIGINT;
  v_stu_3 BIGINT;
  v_stu_4 BIGINT;
  v_stu_5 BIGINT;
  v_stu_6 BIGINT;
  v_stu_7 BIGINT;
  v_stu_8 BIGINT;

  -- Mess Items
  v_m_br BIGINT;
  v_m_ln BIGINT;
  v_m_sn BIGINT;
  v_m_dn BIGINT;
  v_it_dosa BIGINT;
  v_it_idli BIGINT;
  v_it_thali BIGINT;
  v_it_chai BIGINT;
  v_it_paneer BIGINT;
  v_menu_id BIGINT;
  i INTEGER;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 0. RESOLVE AUTH PROFILES
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@amc.edu';
  SELECT id INTO v_warden_id FROM auth.users WHERE email = 'warden@amc.edu';
  SELECT id INTO v_security_id FROM auth.users WHERE email = 'security@amc.edu';
  SELECT id INTO v_student_id FROM auth.users WHERE email = 'student@amc.edu';

  -- Ensure Profiles table is in sync with Roles and Org
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role, first_name, last_name, phone, org_id)
    VALUES (v_admin_id, 'admin@amc.edu', 'ADMIN', 'Super', 'Administrator', '+91 9876500000', v_org_id)
    ON CONFLICT (id) DO UPDATE SET role = 'ADMIN', org_id = v_org_id;
  END IF;

  IF v_warden_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role, first_name, last_name, phone, org_id)
    VALUES (v_warden_id, 'warden@amc.edu', 'WARDEN', 'Dr. Robert', 'Mukherjee', '+91 9811223344', v_org_id)
    ON CONFLICT (id) DO UPDATE SET role = 'WARDEN', org_id = v_org_id;
  END IF;

  IF v_security_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role, first_name, last_name, phone, org_id)
    VALUES (v_security_id, 'security@amc.edu', 'SECURITY', 'Rajesh', 'Singh', '+91 9899001122', v_org_id)
    ON CONFLICT (id) DO UPDATE SET role = 'SECURITY', org_id = v_org_id;
  END IF;

  IF v_student_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role, first_name, last_name, phone, org_id)
    VALUES (v_student_id, 'student@amc.edu', 'STUDENT', 'Rahul', 'Sharma', '+91 9844556677', v_org_id)
    ON CONFLICT (id) DO UPDATE SET role = 'STUDENT', org_id = v_org_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 1. ACADEMIC COURSES
  -- ---------------------------------------------------------------------------
  INSERT INTO public.hostel_courses (code, name, room_type, org_id)
  VALUES ('BTECH_CSE', 'B.Tech in Computer Science & Engineering', 'D', v_org_id)
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_c_btech;

  INSERT INTO public.hostel_courses (code, name, room_type, org_id)
  VALUES ('MTECH_AI', 'M.Tech in Artificial Intelligence', 'S', v_org_id)
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_c_mtech;

  INSERT INTO public.hostel_courses (code, name, room_type, org_id)
  VALUES ('MCA', 'Master of Computer Applications', 'D', v_org_id)
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_c_mca;

  INSERT INTO public.hostel_courses (code, name, room_type, org_id)
  VALUES ('MBA', 'Master of Business Administration', 'S', v_org_id)
  ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_c_mba;

  -- ---------------------------------------------------------------------------
  -- 2. HOSTEL BLOCKS & WARDEN ASSIGNMENTS
  -- ---------------------------------------------------------------------------
  INSERT INTO public.hostels (name, gender, floor_count, address, is_active, org_id)
  VALUES ('Aryabhata Bhavan (Boys Hostel)', 'M', 3, 'North Campus, Technical Enclave, Gate 1', TRUE, v_org_id)
  ON CONFLICT (org_id, name) DO UPDATE SET is_active = TRUE RETURNING id INTO v_hostel_a;

  INSERT INTO public.hostels (name, gender, floor_count, address, is_active, org_id)
  VALUES ('Kalpana Chawla Bhavan (Girls Hostel)', 'F', 3, 'South Campus, Green Enclave, Gate 3', TRUE, v_org_id)
  ON CONFLICT (org_id, name) DO UPDATE SET is_active = TRUE RETURNING id INTO v_hostel_b;

  IF v_warden_id IS NOT NULL THEN
    INSERT INTO public.warden_hostel_assignments (warden_profile_id, hostel_id, org_id)
    VALUES (v_warden_id, v_hostel_a, v_org_id)
    ON CONFLICT (warden_profile_id, hostel_id) DO NOTHING;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. ROOMS & PHYSICAL BEDS
  -- ---------------------------------------------------------------------------
  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active, org_id)
  VALUES (v_hostel_a, '101', 1, 2, 'D', TRUE, v_org_id)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 2 RETURNING id INTO v_rm_a101;
  INSERT INTO public.beds (room_id, bed_number, org_id) VALUES (v_rm_a101, 1, v_org_id), (v_rm_a101, 2, v_org_id) ON CONFLICT DO NOTHING;

  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active, org_id)
  VALUES (v_hostel_a, '102', 1, 3, 'T', TRUE, v_org_id)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 3 RETURNING id INTO v_rm_a102;
  INSERT INTO public.beds (room_id, bed_number, org_id) VALUES (v_rm_a102, 1, v_org_id), (v_rm_a102, 2, v_org_id), (v_rm_a102, 3, v_org_id) ON CONFLICT DO NOTHING;

  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active, org_id)
  VALUES (v_hostel_a, '103', 1, 1, 'S', TRUE, v_org_id)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 1 RETURNING id INTO v_rm_a103;
  INSERT INTO public.beds (room_id, bed_number, org_id) VALUES (v_rm_a103, 1, v_org_id) ON CONFLICT DO NOTHING;

  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active, org_id)
  VALUES (v_hostel_a, '201', 2, 2, 'D', TRUE, v_org_id)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 2 RETURNING id INTO v_rm_a201;
  INSERT INTO public.beds (room_id, bed_number, org_id) VALUES (v_rm_a201, 1, v_org_id), (v_rm_a201, 2, v_org_id) ON CONFLICT DO NOTHING;

  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active, org_id)
  VALUES (v_hostel_a, '202', 2, 2, 'D', TRUE, v_org_id)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 2 RETURNING id INTO v_rm_a202;
  INSERT INTO public.beds (room_id, bed_number, org_id) VALUES (v_rm_a202, 1, v_org_id), (v_rm_a202, 2, v_org_id) ON CONFLICT DO NOTHING;

  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active, org_id)
  VALUES (v_hostel_a, '301', 3, 1, 'S', TRUE, v_org_id)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 1 RETURNING id INTO v_rm_a301;
  INSERT INTO public.beds (room_id, bed_number, org_id) VALUES (v_rm_a301, 1, v_org_id) ON CONFLICT DO NOTHING;

  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active, org_id)
  VALUES (v_hostel_b, '101', 1, 2, 'D', TRUE, v_org_id)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 2 RETURNING id INTO v_rm_b101;
  INSERT INTO public.beds (room_id, bed_number, org_id) VALUES (v_rm_b101, 1, v_org_id), (v_rm_b101, 2, v_org_id) ON CONFLICT DO NOTHING;

  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active, org_id)
  VALUES (v_hostel_b, '102', 1, 1, 'S', TRUE, v_org_id)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 1 RETURNING id INTO v_rm_b102;
  INSERT INTO public.beds (room_id, bed_number, org_id) VALUES (v_rm_b102, 1, v_org_id) ON CONFLICT DO NOTHING;

  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active, org_id)
  VALUES (v_hostel_b, '201', 2, 2, 'D', TRUE, v_org_id)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 2 RETURNING id INTO v_rm_b201;
  INSERT INTO public.beds (room_id, bed_number, org_id) VALUES (v_rm_b201, 1, v_org_id), (v_rm_b201, 2, v_org_id) ON CONFLICT DO NOTHING;

  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active, org_id)
  VALUES (v_hostel_b, '202', 2, 3, 'T', TRUE, v_org_id)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 3 RETURNING id INTO v_rm_b202;
  INSERT INTO public.beds (room_id, bed_number, org_id) VALUES (v_rm_b202, 1, v_org_id), (v_rm_b202, 2, v_org_id), (v_rm_b202, 3, v_org_id) ON CONFLICT DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 4. UNIFIED STUDENTS (Residents)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.students (
    profile_id, student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status, org_id
  ) VALUES (
    v_student_id, 'Rahul Sharma', 'AMC2026CS01', 'Suresh Sharma', v_c_btech,
    '2003-05-15', 'M', '+91 9844556677', '+91 9844550001', TRUE, 'ACTIVE', v_org_id
  )
  ON CONFLICT (org_id, enrollment_no) DO UPDATE SET profile_id = v_student_id RETURNING id INTO v_stu_1;

  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status, org_id
  ) VALUES (
    'Aarav Patel', 'AMC2026CS02', 'Mahesh Patel', v_c_btech,
    '2003-08-20', 'M', '+91 9876543213', '+91 9876540002', TRUE, 'ACTIVE', v_org_id
  )
  ON CONFLICT (org_id, enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_2;

  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status, org_id
  ) VALUES (
    'Rohan Gupta', 'AMC2026CS03', 'Anil Gupta', v_c_btech,
    '2003-12-11', 'M', '+91 9876543215', '+91 9876540005', TRUE, 'ACTIVE', v_org_id
  )
  ON CONFLICT (org_id, enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_3;

  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status, org_id
  ) VALUES (
    'Vikram Malhotra', 'AMC2026AI01', 'Sunil Malhotra', v_c_mtech,
    '2001-03-25', 'M', '+91 9876543214', '+91 9876540004', TRUE, 'ACTIVE', v_org_id
  )
  ON CONFLICT (org_id, enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_4;

  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status, org_id
  ) VALUES (
    'Priya Verma', 'AMC2026CS04', 'Rajesh Verma', v_c_btech,
    '2003-07-14', 'F', '+91 9876543211', '+91 9876540003', TRUE, 'ACTIVE', v_org_id
  )
  ON CONFLICT (org_id, enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_5;

  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status, org_id
  ) VALUES (
    'Ananya Iyer', 'AMC2026CS05', 'Venkat Iyer', v_c_btech,
    '2003-10-09', 'F', '+91 9876543216', '+91 9876540006', TRUE, 'ACTIVE', v_org_id
  )
  ON CONFLICT (org_id, enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_6;

  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status, org_id
  ) VALUES (
    'Sneha Reddy', 'AMC2026MCA01', 'Prasad Reddy', v_c_mca,
    '2002-04-18', 'F', '+91 9876543212', '+91 9876540001', TRUE, 'ACTIVE', v_org_id
  )
  ON CONFLICT (org_id, enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_7;

  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status, org_id
  ) VALUES (
    'Kavya Nair', 'AMC2026MBA01', 'Mohan Nair', v_c_mba,
    '2001-09-30', 'F', '+91 9876543217', '+91 9876540007', TRUE, 'ACTIVE', v_org_id
  )
  ON CONFLICT (org_id, enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_8;

  -- ---------------------------------------------------------------------------
  -- 5. STAFF DIRECTORY SEEDING
  -- ---------------------------------------------------------------------------
  INSERT INTO public.hostel_wardens (name, email, phone, designation, experience, org_id)
  VALUES 
    ('Dr. Robert Mukherjee', 'warden@amc.edu', '+91 9811223344', 'Chief Warden', 8, v_org_id),
    ('Dr. Meenakshi Sundaram', 'meenakshi.warden@amc.edu', '+91 9811225566', 'Associate Warden', 5, v_org_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.hostel_caretakers (name, email, phone, experience, org_id)
  VALUES 
    ('Suresh Sharma', 'suresh.caretaker@amc.edu', '+91 9822334455', 4, v_org_id),
    ('Ramesh Patel', 'ramesh.caretaker@amc.edu', '+91 9833445566', 6, v_org_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.security_staff (name, email, phone, designation, experience, org_id)
  VALUES 
    ('Rajesh Singh', 'security@amc.edu', '+91 9899001122', 'Head Security Guard', 7, v_org_id),
    ('Manohar Lal', 'manohar.guard@amc.edu', '+91 9899003344', 'Gate 1 Gatekeeper', 4, v_org_id)
  ON CONFLICT DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 6. ROOM ALLOCATIONS
  -- ---------------------------------------------------------------------------
  DELETE FROM public.room_allocations WHERE student_id IN (v_stu_1, v_stu_2, v_stu_3, v_stu_4, v_stu_5, v_stu_6, v_stu_7, v_stu_8);

  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active, org_id)
  SELECT v_stu_1, b.id, v_admin_id, TRUE, v_org_id FROM public.beds b WHERE b.room_id = v_rm_a101 AND b.bed_number = 1;

  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active, org_id)
  SELECT v_stu_2, b.id, v_admin_id, TRUE, v_org_id FROM public.beds b WHERE b.room_id = v_rm_a101 AND b.bed_number = 2;

  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active, org_id)
  SELECT v_stu_3, b.id, v_admin_id, TRUE, v_org_id FROM public.beds b WHERE b.room_id = v_rm_a102 AND b.bed_number = 1;

  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active, org_id)
  SELECT v_stu_4, b.id, v_admin_id, TRUE, v_org_id FROM public.beds b WHERE b.room_id = v_rm_a103 AND b.bed_number = 1;

  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active, org_id)
  SELECT v_stu_5, b.id, v_admin_id, TRUE, v_org_id FROM public.beds b WHERE b.room_id = v_rm_b101 AND b.bed_number = 1;

  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active, org_id)
  SELECT v_stu_6, b.id, v_admin_id, TRUE, v_org_id FROM public.beds b WHERE b.room_id = v_rm_b101 AND b.bed_number = 2;

  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active, org_id)
  SELECT v_stu_7, b.id, v_admin_id, TRUE, v_org_id FROM public.beds b WHERE b.room_id = v_rm_b102 AND b.bed_number = 1;

  -- ---------------------------------------------------------------------------
  -- 7. MAINTENANCE TICKETS (Issues)
  -- ---------------------------------------------------------------------------
  DELETE FROM public.issues WHERE student_id IN (v_stu_1, v_stu_2, v_stu_5);

  INSERT INTO public.issues (student_id, hostel_id, room_id, category, title, description, status, org_id)
  VALUES (
    v_stu_1, v_hostel_a, v_rm_a101, 'PLUMBING', 
    'Bathroom faucet leaking continuously', 
    'The washbasin tap in room 101 has a loose gasket and drips water continuously.', 
    'pending', v_org_id
  );

  INSERT INTO public.issues (student_id, hostel_id, room_id, category, title, description, status, org_id)
  VALUES (
    v_stu_2, v_hostel_a, v_rm_a101, 'ELECTRICAL', 
    'Ceiling fan making squeaking noise at high speed', 
    'Regulator works but fan bearing is creating a loud rhythmic squeak on speed 4 & 5.', 
    'in_progress', v_org_id
  );

  INSERT INTO public.issues (student_id, hostel_id, room_id, category, title, description, status, org_id)
  VALUES (
    v_stu_5, v_hostel_b, v_rm_b101, 'WIFI', 
    'Intermittent Wi-Fi signal in corner room', 
    'Wi-Fi signal drops frequently in the study desk area near the window.', 
    'waiting_for_workers', v_org_id
  );

  -- ---------------------------------------------------------------------------
  -- 8. GATE PASS REQUESTS
  -- ---------------------------------------------------------------------------
  DELETE FROM public.gate_passes WHERE student_id IN (v_stu_1, v_stu_2, v_stu_4);

  INSERT INTO public.gate_passes (
    student_id, hostel_id, room_id, pass_type, reason, 
    out_date, out_time, expected_return_date, expected_return_time, status, org_id
  ) VALUES (
    v_stu_1, v_hostel_a, v_rm_a101, 'DAY_OUT', 
    'Visiting City Central Library for academic project references', 
    CURRENT_DATE, '14:00:00', CURRENT_DATE, '20:30:00', 'pending', v_org_id
  );

  INSERT INTO public.gate_passes (
    student_id, hostel_id, room_id, pass_type, reason, 
    out_date, out_time, expected_return_date, expected_return_time, 
    status, approved_by, action_note, actioned_at, org_id
  ) VALUES (
    v_stu_2, v_hostel_a, v_rm_a101, 'DAY_OUT', 
    'Medical appointment & routine eye checkup at Apollo Clinic', 
    CURRENT_DATE, '15:30:00', CURRENT_DATE, '19:00:00', 
    'approved', v_warden_id, 'Approved. Return strictly before 7:00 PM.', NOW() - INTERVAL '2 hours', v_org_id
  );

  -- ---------------------------------------------------------------------------
  -- 9. MESS / DINING
  -- ---------------------------------------------------------------------------
  INSERT INTO public.meal_types (name, description, time_from, time_to, org_id)
  VALUES 
    ('BR', 'Morning Breakfast', '07:30:00', '09:30:00', v_org_id),
    ('LN', 'Afternoon Lunch', '12:30:00', '14:30:00', v_org_id),
    ('SN', 'Evening Snacks & Tea', '17:00:00', '18:30:00', v_org_id),
    ('DN', 'Dinner Banquet', '20:00:00', '22:00:00', v_org_id)
  ON CONFLICT (org_id, name) DO UPDATE SET description = EXCLUDED.description;

  SELECT id INTO v_m_br FROM public.meal_types WHERE org_id = v_org_id AND name = 'BR';
  SELECT id INTO v_m_ln FROM public.meal_types WHERE org_id = v_org_id AND name = 'LN';
  SELECT id INTO v_m_sn FROM public.meal_types WHERE org_id = v_org_id AND name = 'SN';
  SELECT id INTO v_m_dn FROM public.meal_types WHERE org_id = v_org_id AND name = 'DN';

  INSERT INTO public.menu_items (name, description, vegetarian, is_active, org_id)
  VALUES ('Masala Dosa & Sambar', 'Crispy fermented crepe with spiced potato filling & coconut chutney', TRUE, TRUE, v_org_id)
  RETURNING id INTO v_it_dosa;

  INSERT INTO public.menu_items (name, description, vegetarian, is_active, org_id)
  VALUES ('Steamed Idli & Vada', 'Soft rice cakes and savory lentil fritters', TRUE, TRUE, v_org_id)
  RETURNING id INTO v_it_idli;

  INSERT INTO public.menu_items (name, description, vegetarian, is_active, org_id)
  VALUES ('South Indian Thali', 'Steamed rice, sambar, rasam, kootu, curd & appalam', TRUE, TRUE, v_org_id)
  RETURNING id INTO v_it_thali;

  INSERT INTO public.menu_items (name, description, vegetarian, is_active, org_id)
  VALUES ('Masala Chai & Samosa', 'Spiced cardamom tea with hot crisp vegetable samosas', TRUE, TRUE, v_org_id)
  RETURNING id INTO v_it_chai;

  INSERT INTO public.menu_items (name, description, vegetarian, is_active, org_id)
  VALUES ('Paneer Butter Masala & Phulka', 'Cottage cheese in rich tomato gravy served with hot rotis', TRUE, TRUE, v_org_id)
  RETURNING id INTO v_it_paneer;

  FOR i IN 0..6 LOOP
    INSERT INTO public.menus (hostel_id, day_of_week, meal_type_id, is_recurring, org_id)
    VALUES (v_hostel_a, i::TEXT, v_m_br, TRUE, v_org_id)
    ON CONFLICT (hostel_id, day_of_week, meal_type_id) DO UPDATE SET is_recurring = TRUE
    RETURNING id INTO v_menu_id;
    INSERT INTO public.menu_item_links (menu_id, item_id, org_id) VALUES (v_menu_id, v_it_dosa, v_org_id) ON CONFLICT DO NOTHING;

    INSERT INTO public.menus (hostel_id, day_of_week, meal_type_id, is_recurring, org_id)
    VALUES (v_hostel_a, i::TEXT, v_m_ln, TRUE, v_org_id)
    ON CONFLICT (hostel_id, day_of_week, meal_type_id) DO UPDATE SET is_recurring = TRUE
    RETURNING id INTO v_menu_id;
    INSERT INTO public.menu_item_links (menu_id, item_id, org_id) VALUES (v_menu_id, v_it_thali, v_org_id) ON CONFLICT DO NOTHING;

    INSERT INTO public.menus (hostel_id, day_of_week, meal_type_id, is_recurring, org_id)
    VALUES (v_hostel_a, i::TEXT, v_m_sn, TRUE, v_org_id)
    ON CONFLICT (hostel_id, day_of_week, meal_type_id) DO UPDATE SET is_recurring = TRUE
    RETURNING id INTO v_menu_id;
    INSERT INTO public.menu_item_links (menu_id, item_id, org_id) VALUES (v_menu_id, v_it_chai, v_org_id) ON CONFLICT DO NOTHING;

    INSERT INTO public.menus (hostel_id, day_of_week, meal_type_id, is_recurring, org_id)
    VALUES (v_hostel_a, i::TEXT, v_m_dn, TRUE, v_org_id)
    ON CONFLICT (hostel_id, day_of_week, meal_type_id) DO UPDATE SET is_recurring = TRUE
    RETURNING id INTO v_menu_id;
    INSERT INTO public.menu_item_links (menu_id, item_id, org_id) VALUES (v_menu_id, v_it_paneer, v_org_id) ON CONFLICT DO NOTHING;
  END LOOP;

END $$;
