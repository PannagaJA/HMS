/**
 * Student Resident Role Service
 * Self-service actions: personal profile, room assignment, gate pass applications, and dining schedules.
 */
import { supabase } from '../lib/supabase';
import { diningService } from './facilitiesService';
import type { GatePassRequest, HostelStudent } from '../types';

export const studentService = {
  /**
   * Fetch student's own profile and room allocation
   */
  async getMyProfile(userId?: string) {
    const stored = localStorage.getItem('hms_user');
    const userObj = stored ? JSON.parse(stored) : null;
    const email = userObj?.email;
    const studentName = userObj?.first_name || userObj?.student_name;
    const phone = userObj?.phone;

    let student: any = null;

    if (userId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (isUuid) {
        const { data } = await supabase
          .from('students')
          .select('*, course:hostel_courses(*), allocations:room_allocations(*, bed:beds(*, room:hostel_rooms(*, hostel:hostels(*))))')
          .eq('profile_id', userId)
          .maybeSingle();
        student = data;
      }
    }

    if (!student && email) {
      const { data, error } = await supabase
        .from('students')
        .select('*, course:hostel_courses(*), allocations:room_allocations(*, bed:beds(*, room:hostel_rooms(*, hostel:hostels(*))))')
        .ilike('email', email)
        .maybeSingle();
      if (!error) student = data;
    }

    // Strategy 3: look up by USN (part before @)
    if (!student && email) {
      const usnPrefix = email.split('@')[0];
      const { data, error } = await supabase
        .from('students')
        .select('*, course:hostel_courses(*), allocations:room_allocations(*, bed:beds(*, room:hostel_rooms(*, hostel:hostels(*))))')
        .ilike('enrollment_no', usnPrefix)
        .maybeSingle();
      if (!error) student = data;
    }

    if (!student && studentName && studentName !== 'Student' && studentName !== 'Resident') {
      const { data } = await supabase
        .from('students')
        .select('*, course:hostel_courses(*), allocations:room_allocations(*, bed:beds(*, room:hostel_rooms(*, hostel:hostels(*))))')
        .ilike('student_name', studentName)
        .limit(1)
        .maybeSingle();
      student = data;
    }

    if (!student && phone) {
      const { data } = await supabase
        .from('students')
        .select('*, course:hostel_courses(*), allocations:room_allocations(*, bed:beds(*, room:hostel_rooms(*, hostel:hostels(*))))')
        .eq('phone', phone)
        .limit(1)
        .maybeSingle();
      student = data;
    }

    // No dangerous fallback — if no student found, return null profile

    let activeAlloc = (student?.allocations || []).find((a: any) => a.is_active) || student?.allocations?.[0];

    // If activeAlloc not loaded via nested join, perform explicit query
    if (student?.id && !activeAlloc) {
      try {
        const { data: allocData } = await supabase
          .from('room_allocations')
          .select('*, bed:beds(*, room:hostel_rooms(*, hostel:hostels(*)))')
          .eq('student_id', student.id)
          .eq('is_active', true)
          .maybeSingle();
        if (allocData) activeAlloc = allocData;
      } catch (ae) {
        console.warn('Direct room_allocations query:', ae);
      }
    }

    const bed = Array.isArray(activeAlloc?.bed) ? activeAlloc.bed[0] : activeAlloc?.bed;
    const room = Array.isArray(bed?.room) ? bed.room[0] : bed?.room;
    const hostel = Array.isArray(room?.hostel) ? room.hostel[0] : room?.hostel;

    const profile = student ? {
      ...student,
      room_allotted: !!activeAlloc,
      hostel_name: hostel?.name || '',
      room_no: room?.no || '',
      room_number: room?.no || '',
      floor: room?.floor !== undefined ? room?.floor : null,
      bed_number: bed?.bed_number || null,
      hostel: hostel ? hostel.id : null,
      room_detail: room || null
    } : null;

    let roommates: HostelStudent[] = [];

    if (room?.id && student?.id) {
      try {
        // Query co-residents in the same room directly (no RPC needed)
        const { data: bedsInRoom } = await supabase
          .from('beds')
          .select('id, bed_number')
          .eq('room_id', room.id);

        const bedIds = (bedsInRoom || []).map((b: any) => b.id);
        if (bedIds.length > 0) {
          const { data: coAllocations } = await supabase
            .from('room_allocations')
            .select('student_id, bed_id, student:students(id, student_name, enrollment_no, phone, gender)')
            .eq('is_active', true)
            .in('bed_id', bedIds)
            .neq('student_id', student.id);

          if (coAllocations) {
            const bedMap = new Map((bedsInRoom || []).map((b: any) => [b.id, b.bed_number]));
            roommates = coAllocations
              .filter((alloc: any) => alloc.student)
              .map((alloc: any) => ({
                ...alloc.student,
                bed_number: bedMap.get(alloc.bed_id) || null,
              }));
          }
        }
      } catch (err) {
        console.warn('Failed to fetch roommates:', err);
      }
    }

    return { profile, roommates };
  },

  /**
   * Fetch student's own gate passes
   */
  async getMyGatePasses(studentId?: number): Promise<GatePassRequest[]> {
    let resolvedStudentId = studentId;

    if (!resolvedStudentId) {
      // Strategy 1: Supabase auth profile_id
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      if (userId) {
        const { data: st } = await supabase.from('students').select('id').eq('profile_id', userId).maybeSingle();
        if (st) resolvedStudentId = st.id;
      }

      // Strategy 2: email match from localStorage
      if (!resolvedStudentId) {
        const stored = localStorage.getItem('hms_user');
        const userObj = stored ? JSON.parse(stored) : null;
        const email = userObj?.email;
        if (email) {
          const { data: st } = await supabase.from('students').select('id').ilike('email', email).maybeSingle();
          if (st) resolvedStudentId = st.id;
        }

        // Strategy 3: USN prefix from email
        if (!resolvedStudentId && email) {
          const usnPrefix = email.split('@')[0];
          const { data: st } = await supabase.from('students').select('id').ilike('enrollment_no', usnPrefix).maybeSingle();
          if (st) resolvedStudentId = st.id;
        }

        // Strategy 4: phone match
        if (!resolvedStudentId) {
          const phone = userObj?.phone;
          if (phone) {
            const { data: st } = await supabase.from('students').select('id').eq('phone', phone).maybeSingle();
            if (st) resolvedStudentId = st.id;
          }
        }
      }
    }

    // Safety: if we still can't identify the student, return empty list
    if (!resolvedStudentId) {
      console.warn('[getMyGatePasses] Could not resolve student identity — returning empty list');
      return [];
    }

    const { data: passes, error } = await supabase
      .from('gate_passes')
      .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no, floor)')
      .eq('student_id', resolvedStudentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching gate passes:', error);
      return [];
    }

    return (passes || []).map((gp: any) => ({
      ...gp,
      student_name: gp.student?.student_name || 'Resident',
      enrollment_no: gp.student?.enrollment_no || 'N/A',
      hostel_name: gp.hostel?.name || 'Block A',
      room_no: gp.room?.no || '101',
      floor: gp.room?.floor !== undefined ? gp.room?.floor : null
    }));
  },


  /**
   * Apply for a new gate pass
   */
  async applyGatePass(payload: {
    pass_type?: string;
    reason: string;
    out_date: string;
    out_time: string;
    expected_return_date: string;
    expected_return_time: string;
  }) {
    const { data: user } = await supabase.auth.getUser();
    const userId = user.user?.id;

    // 1. Find student record — try multiple strategies for students without profile_id
    let studentId: number | null = null;
    let hostelId: number = 1;
    let roomId: number = 1;

    const resolveStudentWithAlloc = async (query: any) => {
      const { data: student } = await query;
      if (!student) return null;
      const activeAlloc: any = (student.allocations || []).find((a: any) => a.is_active) || student.allocations?.[0];
      const bed: any = Array.isArray(activeAlloc?.bed) ? activeAlloc.bed[0] : activeAlloc?.bed;
      const room: any = Array.isArray(bed?.room) ? bed.room[0] : bed?.room;
      return { student, roomId: room?.id || null, hostelId: room?.hostel_id || null };
    };

    const allocSelect = 'id, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))';

    // Strategy 1: profile_id (Supabase auth)
    if (userId) {
      const result = await resolveStudentWithAlloc(
        supabase.from('students').select(allocSelect).eq('profile_id', userId).maybeSingle()
      );
      if (result?.student) {
        studentId = result.student.id;
        if (result.roomId) roomId = result.roomId;
        if (result.hostelId) hostelId = result.hostelId;
      }
    }

    // Strategy 2: email from localStorage
    if (!studentId) {
      const stored = localStorage.getItem('hms_user');
      const userObj = stored ? JSON.parse(stored) : null;
      const email = userObj?.email;
      if (email) {
        const result = await resolveStudentWithAlloc(
          supabase.from('students').select(allocSelect).ilike('email', email).maybeSingle()
        );
        if (result?.student) {
          studentId = result.student.id;
          if (result.roomId) roomId = result.roomId;
          if (result.hostelId) hostelId = result.hostelId;
        }

        // Strategy 3: USN prefix from email
        if (!studentId) {
          const usnPrefix = email.split('@')[0];
          const result2 = await resolveStudentWithAlloc(
            supabase.from('students').select(allocSelect).ilike('enrollment_no', usnPrefix).maybeSingle()
          );
          if (result2?.student) {
            studentId = result2.student.id;
            if (result2.roomId) roomId = result2.roomId;
            if (result2.hostelId) hostelId = result2.hostelId;
          }
        }
      }

      // Strategy 4: phone
      if (!studentId) {
        const phone = userObj?.phone;
        if (phone) {
          const result = await resolveStudentWithAlloc(
            supabase.from('students').select(allocSelect).eq('phone', phone).maybeSingle()
          );
          if (result?.student) {
            studentId = result.student.id;
            if (result.roomId) roomId = result.roomId;
            if (result.hostelId) hostelId = result.hostelId;
          }
        }
      }
    }

    if (!studentId) {
      throw new Error('Could not find your student resident record. Please ensure you are registered as a hostel resident.');
    }

    // Resolve fallback hostel/room from DB if allocation wasn't found
    if (roomId === 1 || hostelId === 1) {
      const { data: defaultHostel } = await supabase.from('hostels').select('id').limit(1).maybeSingle();
      if (hostelId === 1 && defaultHostel?.id) hostelId = defaultHostel.id;
      const { data: defaultRoom } = await supabase.from('hostel_rooms').select('id').eq('hostel_id', hostelId).limit(1).maybeSingle();
      if (roomId === 1 && defaultRoom?.id) roomId = defaultRoom.id;
    }


    // Format dates to YYYY-MM-DD
    const formatSqlDate = (dStr: string) => {
      if (!dStr) return new Date().toISOString().split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
      if (/^\d{2}-\d{2}-\d{4}$/.test(dStr)) {
        const [d, m, y] = dStr.split('-');
        return `${y}-${m}-${d}`;
      }
      return dStr;
    };

    // Format times to HH:MM:SS
    const formatSqlTime = (tStr: string) => {
      if (!tStr) return '18:00:00';
      if (/^\d{2}:\d{2}$/.test(tStr)) return `${tStr}:00`;
      return tStr;
    };

    const outDateFormatted = formatSqlDate(payload.out_date);
    const returnDateFormatted = formatSqlDate(payload.expected_return_date);
    const outTimeFormatted = formatSqlTime(payload.out_time);
    const returnTimeFormatted = formatSqlTime(payload.expected_return_time);

    const { data, error } = await supabase
      .from('gate_passes')
      .insert({
        student_id: studentId,
        hostel_id: hostelId,
        room_id: roomId,
        pass_type: payload.pass_type || 'DAY_OUT',
        reason: payload.reason || 'General Outing',
        out_date: outDateFormatted,
        out_time: outTimeFormatted,
        expected_return_date: returnDateFormatted,
        expected_return_time: returnTimeFormatted,
        status: 'pending'
      })
      .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
      .single();

    if (error) {
      console.error('Failed to submit gate pass to Supabase:', error);
      throw error;
    }

    return {
      ...data,
      student_name: data.student?.student_name || 'Resident',
      enrollment_no: data.student?.enrollment_no || 'N/A',
      hostel_name: data.hostel?.name || 'Block A',
      room_no: data.room?.no || '101'
    };
  },

  /**
   * Fetch today's meal schedule
   */
  async getTodayMenu() {
    return diningService.getTodayMenu();
  }
};
