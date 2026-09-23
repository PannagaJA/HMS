import { supabase } from '../lib/supabase';
import type { Profile, User } from '../types';
import { adminService } from '../services/adminService';
import { wardenService } from '../services/wardenService';
import { securityService } from '../services/securityService';
import { studentService } from '../services/studentService';
import { diningService, issueService } from '../services/facilitiesService';

const inFlightWardenRooms = new Map<string, Promise<any>>();

export const apiClient = {
  async get<T = any>(endpoint: string) {
    // 1. Current user profile (/auth/me/)
    if (endpoint.includes('/auth/me/')) {
      const stored = getStoredUser();
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      
      if (!user && !stored) {
        return { data: null as T };
      }

      const effectiveEmail = user?.email || stored?.email || '';
      const effectiveUserId = user?.id || stored?.id || '';
      let userRole = stored?.role || 'ADMIN';
      let firstName = stored?.first_name || '';
      let lastName = stored?.last_name || '';
      let enrollmentNo = stored?.enrollment_no || '';
      let userPhone = stored?.phone || '';
      let avatarUrl = stored?.avatar_url || '';
      let isActive = stored?.is_active ?? true;
      let createdAt = stored?.created_at || user?.created_at || new Date().toISOString();
      let updatedAt = stored?.updated_at || new Date().toISOString();

      // Check profiles table if user ID exists
      let profile: any = null;
      let profileOrgId: string | undefined = stored?.org_id; // preserve existing org_id from localStorage
      if (effectiveUserId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveUserId);
        if (isUuid) {
          const { data } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name, role, phone, avatar_url, is_active, created_at, updated_at, org_id')
            .eq('id', effectiveUserId)
            .maybeSingle();
          profile = data;
          if (data?.org_id) profileOrgId = data.org_id;
        }
      }

      if (profile) {
        firstName = profile.first_name || firstName;
        lastName = profile.last_name || lastName;
        userRole = profile.role || userRole;
        userPhone = profile.phone || userPhone;
        avatarUrl = profile.avatar_url || avatarUrl;
        isActive = profile.is_active ?? true;
        createdAt = profile.created_at || createdAt;
        updatedAt = profile.updated_at || updatedAt;
      }

      // If user is STUDENT, students table is the primary authority for name, enrollment_no, and phone
      if (userRole === 'STUDENT') {
        let stData: any = null;

        // Strategy 1: by profile_id (UUID) or id (integer)
        if (effectiveUserId) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveUserId);
          if (isUuid) {
            const { data } = await supabase
              .from('students')
              .select('id, profile_id, student_name, enrollment_no, phone, email, org_id')
              .eq('profile_id', effectiveUserId)
              .limit(1)
              .maybeSingle();
            stData = data;
          } else if (!isNaN(Number(effectiveUserId))) {
            const { data } = await supabase
              .from('students')
              .select('id, profile_id, student_name, enrollment_no, phone, email, org_id')
              .eq('id', Number(effectiveUserId))
              .limit(1)
              .maybeSingle();
            stData = data;
          }
        }

        // Strategy 2: by email
        if (!stData && effectiveEmail) {
          const { data } = await supabase
            .from('students')
            .select('id, profile_id, student_name, enrollment_no, phone, email, org_id')
            .ilike('email', effectiveEmail)
            .limit(1)
            .maybeSingle();
          stData = data;
        }

        // Strategy 3: by enrollment_no / USN prefix
        const targetEnrollment = stored?.enrollment_no || (effectiveEmail.includes('@') ? effectiveEmail.split('@')[0] : '');
        if (!stData && targetEnrollment) {
          const { data } = await supabase
            .from('students')
            .select('id, profile_id, student_name, enrollment_no, phone, email, org_id')
            .ilike('enrollment_no', targetEnrollment)
            .limit(1)
            .maybeSingle();
          stData = data;
        }

        if (stData) {
          if (stData.student_name) {
            firstName = stData.student_name;
          }
          if (stData.enrollment_no) {
            enrollmentNo = stData.enrollment_no;
          }
          if (stData.phone) {
            userPhone = stData.phone;
          }
        }
      }

      const defaultUsername = userRole === 'STUDENT'
        ? (enrollmentNo || (effectiveEmail ? effectiveEmail.split('@')[0] : 'student'))
        : (firstName || stored?.username || (effectiveEmail ? effectiveEmail.split('@')[0] : 'user'));

      const mappedUser: User = {
        id: (user?.id || stored?.id || effectiveUserId) as any,
        email: effectiveEmail,
        role: userRole,
        first_name: firstName,
        last_name: lastName,
        username: stored?.username || defaultUsername,
        enrollment_no: enrollmentNo || stored?.enrollment_no || (userRole === 'STUDENT' && effectiveEmail ? effectiveEmail.split('@')[0] : undefined),
        phone: userPhone,
        avatar_url: avatarUrl,
        is_active: isActive,
        // CRITICAL: Always preserve org_id — this is the tenant identifier.
        // Without it, getDashboardStats() cannot filter by org and leaks cross-tenant data.
        org_id: profileOrgId || stored?.org_id,
        created_at: createdAt,
        updated_at: updatedAt
      };

      // Keep localStorage in sync with the fresh database state
      try {
        localStorage.setItem('hms_user', JSON.stringify(mappedUser));
      } catch (storageErr) {
        console.warn('Could not sync user to localStorage:', storageErr);
      }

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

    // 4. Single Room Details & Hostels Management (/hms/hostels/)
    const singleRoomMatch = endpoint.match(/(?:\/api|\/hms)?\/hostels\/(\d+)\/rooms\/(\d+)\/?/);
    if (singleRoomMatch) {
      const hostelId = Number(singleRoomMatch[1]);
      const roomId = Number(singleRoomMatch[2]);
      const details = await wardenService.getRoomDetails(hostelId, roomId);
      return { data: details as T };
    }

    if (endpoint.includes('/hms/hostels/') && endpoint.includes('/rooms/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const hostelId = parts[parts.indexOf('hostels') + 1];
      const rooms = await adminService.getRooms(hostelId);
      return { data: rooms as T };
    }
    if (endpoint.includes('/hms/hostels/') || endpoint.includes('/hostels/')) {
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
      const stored = getStoredUser();
      const userId = stored?.id || (await supabase.auth.getSession()).data.session?.user?.id;
      const stats = await wardenService.getDashboardStats(userId, hostelId || undefined);
      return { data: stats as T };
    }
    if (endpoint.includes('/warden/rooms/')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      const hostelId = urlParams.get('hostel_id') || 'all';
      const floor = urlParams.get('floor') || 'all';
      const cacheKey = `${hostelId}_${floor}`;

      if (inFlightWardenRooms.has(cacheKey)) {
        return { data: (await inFlightWardenRooms.get(cacheKey)!) as T };
      }

      const promise = (async () => {
        try {
          let query = supabase.from('hostel_rooms').select('*, beds(*, allocations:room_allocations(*, student:students(*)))').eq('is_active', true);
          if (hostelId && hostelId !== 'all') query = query.eq('hostel_id', hostelId);
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

          return formattedRooms;
        } finally {
          inFlightWardenRooms.delete(cacheKey);
        }
      })();

      inFlightWardenRooms.set(cacheKey, promise);
      const result = await promise;
      return { data: result as T };
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

    // Password Change Handler for /auth/profile/ & /auth/change-password/
    if (endpoint.includes('/auth/profile/') || endpoint.includes('/auth/change-password/')) {
      const newPassword = body?.new_password || body?.password;
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long.');
      }

      const stored = getStoredUser();
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      const effectiveEmail = user?.email || stored?.email || '';
      const effectiveUsername = stored?.username || (effectiveEmail ? effectiveEmail.split('@')[0] : '');

      // If user has an active Supabase Auth session, update Supabase Auth
      if (user) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
          throw new Error(error.message || 'Failed to update password in authentication service.');
        }
      }

      // Save updated password in custom passwords map for directory/fallback sessions
      if (typeof localStorage !== 'undefined') {
        try {
          const customPasswords: Record<string, string> = JSON.parse(localStorage.getItem('hms_custom_passwords') || '{}');
          if (effectiveEmail) {
            customPasswords[effectiveEmail.toLowerCase()] = newPassword;
            const emailPrefix = effectiveEmail.split('@')[0].toLowerCase();
            customPasswords[emailPrefix] = newPassword;
          }
          if (effectiveUsername) customPasswords[effectiveUsername.toLowerCase()] = newPassword;
          if (stored?.enrollment_no) customPasswords[stored.enrollment_no.toLowerCase()] = newPassword;
          if (stored?.username) customPasswords[stored.username.toLowerCase()] = newPassword;
          if (stored?.id) customPasswords[String(stored.id).toLowerCase()] = newPassword;
          localStorage.setItem('hms_custom_passwords', JSON.stringify(customPasswords));
        } catch (storageErr) {
          console.warn('Could not save custom password to localStorage:', storageErr);
        }
      }

      return { data: { success: true, message: 'Password changed successfully!' } as T };
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
    // Update Security
    if (endpoint.includes('/hms/security/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const securityId = parts[parts.indexOf('security') + 1] || body?.id;
      const data = await adminService.updateSecurityStaff(securityId, body);
      return { data: data as T };
    }
    // Update Room
    if (endpoint.includes('/hms/rooms/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const roomId = parts[parts.indexOf('rooms') + 1] || body?.id;
      const data = await adminService.updateRoom(roomId, body);
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

    // Room Resizing & Details Update
    if (endpoint.includes('/hms/rooms/')) {
      const parts = endpoint.split('/').filter(Boolean);
      const roomId = parts[parts.indexOf('rooms') + 1] || body?.id;
      const data = await adminService.updateRoom(roomId, body);
      return { data: data as T };
    }
    // Profile Updates
    if (endpoint.includes('/auth/profile/')) {
      const stored = getStoredUser();
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      const userRole = stored?.role || '';

      // Fetch existing profile row (for non-students and sync)
      let existingProfile: any = null;
      const profileId = userId || stored?.id;
      if (profileId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId);
        if (isUuid) {
          const { data } = await supabase.from('profiles').select('*').eq('id', profileId).maybeSingle();
          existingProfile = data;
        }
      }

      let freshData: any = null;

      // ── STUDENT PATH ──────────────────────────────────────────────────────────
      // Students are stored in the `students` table, NOT profiles.
      // For synthetic sessions (no real Supabase auth), we MUST update students directly.
      if (userRole === 'STUDENT') {
        const fullName = [
          body?.first_name ?? stored?.first_name ?? '',
          body?.last_name ?? stored?.last_name ?? ''
        ].filter(Boolean).join(' ').trim();

        const studentPayload: any = {};
        if (fullName) studentPayload.student_name = fullName;
        if (body?.phone !== undefined) studentPayload.phone = body.phone;

        let updatedStudent: any = null;

        if (Object.keys(studentPayload).length > 0) {
          // Strategy 1: match by profile_id (real Supabase users)
          const effectiveId = userId || (existingProfile?.id);
          if (effectiveId) {
            const { data } = await supabase
              .from('students')
              .update(studentPayload)
              .eq('profile_id', effectiveId)
              .select('*')
              .maybeSingle();
            if (data) updatedStudent = data;
          }

          // Strategy 2: match by email (most reliable for synthetic sessions)
          const targetEmail = stored?.email || body?.email || authData?.user?.email;
          if (!updatedStudent && targetEmail) {
            const { data } = await supabase
              .from('students')
              .update(studentPayload)
              .ilike('email', targetEmail)
              .select('*')
              .maybeSingle();
            if (data) updatedStudent = data;
          }

          // Strategy 3: match by enrollment_no (USN prefix from email)
          const enrollmentNo = stored?.enrollment_no || stored?.username;
          if (!updatedStudent && enrollmentNo && !enrollmentNo.includes('@')) {
            const { data } = await supabase
              .from('students')
              .update(studentPayload)
              .ilike('enrollment_no', enrollmentNo)
              .select('*')
              .maybeSingle();
            if (data) updatedStudent = data;
          }

          // Strategy 4: match by phone (last resort)
          const targetPhone = stored?.phone;
          if (!updatedStudent && targetPhone) {
            const { data } = await supabase
              .from('students')
              .update(studentPayload)
              .eq('phone', targetPhone)
              .select('*')
              .maybeSingle();
            if (data) updatedStudent = data;
          }
        }

        // Sync first_name and phone back to profiles table if the row exists
        if (existingProfile) {
          const profileSync: any = {};
          if (body?.first_name !== undefined) profileSync.first_name = body.first_name;
          if (body?.last_name !== undefined) profileSync.last_name = body.last_name;
          if (body?.phone !== undefined) profileSync.phone = body.phone;
          if (Object.keys(profileSync).length > 0) {
            const { data: refreshedProfile } = await supabase
              .from('profiles')
              .update(profileSync)
              .eq('id', existingProfile.id)
              .select('*')
              .maybeSingle();
            if (refreshedProfile) freshData = refreshedProfile;
          }
        }

        // Build merged profile preserving student identity fields
        const mergedProfile = {
          ...(stored || {}),
          ...(freshData || existingProfile || {}),
          id: stored?.id,
          role: 'STUDENT',
          email: body?.email || stored?.email || authData?.user?.email || '',
          first_name: body?.first_name ?? updatedStudent?.student_name?.split(' ')[0] ?? stored?.first_name ?? '',
          last_name: body?.last_name ?? (updatedStudent?.student_name?.split(' ').slice(1).join(' ') ?? stored?.last_name ?? ''),
          phone: body?.phone ?? updatedStudent?.phone ?? stored?.phone ?? '',
          username: stored?.username,
          enrollment_no: stored?.enrollment_no || updatedStudent?.enrollment_no,
        };

        const currentToken = getAccessToken();
        if (currentToken) {
          saveAuthSession(currentToken, undefined, mergedProfile);
        } else {
          localStorage.setItem('hms_user', JSON.stringify(mergedProfile));
        }

        return { data: mergedProfile as T };
      }

      // ── NON-STUDENT PATH (ADMIN / WARDEN / SECURITY) ──────────────────────────
      const updateData: any = {};
      if (body?.first_name !== undefined) updateData.first_name = body.first_name;
      if (body?.last_name !== undefined) updateData.last_name = body.last_name;
      if (body?.phone !== undefined) updateData.phone = body.phone;
      if (body?.avatar_url !== undefined) updateData.avatar_url = body.avatar_url;

      const effectiveUserId = userId || existingProfile?.id || stored?.id;

      if (effectiveUserId && Object.keys(updateData).length > 0) {
        const { data: refreshedProfile, error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', effectiveUserId)
          .select('*')
          .maybeSingle();
        if (error) {
          console.warn('Error updating profile in Supabase:', error);
        } else {
          freshData = refreshedProfile;
        }
      }

      const mergedProfile = {
        ...(stored || {}),
        ...(freshData || existingProfile || {}),
        id: freshData?.id || effectiveUserId || stored?.id,
        role: freshData?.role || stored?.role || 'ADMIN',
        email: body?.email || freshData?.email || stored?.email,
        first_name: body?.first_name ?? freshData?.first_name ?? stored?.first_name,
        last_name: body?.last_name ?? freshData?.last_name ?? stored?.last_name,
        phone: body?.phone ?? freshData?.phone ?? stored?.phone,
        username: stored?.username,
        enrollment_no: stored?.enrollment_no,
      };

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

    // Clear any previous stale sessions from other organizations first
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('hms_user');
      localStorage.removeItem('hms_token');
    } catch (_) {}

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

    // 2. If password matches default (amc@2026) or user-updated custom password
    let customPass: string | undefined;
    if (typeof localStorage !== 'undefined') {
      try {
        const customPasswords: Record<string, string> = JSON.parse(localStorage.getItem('hms_custom_passwords') || '{}');
        customPass = customPasswords[emailToUse.toLowerCase()] 
          || customPasswords[input.toLowerCase()] 
          || (input.includes('@') ? customPasswords[input.split('@')[0].toLowerCase()] : undefined);
      } catch (e) {
        console.warn('Could not read custom passwords:', e);
      }
    }

    // Once a custom password is set, ONLY the new password is accepted (old default amc@2026 is invalidated)
    const isPasswordValid = customPass ? password === customPass : password === 'amc@2026';

    if (isPasswordValid) {
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

        const studentProfile: User = {
          id: validProfileId,
          email: studentMatch.email || emailToUse,
          role: 'STUDENT',
          first_name: studentMatch.student_name,
          last_name: '',
          username: studentMatch.enrollment_no || (studentMatch.email ? studentMatch.email.split('@')[0] : 'student'),
          enrollment_no: studentMatch.enrollment_no,
          phone: studentMatch.phone || '',
          is_active: true,
          org_id: studentMatch.org_id || undefined,
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

      // Check profiles table for Warden / Admin / Staff
      const { data: profMatch } = await supabase
        .from('profiles')
        .select('*')
        .or(`email.ilike.${emailToUse},email.ilike.${input}`)
        .limit(1)
        .maybeSingle();

      if (profMatch) {
        const staffProfile: Profile = {
          id: profMatch.id,
          email: profMatch.email,
          role: profMatch.role,
          first_name: profMatch.first_name,
          last_name: profMatch.last_name || '',
          phone: profMatch.phone || '',
          is_active: true,
          org_id: profMatch.org_id || undefined,
          created_at: profMatch.created_at || new Date().toISOString(),
          updated_at: profMatch.updated_at || new Date().toISOString()
        };

        const syntheticSession = {
          access_token: `hms-session-profile-${profMatch.id}-${Date.now()}`,
          token_type: 'bearer',
          user: {
            id: profMatch.id,
            email: profMatch.email,
            role: 'authenticated'
          }
        };

        return { session: syntheticSession as any, user: syntheticSession.user as any, profile: staffProfile };
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
