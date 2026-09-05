import { supabase } from '../lib/supabase';
import type { Profile, User } from '../types';
import { adminService } from '../services/adminService';
import { wardenService } from '../services/wardenService';
import { securityService } from '../services/securityService';
import { studentService } from '../services/studentService';
import { diningService, issueService } from '../services/facilitiesService';

export const apiClient = {
  async get<T = any>(endpoint: string) {
    // 1. Current user profile (/auth/me/)
    if (endpoint.includes('/auth/me/')) {
      const stored = getStoredUser();
      if (stored && stored.role === 'STUDENT' && stored.first_name && stored.first_name !== 'Student') {
        return { data: stored as T };
      }
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user && stored) {
        return { data: stored as T };
      }
      if (!user) return { data: null as T };
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      let firstName = profile?.first_name || stored?.first_name || '';
      let lastName = profile?.last_name || stored?.last_name || '';
      const userRole = profile?.role || stored?.role || 'ADMIN';

      if (userRole === 'STUDENT' && (!firstName || firstName === 'Student' || firstName === 'Resident')) {
        const { data: stData } = await supabase
          .from('students')
          .select('student_name')
          .or(`email.eq.${user.email || stored?.email},profile_id.eq.${user.id}`)
          .limit(1)
          .maybeSingle();
        if (stData?.student_name) {
          firstName = stData.student_name;
        }
      }

      const mappedUser: User = {
        id: user.id as any,
        email: user.email || stored?.email || '',
        role: userRole,
        first_name: firstName,
        last_name: lastName,
        phone: profile?.phone || stored?.phone || '',
        avatar_url: profile?.avatar_url || stored?.avatar_url || '',
        is_active: profile?.is_active ?? true,
        created_at: profile?.created_at || user.created_at,
        updated_at: profile?.updated_at || user.created_at
      };
      return { data: mappedUser as T };
    }

    // 2. Staff Management (/hms/wardens/ & /hms/caretakers/)
    if (endpoint.includes('/hms/wardens/')) {
      const wardens = await adminService.getWardens();
      return { data: wardens as T };
    }
    if (endpoint.includes('/hms/caretakers/')) {
      const caretakers = await adminService.getCaretakers();
      return { data: caretakers as T };
    }
    if (endpoint.includes('/hms/security/')) {
      const security = await adminService.getSecurityStaff();
      return { data: security as T };
    }

    // 3. Students / Resident Directory (/hms/students/ & /warden/students/)
    if (endpoint.includes('/warden/students/')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      const floorFilter = urlParams.get('floor') || 'all';
      const hostelId = urlParams.get('hostel_id') || urlParams.get('hostel') || undefined;
      const residents = await wardenService.getResidents(floorFilter, hostelId);
      return { data: residents as T };
    }
    if (endpoint.includes('/hms/students/')) {
      const students = await adminService.getStudents();
      return { data: students as T };
    }

    // 4. Hostels Management (/hms/hostels/)
    if (endpoint.includes('/hms/hostels/') && endpoint.includes('/rooms/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const hostelId = parts[parts.indexOf('hostels') + 1];
      const rooms = await adminService.getRooms(hostelId);
      return { data: rooms as T };
    }
    if (endpoint.includes('/hms/hostels/')) {
      const hostels = await adminService.getHostels();
      return { data: hostels as T };
    }

    // 5. Rooms Management (/hms/rooms/)
    if (endpoint.includes('/hms/rooms/')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      const hostelFilter = urlParams.get('hostel') || urlParams.get('hostel_id') || undefined;
      const rooms = await adminService.getRooms(hostelFilter);
      return { data: rooms as T };
    }

    // 6. Warden Dashboard & Scoped Rooms
    if (endpoint.includes('/warden/dashboard/')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      const hostelId = urlParams.get('hostel_id');
      const { data: user } = await supabase.auth.getUser();
      const stats = await wardenService.getDashboardStats(user.user?.id, hostelId || undefined);
      return { data: stats as T };
    }
    if (endpoint.includes('/warden/rooms/')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      const hostelId = urlParams.get('hostel_id');
      const floor = urlParams.get('floor');
      let query = supabase.from('hostel_rooms').select('*, beds(*, allocations:room_allocations(*, student:students(*)))').eq('is_active', true);
      if (hostelId) query = query.eq('hostel_id', hostelId);
      if (floor && floor !== 'all') query = query.eq('floor', floor);
      const { data, error } = await query;
      if (error) throw error;

      const formattedRooms = (data || []).map((r: any) => {
        let occupied_count = 0;
        const occupants: any[] = [];

        (r.beds || []).forEach((b: any) => {
          (b.allocations || []).forEach((a: any) => {
            if (a.is_active) {
              occupied_count++;
              if (a.student) {
                occupants.push({
                  student_name: a.student.student_name || 'Resident',
                  enrollment_no: a.student.enrollment_no || 'N/A',
                  bed_number: b.bed_number,
                });
              }
            }
          });
        });

        return {
          ...r,
          occupied_count,
          current_occupancy: occupied_count,
          occupants,
        };
      });

      return { data: formattedRooms as T };
    }

    // 7. Maintenance Issues (/hms/issues/, /warden/issues/, /student/issues/)
    if (endpoint.includes('/issues/')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      const hostelId = urlParams.get('hostel') || urlParams.get('hostel_id') || undefined;
      const statusParam = urlParams.get('status') || undefined;

      // Student-scoped: only show this student's own issues
      if (endpoint.includes('/student/issues/')) {
        const { data: authUser } = await supabase.auth.getUser();
        const userId = authUser.user?.id;
        let resolvedStudentId: number | undefined;

        // Strategy 1: profile_id
        if (userId) {
          const { data: st } = await supabase.from('students').select('id').eq('profile_id', userId).maybeSingle();
          if (st) resolvedStudentId = st.id;
        }
        // Strategy 2: stored email
        if (!resolvedStudentId) {
          const stored = getStoredUser();
          const email = stored?.email;
          if (email) {
            const { data: st } = await supabase.from('students').select('id').ilike('email', email).maybeSingle();
            if (st) resolvedStudentId = st.id;

            // Strategy 3: USN prefix from email
            if (!resolvedStudentId) {
              const usnPrefix = email.split('@')[0];
              const { data: st2 } = await supabase.from('students').select('id').ilike('enrollment_no', usnPrefix).maybeSingle();
              if (st2) resolvedStudentId = st2.id;
            }
          }
          // Strategy 4: phone
          if (!resolvedStudentId) {
            const phone = getStoredUser()?.phone;
            if (phone) {
              const { data: st } = await supabase.from('students').select('id').eq('phone', phone).maybeSingle();
              if (st) resolvedStudentId = st.id;
            }
          }
        }

        // requireStudentFilter=true: returns [] if student can't be identified
        const issues = await issueService.getIssues(resolvedStudentId, hostelId, statusParam, true);
        return { data: issues as T };
      }

      // Admin/Warden: all issues (optionally filtered by hostel/status)
      const issues = await issueService.getIssues(undefined, hostelId, statusParam);
      return { data: issues as T };
    }

    // 8. Gate Passes (/gate-passes/ & /security/gate-passes/)
    if (endpoint.includes('/verify_token/') || endpoint.includes('verify_token')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      const code = urlParams.get('code') || urlParams.get('token') || '';
      const result = await securityService.verifyToken(code);
      return { data: result as T };
    }
    if (endpoint.includes('/my_passes/')) {
      const passes = await studentService.getMyGatePasses();
      return { data: passes as T };
    }
    if (endpoint.includes('/gate-passes/') || endpoint.includes('/gatepass/') || endpoint.includes('/security/passes/') || endpoint.includes('/security/gate-passes/')) {
      const passes = await securityService.getGatePasses();
      return { data: passes as T };
    }

    // 9. Visitor Checkpoint Logs
    if (endpoint.includes('/visitor-logs/') || endpoint.includes('/hms/visitors/')) {
      const logs = await securityService.getVisitorLogs();
      return { data: logs as T };
    }

    // 10. Admin Telemetry & Statistics (/hms/dashboard/stats/)
    if (endpoint.includes('/hms/dashboard/stats/')) {
      const stats = await adminService.getDashboardStats();
      return { data: stats as T };
    }

    // 11. Courses & Dining
    if (endpoint.includes('/courses/')) {
      const { data, error } = await supabase.from('hostel_courses').select('*');
      if (error) throw error;
      return { data: data as T };
    }
    if (endpoint.includes('/today_menu/')) {
      const today = await diningService.getTodayMenu();
      return { data: today as T };
    }
    if (endpoint.includes('/meal-types/') || endpoint.includes('/meal_types/')) {
      const mealTypes = await diningService.getMealTypes();
      return { data: mealTypes as T };
    }
    if (endpoint.includes('/menu-items/') || endpoint.includes('/menu_items/')) {
      const menuItems = await diningService.getMenuItems();
      return { data: menuItems as T };
    }
    if (endpoint.includes('/menus/') || endpoint.includes('/menu/')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      const hostelId = urlParams.get('hostel') || urlParams.get('hostel_id') || undefined;
      const menus = await diningService.getWeeklyMenus(hostelId);
      return { data: menus as T };
    }
    if (endpoint.includes('/skips/')) {
      const skips = await diningService.getTodaySkips();
      return { data: skips as T };
    }

    // 12. Student Dedicated
    if (endpoint.includes('/my_profile/')) {
      const stored = getStoredUser();
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id || stored?.id;
      const profile = await studentService.getMyProfile(userId);
      return { data: profile as T };
    }

    return { data: [] as T };
  },

  async post<T = any>(endpoint: string, body?: any) {
    // Allocate Room
    if (endpoint.includes('/allocate-room') || endpoint.includes('/allocate_room') || endpoint.includes('/allocate/')) {
      let bedId = body?.bed_id;
      let roomData: any = null;
      if (body?.room_id) {
        const bedNum = body?.bed_number ? Number(body.bed_number) : 1;
        try {
          const { data: bedRecord } = await supabase
            .from('beds')
            .select('id, room:hostel_rooms(id, no, floor, hostel:hostels(id, name))')
            .eq('room_id', body.room_id)
            .eq('bed_number', bedNum)
            .maybeSingle();
          if (bedRecord) {
            bedId = bedRecord.id;
            roomData = bedRecord.room;
          }
        } catch (be) {
          console.warn('Bed query failed:', be);
        }
      }

      let allocSuccess = false;
      const studentId = body?.student_id || body?.student;
      if (bedId) {
        try {
          const { data, error } = await supabase.rpc('allocate_student_room', {
            p_student_id: studentId,
            p_bed_id: bedId,
          });
          if (!error) allocSuccess = true;
        } catch (ae) {
          console.warn('RPC allocate_student_room failed:', ae);
        }
      }

      // Always update local storage cache if student or room is locally managed
      const localStudents: any[] = JSON.parse(localStorage.getItem('hms_custom_students') || '[]');
      const idx = localStudents.findIndex(s => String(s.id) === String(studentId));
      if (idx !== -1) {
        localStudents[idx].room_allotted = true;
        localStudents[idx].bed_number = body?.bed_number || '1';
        if (roomData) {
          localStudents[idx].hostel = roomData.hostel?.id || 1;
          localStudents[idx].hostel_name = roomData.hostel?.name || 'Hostel Block';
          localStudents[idx].room_no = roomData.no || String(body.room_id);
          localStudents[idx].room_number = roomData.no || String(body.room_id);
          localStudents[idx].room_detail = roomData;
        } else {
          localStudents[idx].room_no = String(body.room_id);
          localStudents[idx].room_number = String(body.room_id);
        }
        localStorage.setItem('hms_custom_students', JSON.stringify(localStudents));
      }

      return { data: { success: true } as T };
    }

    // Vacate Room
    if (endpoint.includes('/vacate') || endpoint.includes('/vacate_room')) {
      const parts = endpoint.split('/').filter(Boolean);
      const studentId = body?.student_id || parts[parts.indexOf('students') + 1] || parseInt(parts[3] || '0', 10);
      try {
        await supabase.rpc('vacate_student_room', {
          p_student_id: studentId,
        });
      } catch (ve) {
        console.warn('RPC vacate_student_room failed:', ve);
      }

      const localStudents: any[] = JSON.parse(localStorage.getItem('hms_custom_students') || '[]');
      const idx = localStudents.findIndex(s => String(s.id) === String(studentId));
      if (idx !== -1) {
        localStudents[idx].room_allotted = false;
        localStudents[idx].hostel = null;
        localStudents[idx].hostel_name = '';
        localStudents[idx].room_no = '';
        localStudents[idx].room_number = '';
        localStudents[idx].bed_number = null;
        localStudents[idx].room_detail = null;
        localStorage.setItem('hms_custom_students', JSON.stringify(localStudents));
      }

      return { data: { success: true } as T };
    }

    // Create Hostel
    if (endpoint.includes('/hms/hostels/')) {
      const data = await adminService.createHostel(body);
      return { data: data as T };
    }

    // Create Hostel
    if (endpoint.includes('/hms/hostels/')) {
      const data = await adminService.createHostel(body);
      return { data: data as T };
    }

    // Bulk Room Generation
    if (endpoint.includes('/hms/rooms/bulk_create_rooms/')) {
      const hostelId = Number(body?.hostel_id || body?.hostel);
      const floor = Number(body?.floor ?? 0);
      const roomCount = Number(body?.room_count || body?.count || 1);
      const capacity = Number(body?.capacity || 2);
      const roomType = body?.room_type || 'D';

      if (!hostelId || isNaN(hostelId)) {
        throw new Error('Please select a valid hostel.');
      }
      if (roomCount < 1) {
        throw new Error('Room count must be at least 1.');
      }

      // Fetch existing rooms on this floor to avoid duplicate room numbering
      const { data: existingRooms } = await supabase
        .from('hostel_rooms')
        .select('no')
        .eq('hostel_id', hostelId)
        .eq('floor', floor);

      const existingNos = new Set((existingRooms || []).map(r => r.no));
      const createdRooms: any[] = [];

      for (let i = 1; i <= roomCount; i++) {
        // e.g., floor 1 -> 101, 102, ...; floor 0 (Ground) -> G01, G02, ...
        let roomNumber = floor === 0 ? `G${String(i).padStart(2, '0')}` : `${floor}${String(i).padStart(2, '0')}`;
        let suffix = 1;
        while (existingNos.has(roomNumber)) {
          roomNumber = floor === 0 ? `G${String(i).padStart(2, '0')}-${suffix}` : `${floor}${String(i).padStart(2, '0')}-${suffix}`;
          suffix++;
        }
        existingNos.add(roomNumber);

        // Try RPC first
        let newRoomId: any = null;
        try {
          const { data: rpcRoomId, error: rpcErr } = await supabase.rpc('create_room_with_beds', {
            p_hostel_id: hostelId,
            p_room_no: roomNumber,
            p_floor: floor,
            p_capacity: capacity,
            p_room_type: roomType
          });
          if (!rpcErr && rpcRoomId) {
            newRoomId = rpcRoomId;
          }
        } catch (e) {
          // ignore RPC error and fallback
        }

        // Fallback to table insert if RPC wasn't available
        if (!newRoomId) {
          const { data: newRoom, error: roomErr } = await supabase
            .from('hostel_rooms')
            .insert({
              hostel_id: hostelId,
              no: roomNumber,
              floor: floor,
              capacity: capacity,
              room_type: roomType,
              is_active: true
            })
            .select()
            .single();

          if (roomErr || !newRoom) {
            console.error(`Failed to create bulk room ${roomNumber}:`, roomErr);
            throw roomErr || new Error(`Failed to create room ${roomNumber}`);
          }
          newRoomId = newRoom.id;

          const bedsPayload = Array.from({ length: capacity }, (_, bIdx) => ({
            room_id: newRoom.id,
            bed_number: bIdx + 1
          }));
          await supabase.from('beds').insert(bedsPayload);
        }

        createdRooms.push({ id: newRoomId, room_no: roomNumber });
      }

      return { data: { success: true, count: createdRooms.length, rooms: createdRooms } as T };
    }

    // Create Single Room with physical beds
    if (endpoint.includes('/hms/rooms/')) {
      const rawHostelId = body?.hostel || body?.hostel_id;
      const hostelId = rawHostelId !== undefined && rawHostelId !== '' ? Number(rawHostelId) : null;
      const roomNo = String(body?.no || body?.room_no || '').trim();
      const floor = body?.floor !== undefined ? Number(body.floor) : 0;
      const capacity = body?.capacity !== undefined ? Number(body.capacity) : 2;
      const roomType = body?.room_type || 'D';

      if (!hostelId || isNaN(hostelId)) {
        throw new Error('Please select a valid hostel.');
      }
      if (!roomNo) {
        throw new Error('Please provide a valid room number.');
      }

      try {
        const { data, error } = await supabase.rpc('create_room_with_beds', {
          p_hostel_id: hostelId,
          p_room_no: roomNo,
          p_floor: floor,
          p_capacity: capacity,
          p_room_type: roomType
        });
        if (!error && data) {
          return { data: data as T };
        }
        if (error && error.code !== '42883' && error.code !== 'PGRST202') {
          console.warn('RPC create_room_with_beds returned error, attempting direct insert fallback:', error);
        }
      } catch (rpcErr) {
        console.warn('RPC create_room_with_beds call failed, attempting direct insert fallback:', rpcErr);
      }

      // Direct Table Fallback
      const { data: newRoom, error: roomErr } = await supabase
        .from('hostel_rooms')
        .insert({
          hostel_id: hostelId,
          no: roomNo,
          floor: floor,
          capacity: capacity,
          room_type: roomType,
          is_active: true
        })
        .select()
        .single();

      if (roomErr || !newRoom) {
        console.error('Direct room insert failed:', roomErr);
        throw roomErr || new Error('Failed to create room in database.');
      }

      // Create Beds
      const bedsPayload = Array.from({ length: capacity }, (_, i) => ({
        room_id: newRoom.id,
        bed_number: i + 1
      }));

      const { error: bedErr } = await supabase.from('beds').insert(bedsPayload);
      if (bedErr) {
        console.warn('Failed to insert physical beds:', bedErr);
      }

      return { data: newRoom as T };
    }

    // Warden Creation
    if (endpoint.includes('/hms/wardens/')) {
      const data = await adminService.createWarden({
        name: body?.name,
        email: body?.email,
        phone: body?.phone,
        designation: body?.designation,
        experience: body?.experience || 0
      });
      return { data: data as T };
    }

    // Caretaker Creation
    if (endpoint.includes('/hms/caretakers/')) {
      const data = await adminService.createCaretaker({
        name: body?.name,
        email: body?.email,
        phone: body?.phone,
        experience: body?.experience || 0
      });
      return { data: data as T };
    }

    // Security Creation
    if (endpoint.includes('/hms/security/')) {
      const data = await adminService.createSecurityStaff({
        name: body?.name,
        email: body?.email,
        phone: body?.phone,
        designation: body?.designation,
        experience: body?.experience || 0
      });
      return { data: data as T };
    }

    // Security Creation
    if (endpoint.includes('/hms/security/')) {
      const data = await adminService.createSecurityStaff({
        name: body?.name,
        email: body?.email,
        phone: body?.phone,
        designation: body?.designation,
        experience: body?.experience || 0
      });
      return { data: data as T };
    }

    // Single Student Creation
    if (endpoint.includes('/hms/students/create/') || (endpoint.endsWith('/hms/students/') && !endpoint.includes('allocate') && !endpoint.includes('vacate'))) {
      const data = await adminService.createStudent(body);
      return { data: data as T };
    }

    // Bulk Student Import
    if (endpoint.includes('/hms/students/bulk/')) {
      const data = await adminService.bulkCreateStudents(body?.students || body || []);
      return { data: data as T };
    }

    // Hostel Creation
    if (endpoint.includes('/hms/hostels/')) {
      const data = await adminService.createHostel({
        name: body?.name,
        gender: body?.gender,
        floor_count: body?.floor_count,
        warden: body?.warden,
        caretaker: body?.caretaker,
        address: body?.address
      });
      return { data: data as T };
    }

    // Update Issue Status (RPC)
    if (endpoint.includes('/update_status/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const issueId = parseInt(parts[parts.indexOf('issues') + 1] || '0', 10);
      const data = await issueService.updateStatus(issueId, body?.status, body?.note || '');
      return { data: data as T };
    }

    // Create Maintenance Issue
    if (endpoint.includes('/issues/')) {
      const data = await issueService.createIssue(body);
      return { data: data as T };
    }

    // Gate Pass Movement Scan (Security)
    // Gate Pass Movement Scan (Security)
    if (endpoint.includes('/log_movement/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const gpIdx = parts.findIndex(p => p.includes('gate-passes') || p.includes('passes') || p.includes('gatepass'));
      const passId = parseInt(gpIdx !== -1 && parts[gpIdx + 1] ? parts[gpIdx + 1] : body?.pass_id || body?.id || '0', 10);
      const data = await securityService.logMovement(passId, body?.movement_type || 'EXIT');
      return { data: data as T };
    }

    // Gate Pass Actions (Approve / Reject)
    if (endpoint.includes('/warden_action/') || endpoint.includes('/action/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const passId = parseInt(parts[parts.indexOf('gate-passes') + 1] || '0', 10);
      const action = body?.action;
      const data = await wardenService.actionGatePass(passId, action, body?.note || '');
      return { data: data as T };
    }

    // Apply Gate Pass (Student)
    if (endpoint.includes('/gate-passes/') || endpoint.includes('/gatepass/')) {
      const data = await studentService.applyGatePass(body);
      return { data: data as T };
    }

    // Food Item Creation
    if (endpoint.includes('/menu-items/') || endpoint.includes('/menu_items/')) {
      const data = await diningService.createMenuItem({
        name: body?.name,
        category: body?.category,
        description: body?.description,
        is_veg: body?.is_veg ?? body?.vegetarian
      });
      return { data: data as T };
    }

    // Menu Slot Configuration (Post/Put)
    if (endpoint.includes('/save_slot/') || endpoint.includes('/menus/')) {
      const data = await diningService.saveMenuSlot(
        body?.day_of_week ?? 0,
        body?.meal_type ?? 1,
        body?.items || body?.item_ids || [],
        body?.hostel || body?.hostel_id
      );
      return { data: data as T };
    }

    // Meal Skip Recording
    if (endpoint.includes('/skips/')) {
      const data = await diningService.recordMealSkip(body || {});
      return { data: data as T };
    }

    // Visitor Checkout (match before general /visitor-logs/)
    if (endpoint.includes('/checkout/') || endpoint.includes('/checkout_visitor/')) {
      const parts = endpoint.split('/').filter(Boolean);
      let visitorId = 0;
      const vLogIdx = parts.indexOf('visitor-logs');
      if (vLogIdx !== -1 && parts[vLogIdx + 1]) {
        visitorId = parseInt(parts[vLogIdx + 1], 10);
      } else if (body?.id) {
        visitorId = parseInt(body.id, 10);
      }
      const data = await securityService.checkOutVisitor(visitorId);
      return { data: data as T };
    }

    // Visitor Check-In
    if (endpoint.includes('/visitor-logs/')) {
      const data = await securityService.checkInVisitor({
        student_id: body?.student || body?.student_id,
        enrollment_no: body?.enrollment_no,
        student_name: body?.student_name,
        student_room: body?.student_room,
        hostel_id: body?.hostel || body?.hostel_id,
        visitor_name: body?.visitor_name,
        mobile_number: body?.mobile_number || body?.visitor_phone,
        purpose: body?.purpose
      });
      return { data: data as T };
    }

    return { data: {} as T };
  },

  async put<T = any>(endpoint: string, body: any) {
    // Menu Slot Configuration (Put)
    if (endpoint.includes('/hms/menus/')) {
      const data = await diningService.saveMenuSlot(
        Number(body?.day_of_week ?? 0),
        Number(body?.meal_type ?? 1),
        body?.items || [],
        body?.hostel || body?.hostel_id
      );
      return { data: data as T };
    }
    // Update Food Item
    if (endpoint.includes('/hms/menu-items/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const itemId = parts[parts.indexOf('menu-items') + 1] || body?.id;
      const data = await diningService.updateMenuItem(itemId, body);
      return { data: data as T };
    }
    // Update Hostel
    if (endpoint.includes('/hms/hostels/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const hostelId = parts[parts.indexOf('hostels') + 1] || body?.id;
      const data = await adminService.updateHostel(hostelId, body);
      return { data: data as T };
    }
    // Update Warden
    if (endpoint.includes('/hms/wardens/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const wardenId = parts[parts.indexOf('wardens') + 1] || body?.id;
      const data = await adminService.updateWarden(wardenId, body);
      return { data: data as T };
    }
    // Update Student
    if (endpoint.includes('/hms/students/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const studentId = parts[parts.indexOf('students') + 1] || body?.id;
      const data = await adminService.updateStudent(studentId, body);
      return { data: data as T };
    }
    // Update Caretaker
    if (endpoint.includes('/hms/caretakers/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const caretakerId = parts[parts.indexOf('caretakers') + 1] || body?.id;
      const data = await adminService.updateCaretaker(caretakerId, body);
      return { data: data as T };
    }
    return { data: body as T };
  },

  async patch<T = any>(endpoint: string, body: any) {
    // Update Student
    if (endpoint.includes('/hms/students/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const studentId = parts[parts.indexOf('students') + 1] || body?.id;
      const data = await adminService.updateStudent(studentId, body);
      return { data: data as T };
    }
    // Update Food Item
    if (endpoint.includes('/hms/menu-items/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const itemId = parts[parts.indexOf('menu-items') + 1] || body?.id;
      const data = await diningService.updateMenuItem(itemId, body);
      return { data: data as T };
    }
    // Update Hostel
    if (endpoint.includes('/hms/hostels/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const hostelId = parts[parts.indexOf('hostels') + 1] || body?.id;
      const data = await adminService.updateHostel(hostelId, body);
      return { data: data as T };
    }
    // Update Warden
    if (endpoint.includes('/hms/wardens/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const wardenId = parts[parts.indexOf('wardens') + 1] || body?.id;
      const data = await adminService.updateWarden(wardenId, body);
      return { data: data as T };
    }
    // Update Caretaker
    if (endpoint.includes('/hms/caretakers/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const caretakerId = parts[parts.indexOf('caretakers') + 1] || body?.id;
      const data = await adminService.updateCaretaker(caretakerId, body);
      return { data: data as T };
    }
    // Update Security
    if (endpoint.includes('/hms/security/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const securityId = parts[parts.indexOf('security') + 1] || body?.id;
      const data = await adminService.updateSecurityStaff(securityId, body);
      return { data: data as T };
    }

    // Room Resizing via RPC with direct table fallback
    if (endpoint.includes('/hms/rooms/')) {
      const parts = endpoint.split('/');
      const roomId = parseInt(parts[parts.indexOf('rooms') + 1] || '0', 10);
      if (body?.capacity) {
        try {
          const { data, error } = await supabase.rpc('resize_room_capacity', {
            p_room_id: roomId,
            p_new_capacity: body.capacity
          });
          if (!error && data) {
            return { data: data as T };
          }
        } catch (e) {
          console.warn('RPC resize_room_capacity failed, attempting direct table update:', e);
        }

        const { data: updated, error } = await supabase
          .from('hostel_rooms')
          .update({
            capacity: body.capacity,
            ...(body.name ? { name: body.name } : {}),
            ...(body.room_type ? { room_type: body.room_type } : {})
          })
          .eq('id', roomId)
          .select()
          .single();

        if (error) throw error;
        return { data: updated as T };
      }
    }

    // Profile Updates
    if (endpoint.includes('/auth/profile/')) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      let existingProfile: any = null;
      if (userId) {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        existingProfile = data;
      }

      const updateData: any = {};
      if (body?.first_name !== undefined) updateData.first_name = body.first_name;
      if (body?.last_name !== undefined) updateData.last_name = body.last_name;
      if (body?.phone !== undefined) updateData.phone = body.phone;
      if (body?.avatar_url !== undefined) updateData.avatar_url = body.avatar_url;

      if (userId && Object.keys(updateData).length > 0) {
        const { error } = await supabase.from('profiles').update(updateData).eq('id', userId);
        if (error) console.warn('Error updating profile in Supabase:', error);
      }

      // For STUDENT role: sync updated student_name and phone to the students table
      const stored = getStoredUser();
      const userRole = existingProfile?.role || stored?.role || '';
      if (userRole === 'STUDENT' && (body?.first_name || body?.last_name || body?.phone)) {
        const fullName = `${body.first_name ?? existingProfile?.first_name ?? stored?.first_name ?? ''} ${body.last_name ?? existingProfile?.last_name ?? stored?.last_name ?? ''}`.trim();
        const studentPayload: any = {};
        if (fullName) studentPayload.student_name = fullName;
        if (body?.phone) studentPayload.phone = body.phone;

        if (Object.keys(studentPayload).length > 0) {
          let updated = false;
          // Strategy 1: profile_id
          if (userId) {
            const { data: updatedByProfile } = await supabase
              .from('students')
              .update(studentPayload)
              .eq('profile_id', userId)
              .select('id');
            if (updatedByProfile && updatedByProfile.length > 0) {
              updated = true;
            }
          }

          // Strategy 2: email
          const targetEmail = body?.email || existingProfile?.email || stored?.email;
          if (!updated && targetEmail) {
            const { data: updatedByEmail } = await supabase
              .from('students')
              .update(studentPayload)
              .ilike('email', targetEmail)
              .select('id');
            if (updatedByEmail && updatedByEmail.length > 0) {
              updated = true;
            }

            // Strategy 3: USN prefix from email (e.g. 1AM26CS001@amc.edu)
            if (!updated) {
              const usnPrefix = targetEmail.split('@')[0];
              const { data: updatedByUsn } = await supabase
                .from('students')
                .update(studentPayload)
                .ilike('enrollment_no', usnPrefix)
                .select('id');
              if (updatedByUsn && updatedByUsn.length > 0) {
                updated = true;
              }
            }
          }

          // Strategy 4: phone lookup
          const targetPhone = stored?.phone || existingProfile?.phone;
          if (!updated && targetPhone) {
            await supabase
              .from('students')
              .update(studentPayload)
              .eq('phone', targetPhone);
          }
        }
      }

      const mergedProfile = {
        ...(stored || {}),
        ...(existingProfile || {}),
        ...updateData,
        id: existingProfile?.id || userId || stored?.id,
        role: existingProfile?.role || stored?.role || 'ADMIN',
        email: body?.email || existingProfile?.email || stored?.email,
        first_name: body?.first_name ?? existingProfile?.first_name ?? stored?.first_name,
        last_name: body?.last_name ?? existingProfile?.last_name ?? stored?.last_name,
        phone: body?.phone ?? existingProfile?.phone ?? stored?.phone,
      };

      // Persist merged profile to localStorage immediately so all pages see fresh data
      const currentToken = getAccessToken();
      if (currentToken) {
        saveAuthSession(currentToken, undefined, mergedProfile);
      } else {
        localStorage.setItem('hms_user', JSON.stringify(mergedProfile));
      }

      return { data: mergedProfile as T };
    }

    return { data: body as T };
  },

  async delete<T = any>(endpoint: string) {
    // Cancel Meal Skip
    if (endpoint.includes('/skips/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const skipIdx = parts.indexOf('skips');
      const mealTypeId = skipIdx !== -1 && parts[skipIdx + 1] ? parts[skipIdx + 1] : parts[parts.length - 1];
      await diningService.cancelMealSkip(mealTypeId);
      return { data: { success: true } as T };
    }

    // Delete Food Item
    if (endpoint.includes('/menu-items/') || endpoint.includes('/menu_items/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const itemId = parts[parts.indexOf('menu-items') !== -1 ? parts.indexOf('menu-items') + 1 : parts.indexOf('menu_items') + 1];
      await diningService.deleteMenuItem(itemId);
      return { data: { success: true } as T };
    }

    // Delete Hostel
    if (endpoint.includes('/hms/hostels/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const hostelId = parts[parts.indexOf('hostels') + 1];
      await adminService.deleteHostel(hostelId);
      return { data: { success: true } as T };
    }

    // Decommission Room (RPC with fallback)
    if (endpoint.includes('/hms/rooms/')) {
      const parts = endpoint.split('/');
      const roomId = parseInt(parts[parts.indexOf('rooms') + 1] || '0', 10);
      try {
        const { data, error } = await supabase.rpc('decommission_room', {
          p_room_id: roomId
        });
        if (!error && data) {
          return { data: data as T };
        }
      } catch (e) {
        console.warn('RPC decommission_room failed, updating table directly:', e);
      }

      const { data: updated, error } = await supabase
        .from('hostel_rooms')
        .update({ is_active: false })
        .eq('id', roomId)
        .select()
        .single();

      if (error) throw error;
      return { data: updated as T };
    }

    // Warden Delete
    if (endpoint.includes('/hms/wardens/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const wardenId = parts[parts.indexOf('wardens') + 1];
      await adminService.deleteWarden(wardenId);
      return { data: { success: true } as T };
    }

    // Caretaker Delete
    if (endpoint.includes('/hms/caretakers/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const caretakerId = parts[parts.indexOf('caretakers') + 1];
      await adminService.deleteCaretaker(caretakerId);
      return { data: { success: true } as T };
    }

    // Security Delete
    if (endpoint.includes('/hms/security/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const securityId = parts[parts.indexOf('security') + 1];
      await adminService.deleteSecurityStaff(securityId);
      return { data: { success: true } as T };
    }

    return { data: { success: true } as T };
  }
};

export const authService = {
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async getCurrentProfile(): Promise<Profile | null> {
    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return data as Profile | null;
  },

  async login(usernameOrEmail: string, password: string) {
    const input = usernameOrEmail.trim();
    let emailToUse = input;

    // If input is a USN/enrollment_no, format to standard student email
    if (!input.includes('@')) {
      emailToUse = `${input.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.amc.edu`;
    }

    // 1. First attempt standard Supabase Auth
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: emailToUse, password });
      if (!error && data?.session) {
        const profile = await this.getCurrentProfile();
        return { session: data.session, user: data.user, profile };
      }
    } catch (err) {
      console.warn('Supabase signInWithPassword failed, checking directory fallback:', err);
    }

    // 2. If password matches default and user is a student in public.students directory
    if (password === 'amc@2026') {
      const { data: studentMatch } = await supabase
        .from('students')
        .select('*')
        .or(`enrollment_no.ilike.${input},email.ilike.${input},student_name.ilike.${input}`)
        .limit(1)
        .maybeSingle();

      if (studentMatch) {
        // Ensure profile_id is a valid UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentMatch.profile_id || '');
        const validProfileId = isUuid ? studentMatch.profile_id : (crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-0000-0000-000000000099');

        const studentProfile: Profile = {
          id: validProfileId,
          email: studentMatch.email || emailToUse,
          role: 'STUDENT',
          first_name: studentMatch.student_name,
          last_name: '',
          phone: studentMatch.phone || '',
          is_active: true,
          org_id: studentMatch.org_id || '00000000-0000-0000-0000-000000000001',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const syntheticSession = {
          access_token: `hms-session-${studentMatch.id}-${Date.now()}`,
          token_type: 'bearer',
          user: {
            id: studentProfile.id,
            email: studentProfile.email,
            role: 'authenticated'
          }
        };

        return { session: syntheticSession as any, user: syntheticSession.user as any, profile: studentProfile };
      }

      // Check if logging in as demo student@amc.edu
      if (input.toLowerCase() === 'student@amc.edu' || input.toLowerCase() === 'student') {
        const { data: firstStudent } = await supabase.from('students').select('*').limit(1).maybeSingle();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstStudent?.profile_id || '');
        const validProfileId = isUuid ? firstStudent.profile_id : (crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-0000-0000-000000000099');

        const studentProfile: Profile = {
          id: validProfileId,
          email: firstStudent?.email || 'student@amc.edu',
          role: 'STUDENT',
          first_name: firstStudent?.student_name || 'Student',
          last_name: '',
          phone: firstStudent?.phone || '',
          is_active: true,
          org_id: firstStudent?.org_id || '00000000-0000-0000-0000-000000000001',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const syntheticSession = {
          access_token: `hms-session-demo-${Date.now()}`,
          token_type: 'bearer',
          user: {
            id: studentProfile.id,
            email: studentProfile.email,
            role: 'authenticated'
          }
        };

        return { session: syntheticSession as any, user: syntheticSession.user as any, profile: studentProfile };
      }
    }

    throw new Error('Invalid username or password. Please check your credentials.');
  },

  async logout() {
    await supabase.auth.signOut();
  }
};

export const loginUser = async (u: string, p: string) => {
  const res = await authService.login(u, p);
  const token = res.session?.access_token || '';
  if (res.profile) {
    localStorage.setItem('hms_user', JSON.stringify(res.profile));
  }
  if (token) {
    localStorage.setItem('hms_token', token);
  }
  return { user: res.profile as any, access: token };
};

export const logoutUser = async () => {
  localStorage.removeItem('hms_user');
  localStorage.removeItem('hms_token');
  await authService.logout();
};

export const getStoredUser = (): any => {
  try {
    const raw = localStorage.getItem('hms_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const getAccessToken = (): string | null => {
  return localStorage.getItem('hms_token');
};

export const saveAuthSession = (token?: string, _b?: any, user?: any): void => {
  if (token) localStorage.setItem('hms_token', token);
  if (user) localStorage.setItem('hms_user', JSON.stringify(user));
};
