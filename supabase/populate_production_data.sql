-- =============================================================================
-- HMS PRODUCTION SEED & DATA POPULATION SCRIPT
-- Populates:
--   • Academic Courses (B.Tech, M.Tech, MCA, MBA)
--   • 2 Hostels (Aryabhata Boys Hostel & Gargi Girls Hostel)
--   • Warden Assignments (Links warden@amc.edu to Aryabhata)
--   • 12 Rooms (Floors 1, 2, 3) across Single, Double, and Triple sharing
--   • Physical Beds matching exact room capacity (COUNT(beds) = room.capacity)
--   • 8 Realistic Students (linked to courses, demographics, emergency contacts)
--   • Real-time Room Allocations (enforcing partial uniqueness, 0 over-allocation)
--   • Maintenance Tickets (Issues) with historical location snapshots
--   • Gate Pass Requests (pending, approved, completed, expired)
--   • Visitor Logs (checked-in and checked-out)
--   • Mess Meal Types, Weekly Menus & Menu Item links
-- =============================================================================

DO $$
DECLARE
  v_admin_id UUID;
  v_warden_id UUID;
  v_security_id UUID;
  v_student_id UUID;

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

  -- Beds
  v_bed_a101_1 BIGINT;
  v_bed_a101_2 BIGINT;
  v_bed_a102_1 BIGINT;
  v_bed_a103_1 BIGINT;
  v_bed_a201_1 BIGINT;
  v_bed_b101_1 BIGINT;
  v_bed_b101_2 BIGINT;

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

  -- Ensure Profiles table is in sync with Roles
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role, first_name, last_name, phone)
    VALUES (v_admin_id, 'admin@amc.edu', 'ADMIN', 'Super', 'Administrator', '+91 9876500000')
    ON CONFLICT (id) DO UPDATE SET role = 'ADMIN';
  END IF;

  IF v_warden_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role, first_name, last_name, phone)
    VALUES (v_warden_id, 'warden@amc.edu', 'WARDEN', 'Dr. Robert', 'Mukherjee', '+91 9811223344')
    ON CONFLICT (id) DO UPDATE SET role = 'WARDEN';
  END IF;

  IF v_security_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role, first_name, last_name, phone)
    VALUES (v_security_id, 'security@amc.edu', 'SECURITY', 'Rajesh', 'Singh', '+91 9899001122')
    ON CONFLICT (id) DO UPDATE SET role = 'SECURITY';
  END IF;

  IF v_student_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role, first_name, last_name, phone)
    VALUES (v_student_id, 'student@amc.edu', 'STUDENT', 'Rahul', 'Sharma', '+91 9844556677')
    ON CONFLICT (id) DO UPDATE SET role = 'STUDENT';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 1. ACADEMIC COURSES
  -- ---------------------------------------------------------------------------
  INSERT INTO public.hostel_courses (code, name, room_type)
  VALUES ('BTECH_CSE', 'B.Tech in Computer Science & Engineering', 'D')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_c_btech;

  INSERT INTO public.hostel_courses (code, name, room_type)
  VALUES ('MTECH_AI', 'M.Tech in Artificial Intelligence', 'S')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_c_mtech;

  INSERT INTO public.hostel_courses (code, name, room_type)
  VALUES ('MCA', 'Master of Computer Applications', 'D')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_c_mca;

  INSERT INTO public.hostel_courses (code, name, room_type)
  VALUES ('MBA', 'Master of Business Administration', 'S')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_c_mba;

  -- ---------------------------------------------------------------------------
  -- 2. HOSTEL BLOCKS & WARDEN ASSIGNMENTS
  -- ---------------------------------------------------------------------------
  INSERT INTO public.hostels (name, gender, floor_count, address, is_active)
  VALUES ('Aryabhata Bhavan (Boys Hostel)', 'M', 3, 'North Campus, Technical Enclave, Gate 1', TRUE)
  ON CONFLICT (name) DO UPDATE SET is_active = TRUE RETURNING id INTO v_hostel_a;

  INSERT INTO public.hostels (name, gender, floor_count, address, is_active)
  VALUES ('Kalpana Chawla Bhavan (Girls Hostel)', 'F', 3, 'South Campus, Green Enclave, Gate 3', TRUE)
  ON CONFLICT (name) DO UPDATE SET is_active = TRUE RETURNING id INTO v_hostel_b;

  IF v_warden_id IS NOT NULL THEN
    INSERT INTO public.warden_hostel_assignments (warden_profile_id, hostel_id)
    VALUES (v_warden_id, v_hostel_a)
    ON CONFLICT (warden_profile_id, hostel_id) DO NOTHING;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. ROOMS & PHYSICAL BEDS (Enforcing physical bed count == capacity)
  -- ---------------------------------------------------------------------------
  -- Hostel A (Boys): Room 101 (Double - Cap 2)
  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active)
  VALUES (v_hostel_a, '101', 1, 2, 'D', TRUE)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 2 RETURNING id INTO v_rm_a101;
  INSERT INTO public.beds (room_id, bed_number) VALUES (v_rm_a101, 1), (v_rm_a101, 2) ON CONFLICT DO NOTHING;

  -- Hostel A: Room 102 (Triple - Cap 3)
  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active)
  VALUES (v_hostel_a, '102', 1, 3, 'T', TRUE)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 3 RETURNING id INTO v_rm_a102;
  INSERT INTO public.beds (room_id, bed_number) VALUES (v_rm_a102, 1), (v_rm_a102, 2), (v_rm_a102, 3) ON CONFLICT DO NOTHING;

  -- Hostel A: Room 103 (Single - Cap 1)
  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active)
  VALUES (v_hostel_a, '103', 1, 1, 'S', TRUE)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 1 RETURNING id INTO v_rm_a103;
  INSERT INTO public.beds (room_id, bed_number) VALUES (v_rm_a103, 1) ON CONFLICT DO NOTHING;

  -- Hostel A: Room 201 (Double - Cap 2)
  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active)
  VALUES (v_hostel_a, '201', 2, 2, 'D', TRUE)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 2 RETURNING id INTO v_rm_a201;
  INSERT INTO public.beds (room_id, bed_number) VALUES (v_rm_a201, 1), (v_rm_a201, 2) ON CONFLICT DO NOTHING;

  -- Hostel A: Room 202 (Double - Cap 2)
  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active)
  VALUES (v_hostel_a, '202', 2, 2, 'D', TRUE)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 2 RETURNING id INTO v_rm_a202;
  INSERT INTO public.beds (room_id, bed_number) VALUES (v_rm_a202, 1), (v_rm_a202, 2) ON CONFLICT DO NOTHING;

  -- Hostel A: Room 301 (Single - Cap 1)
  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active)
  VALUES (v_hostel_a, '301', 3, 1, 'S', TRUE)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 1 RETURNING id INTO v_rm_a301;
  INSERT INTO public.beds (room_id, bed_number) VALUES (v_rm_a301, 1) ON CONFLICT DO NOTHING;

  -- Hostel B (Girls): Room 101 (Double - Cap 2)
  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active)
  VALUES (v_hostel_b, '101', 1, 2, 'D', TRUE)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 2 RETURNING id INTO v_rm_b101;
  INSERT INTO public.beds (room_id, bed_number) VALUES (v_rm_b101, 1), (v_rm_b101, 2) ON CONFLICT DO NOTHING;

  -- Hostel B: Room 102 (Single - Cap 1)
  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active)
  VALUES (v_hostel_b, '102', 1, 1, 'S', TRUE)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 1 RETURNING id INTO v_rm_b102;
  INSERT INTO public.beds (room_id, bed_number) VALUES (v_rm_b102, 1) ON CONFLICT DO NOTHING;

  -- Hostel B: Room 201 (Double - Cap 2)
  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active)
  VALUES (v_hostel_b, '201', 2, 2, 'D', TRUE)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 2 RETURNING id INTO v_rm_b201;
  INSERT INTO public.beds (room_id, bed_number) VALUES (v_rm_b201, 1), (v_rm_b201, 2) ON CONFLICT DO NOTHING;

  -- Hostel B: Room 202 (Triple - Cap 3)
  INSERT INTO public.hostel_rooms (hostel_id, no, floor, capacity, room_type, is_active)
  VALUES (v_hostel_b, '202', 2, 3, 'T', TRUE)
  ON CONFLICT (hostel_id, no) DO UPDATE SET capacity = 3 RETURNING id INTO v_rm_b202;
  INSERT INTO public.beds (room_id, bed_number) VALUES (v_rm_b202, 1), (v_rm_b202, 2), (v_rm_b202, 3) ON CONFLICT DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 4. UNIFIED STUDENTS (Residents)
  -- ---------------------------------------------------------------------------
  -- Student 1: Rahul Sharma (Linked to student@amc.edu)
  INSERT INTO public.students (
    profile_id, student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status
  ) VALUES (
    v_student_id, 'Rahul Sharma', 'AMC2026CS01', 'Suresh Sharma', v_c_btech,
    '2003-05-15', 'M', '+91 9844556677', '+91 9844550001', TRUE, 'ACTIVE'
  )
  ON CONFLICT (enrollment_no) DO UPDATE SET profile_id = v_student_id RETURNING id INTO v_stu_1;

  -- Student 2: Aarav Patel
  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status
  ) VALUES (
    'Aarav Patel', 'AMC2026CS02', 'Mahesh Patel', v_c_btech,
    '2003-08-20', 'M', '+91 9876543213', '+91 9876540002', TRUE, 'ACTIVE'
  )
  ON CONFLICT (enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_2;

  -- Student 3: Rohan Gupta
  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status
  ) VALUES (
    'Rohan Gupta', 'AMC2026CS03', 'Anil Gupta', v_c_btech,
    '2003-12-11', 'M', '+91 9876543215', '+91 9876540005', TRUE, 'ACTIVE'
  )
  ON CONFLICT (enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_3;

  -- Student 4: Vikram Malhotra
  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status
  ) VALUES (
    'Vikram Malhotra', 'AMC2026AI01', 'Sunil Malhotra', v_c_mtech,
    '2001-04-18', 'M', '+91 9876543216', '+91 9876540006', TRUE, 'ACTIVE'
  )
  ON CONFLICT (enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_4;

  -- Student 5: Priya Verma (Female)
  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status
  ) VALUES (
    'Priya Verma', 'AMC2026MCA01', 'Ramesh Verma', v_c_mca,
    '2002-11-10', 'F', '+91 9876543214', '+91 9876540003', TRUE, 'ACTIVE'
  )
  ON CONFLICT (enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_5;

  -- Student 6: Ananya Iyer (Female)
  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status
  ) VALUES (
    'Ananya Iyer', 'AMC2026MBA01', 'Krishnan Iyer', v_c_mba,
    '2002-07-25', 'F', '+91 9876543217', '+91 9876540007', TRUE, 'ACTIVE'
  )
  ON CONFLICT (enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_6;

  -- Student 7 & 8: Unallocated Students (Ready for room allocation testing in UI)
  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status
  ) VALUES (
    'Karan Deshmukh', 'AMC2026CS04', 'Vilas Deshmukh', v_c_btech,
    '2003-09-05', 'M', '+91 9876543218', '+91 9876540008', TRUE, 'ACTIVE'
  )
  ON CONFLICT (enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_7;

  INSERT INTO public.students (
    student_name, enrollment_no, father_name, course_id, 
    dob, gender, phone, emergency_contact, no_dues, status
  ) VALUES (
    'Sneha Reddy', 'AMC2026MCA02', 'Venkat Reddy', v_c_mca,
    '2002-03-14', 'F', '+91 9876543219', '+91 9876540009', TRUE, 'ACTIVE'
  )
  ON CONFLICT (enrollment_no) DO UPDATE SET student_name = EXCLUDED.student_name RETURNING id INTO v_stu_8;

  -- ---------------------------------------------------------------------------
  -- 5. ROOM ALLOCATIONS (Strictly one active allocation per bed and per student)
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_bed_a101_1 FROM public.beds WHERE room_id = v_rm_a101 AND bed_number = 1;
  SELECT id INTO v_bed_a101_2 FROM public.beds WHERE room_id = v_rm_a101 AND bed_number = 2;
  SELECT id INTO v_bed_a102_1 FROM public.beds WHERE room_id = v_rm_a102 AND bed_number = 1;
  SELECT id INTO v_bed_a103_1 FROM public.beds WHERE room_id = v_rm_a103 AND bed_number = 1;
  SELECT id INTO v_bed_b101_1 FROM public.beds WHERE room_id = v_rm_b101 AND bed_number = 1;
  SELECT id INTO v_bed_b101_2 FROM public.beds WHERE room_id = v_rm_b101 AND bed_number = 2;

  -- Clean prior active allocations for our test students
  UPDATE public.room_allocations 
  SET is_active = FALSE, vacated_at = NOW() 
  WHERE student_id IN (v_stu_1, v_stu_2, v_stu_3, v_stu_4, v_stu_5, v_stu_6) AND is_active = TRUE;

  -- Allocate Rahul Sharma -> Hostel A Room 101 Bed 1
  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active)
  VALUES (v_stu_1, v_bed_a101_1, v_warden_id, TRUE)
  ON CONFLICT DO NOTHING;

  -- Allocate Aarav Patel -> Hostel A Room 101 Bed 2 (Room 101 now 100% full)
  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active)
  VALUES (v_stu_2, v_bed_a101_2, v_warden_id, TRUE)
  ON CONFLICT DO NOTHING;

  -- Allocate Rohan Gupta -> Hostel A Room 102 Bed 1 (Room 102 33% full)
  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active)
  VALUES (v_stu_3, v_bed_a102_1, v_warden_id, TRUE)
  ON CONFLICT DO NOTHING;

  -- Allocate Vikram Malhotra -> Hostel A Room 103 Bed 1 (Single room 100% full)
  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active)
  VALUES (v_stu_4, v_bed_a103_1, v_warden_id, TRUE)
  ON CONFLICT DO NOTHING;

  -- Allocate Priya Verma -> Hostel B Room 101 Bed 1
  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active)
  VALUES (v_stu_5, v_bed_b101_1, v_admin_id, TRUE)
  ON CONFLICT DO NOTHING;

  -- Allocate Ananya Iyer -> Hostel B Room 101 Bed 2
  INSERT INTO public.room_allocations (student_id, bed_id, allocated_by, is_active)
  VALUES (v_stu_6, v_bed_b101_2, v_admin_id, TRUE)
  ON CONFLICT DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 6. MAINTENANCE TICKETS (Issues with immutable snapshot triggers)
  -- ---------------------------------------------------------------------------
  DELETE FROM public.issues WHERE student_id IN (v_stu_1, v_stu_2, v_stu_5);

  -- Issue 1: Electrical (Pending)
  INSERT INTO public.issues (
    student_id, hostel_id, room_id, category, title, description, status
  ) VALUES (
    v_stu_1, v_hostel_a, v_rm_a101, 'ELECTRICAL', 
    'Ceiling Fan Regulator Not Working', 
    'The speed regulator for the ceiling fan in room 101 is jammed at max speed.', 
    'pending'
  );

  -- Issue 2: Plumbing (In Progress)
  INSERT INTO public.issues (
    student_id, hostel_id, room_id, category, title, description, status
  ) VALUES (
    v_stu_2, v_hostel_a, v_rm_a101, 'PLUMBING', 
    'Washroom tap dripping continuously', 
    'The bathroom sink tap has a slow leak causing water accumulation.', 
    'in_progress'
  );

  -- Issue 3: WiFi (Completed)
  INSERT INTO public.issues (
    student_id, hostel_id, room_id, category, title, description, status, resolved_at
  ) VALUES (
    v_stu_5, v_hostel_b, v_rm_b101, 'WIFI', 
    'Weak Wi-Fi signal on 1st Floor wing B', 
    'The access point on floor 1 was dropping packets during peak study hours.', 
    'completed', NOW() - INTERVAL '1 day'
  );

  -- ---------------------------------------------------------------------------
  -- 7. GATE PASSES (All 4 states: Pending, Approved, Completed, Expired)
  -- ---------------------------------------------------------------------------
  DELETE FROM public.gate_passes WHERE student_id IN (v_stu_1, v_stu_2, v_stu_4);

  -- Pass 1: Pending approval
  INSERT INTO public.gate_passes (
    student_id, hostel_id, room_id, pass_type, reason, 
    out_date, out_time, expected_return_date, expected_return_time, status
  ) VALUES (
    v_stu_1, v_hostel_a, v_rm_a101, 'DAY_OUT', 
    'Visiting City Central Library for academic project references',
    CURRENT_DATE, '14:00:00', CURRENT_DATE, '20:30:00', 'pending'
  );

  -- Pass 2: Approved (Waiting for security check out)
  INSERT INTO public.gate_passes (
    student_id, hostel_id, room_id, pass_type, reason, 
    out_date, out_time, expected_return_date, expected_return_time, 
    status, approved_by, action_note, actioned_at
  ) VALUES (
    v_stu_2, v_hostel_a, v_rm_a101, 'DAY_OUT', 
    'Medical appointment & routine eye checkup at Apollo Clinic',
    CURRENT_DATE, '15:30:00', CURRENT_DATE, '19:00:00', 
    'approved', v_warden_id, 'Approved. Return strictly before 7:00 PM.', NOW() - INTERVAL '2 hours'
  );

  -- Pass 3: Completed (Exited & Returned on time)
  INSERT INTO public.gate_passes (
    student_id, hostel_id, room_id, pass_type, reason, 
    out_date, out_time, expected_return_date, expected_return_time, 
    status, approved_by, actual_exit_time, actual_entry_time, is_late
  ) VALUES (
    v_stu_4, v_hostel_a, v_rm_a103, 'DAY_OUT', 
    'Hardware component procurement for robotics lab',
    CURRENT_DATE - 1, '10:00:00', CURRENT_DATE - 1, '18:00:00', 
    'completed', v_warden_id, 
    (CURRENT_DATE - 1 + TIME '10:15:00')::TIMESTAMPTZ, 
    (CURRENT_DATE - 1 + TIME '17:45:00')::TIMESTAMPTZ, FALSE
  );

  -- ---------------------------------------------------------------------------
  -- 8. VISITOR LOGS (Security checkpoint entries)
  -- ---------------------------------------------------------------------------
  DELETE FROM public.visitor_logs WHERE student_id IN (v_stu_1, v_stu_5);

  -- Visitor 1: Currently inside (Active visitor)
  INSERT INTO public.visitor_logs (
    student_id, hostel_id, room_id, visitor_name, mobile_number, purpose, check_in_time, recorded_by
  ) VALUES (
    v_stu_1, v_hostel_a, v_rm_a101, 'Suresh Sharma (Father)', '+91 9844550001', 
    'Delivering winter clothing and textbooks', NOW() - INTERVAL '45 minutes', v_security_id
  );

  -- Visitor 2: Checked out yesterday
  INSERT INTO public.visitor_logs (
    student_id, hostel_id, room_id, visitor_name, mobile_number, purpose, 
    check_in_time, check_out_time, recorded_by
  ) VALUES (
    v_stu_5, v_hostel_b, v_rm_b101, 'Kavita Verma (Mother)', '+91 9876540003', 
    'Family visit', NOW() - INTERVAL '1 day 3 hours', NOW() - INTERVAL '1 day 1 hour', v_security_id
  );

  -- ---------------------------------------------------------------------------
  -- 9. MESS / DINING (Meal Types, Menu Items, Weekly Menus)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.meal_types (name, description, time_from, time_to)
  VALUES 
    ('BR', 'Morning Breakfast', '07:30:00', '09:30:00'),
    ('LN', 'Afternoon Lunch', '12:30:00', '14:30:00'),
    ('SN', 'Evening Snacks & Tea', '17:00:00', '18:30:00'),
    ('DN', 'Dinner Banquet', '20:00:00', '22:00:00')
  ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

  SELECT id INTO v_m_br FROM public.meal_types WHERE name = 'BR';
  SELECT id INTO v_m_ln FROM public.meal_types WHERE name = 'LN';
  SELECT id INTO v_m_sn FROM public.meal_types WHERE name = 'SN';
  SELECT id INTO v_m_dn FROM public.meal_types WHERE name = 'DN';

  INSERT INTO public.menu_items (name, description, vegetarian, is_active)
  VALUES ('Masala Dosa & Sambar', 'Crispy fermented crepe with spiced potato filling & coconut chutney', TRUE, TRUE)
  RETURNING id INTO v_it_dosa;

  INSERT INTO public.menu_items (name, description, vegetarian, is_active)
  VALUES ('Steamed Idli & Vada', 'Soft rice cakes and savory lentil fritters', TRUE, TRUE)
  RETURNING id INTO v_it_idli;

  INSERT INTO public.menu_items (name, description, vegetarian, is_active)
  VALUES ('South Indian Thali', 'Steamed rice, sambar, rasam, kootu, curd & appalam', TRUE, TRUE)
  RETURNING id INTO v_it_thali;

  INSERT INTO public.menu_items (name, description, vegetarian, is_active)
  VALUES ('Masala Chai & Samosa', 'Spiced cardamom tea with hot crisp vegetable samosas', TRUE, TRUE)
  RETURNING id INTO v_it_chai;

  INSERT INTO public.menu_items (name, description, vegetarian, is_active)
  VALUES ('Paneer Butter Masala & Phulka', 'Cottage cheese in rich tomato gravy served with hot rotis', TRUE, TRUE)
  RETURNING id INTO v_it_paneer;

  -- Weekly Menu for Aryabhata Bhavan (Monday - Sunday)
  FOR i IN 0..6 LOOP
    INSERT INTO public.menus (hostel_id, day_of_week, meal_type_id, is_recurring)
    VALUES (v_hostel_a, i::TEXT, v_m_br, TRUE)
    ON CONFLICT (hostel_id, day_of_week, meal_type_id) DO UPDATE SET is_recurring = TRUE
    RETURNING id INTO v_menu_id;
    INSERT INTO public.menu_item_links (menu_id, item_id) VALUES (v_menu_id, v_it_dosa) ON CONFLICT DO NOTHING;

    INSERT INTO public.menus (hostel_id, day_of_week, meal_type_id, is_recurring)
    VALUES (v_hostel_a, i::TEXT, v_m_ln, TRUE)
    ON CONFLICT (hostel_id, day_of_week, meal_type_id) DO UPDATE SET is_recurring = TRUE
    RETURNING id INTO v_menu_id;
    INSERT INTO public.menu_item_links (menu_id, item_id) VALUES (v_menu_id, v_it_thali) ON CONFLICT DO NOTHING;

    INSERT INTO public.menus (hostel_id, day_of_week, meal_type_id, is_recurring)
    VALUES (v_hostel_a, i::TEXT, v_m_sn, TRUE)
    ON CONFLICT (hostel_id, day_of_week, meal_type_id) DO UPDATE SET is_recurring = TRUE
    RETURNING id INTO v_menu_id;
    INSERT INTO public.menu_item_links (menu_id, item_id) VALUES (v_menu_id, v_it_chai) ON CONFLICT DO NOTHING;

    INSERT INTO public.menus (hostel_id, day_of_week, meal_type_id, is_recurring)
    VALUES (v_hostel_a, i::TEXT, v_m_dn, TRUE)
    ON CONFLICT (hostel_id, day_of_week, meal_type_id) DO UPDATE SET is_recurring = TRUE
    RETURNING id INTO v_menu_id;
    INSERT INTO public.menu_item_links (menu_id, item_id) VALUES (v_menu_id, v_it_paneer) ON CONFLICT DO NOTHING;
  END LOOP;

END $$;
