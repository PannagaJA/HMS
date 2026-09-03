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
    const { data: student } = await supabase
      .from('students')
      .select('*, course:hostel_courses(*), allocations:room_allocations(*, bed:beds(*, room:hostel_rooms(*, hostel:hostels(*))))')
      .eq('profile_id', userId || '')
      .single();

    const activeAlloc = (student?.allocations || []).find((a: any) => a.is_active);
    const bed = activeAlloc?.bed;
    const room = bed?.room;
    const hostel = room?.hostel;

    const profile = student ? {
      ...student,
      room_allotted: !!activeAlloc,
      hostel_name: hostel?.name || '',
      room_no: room?.no || '',
      room_number: room?.no || '',
      bed_number: bed?.bed_number || null,
      hostel: hostel ? hostel.id : null,
      room_detail: room || null
    } : null;

    const roommates: HostelStudent[] = [];
    return { profile, roommates };
  },

  /**
   * Fetch student's own gate passes
   */
  async getMyGatePasses(studentId?: number): Promise<GatePassRequest[]> {
    let resolvedStudentId = studentId;

    if (!resolvedStudentId) {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      if (userId) {
        const { data: st } = await supabase.from('students').select('id').eq('profile_id', userId).maybeSingle();
        if (st) resolvedStudentId = st.id;
      }
    }

    let query = supabase
      .from('gate_passes')
      .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
      .order('created_at', { ascending: false });

    if (resolvedStudentId) {
      query = query.eq('student_id', resolvedStudentId);
    }

    const { data: passes, error } = await query;
    if (error) {
      console.warn('Error fetching gate passes:', error);
      return [];
    }

    return (passes || []).map((gp: any) => ({
      ...gp,
      student_name: gp.student?.student_name || 'Resident',
      enrollment_no: gp.student?.enrollment_no || 'N/A',
      hostel_name: gp.hostel?.name || 'Block A',
      room_no: gp.room?.no || '101'
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

    // 1. Find student record
    let studentId: number | null = null;
    let hostelId: number = 1;
    let roomId: number = 1;

    if (userId) {
      const { data: student } = await supabase
        .from('students')
        .select('id, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))')
        .eq('profile_id', userId)
        .maybeSingle();

      if (student) {
        studentId = student.id;
        const activeAlloc: any = (student.allocations || []).find((a: any) => a.is_active) || student.allocations?.[0];
        const bed: any = Array.isArray(activeAlloc?.bed) ? activeAlloc.bed[0] : activeAlloc?.bed;
        const room: any = Array.isArray(bed?.room) ? bed.room[0] : bed?.room;
        if (room?.id) roomId = room.id;
        if (room?.hostel_id) hostelId = room.hostel_id;
      }
    }

    // If not found by profile_id, fallback to first active student with room
    if (!studentId) {
      const { data: fallbackStudent } = await supabase
        .from('students')
        .select('id, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))')
        .limit(1)
        .maybeSingle();

      if (fallbackStudent) {
        studentId = fallbackStudent.id;
        const activeAlloc: any = (fallbackStudent.allocations || []).find((a: any) => a.is_active) || fallbackStudent.allocations?.[0];
        const bed: any = Array.isArray(activeAlloc?.bed) ? activeAlloc.bed[0] : activeAlloc?.bed;
        const room: any = Array.isArray(bed?.room) ? bed.room[0] : bed?.room;
        if (room?.id) roomId = room.id;
        if (room?.hostel_id) hostelId = room.hostel_id;
      }
    }

    if (!studentId) {
      throw new Error('Could not find resident student record for gate pass application');
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
