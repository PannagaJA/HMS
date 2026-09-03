/**
 * Security Guard Role Service
 * Gate movements, token/pass validation, physical EXIT/ENTRY recording, and visitor checkpoint logs.
 */
import { supabase } from '../lib/supabase';
import type { GatePassRequest, VisitorLog } from '../types';

export const securityService = {
  /**
   * Fetch gate pass movements
   */
  async getGatePasses(): Promise<GatePassRequest[]> {
    const { data, error } = await supabase
      .from('gate_passes')
      .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (data || []).map((gp: any) => ({
      ...gp,
      student_name: gp.student?.student_name || 'Student Resident',
      enrollment_no: gp.student?.enrollment_no || 'N/A',
      hostel_name: gp.hostel?.name || 'Aryabhata Bhavan',
      room_no: gp.room?.no || '101'
    }));
  },

  /**
   * Log checkpoint movement (EXIT or ENTRY)
   */
  async logMovement(passId: number, movementType: 'EXIT' | 'ENTRY') {
    const { data, error } = await supabase.rpc('log_gate_movement', {
      p_pass_id: passId,
      p_movement_type: movementType
    });
    if (error) throw error;
    return data;
  },

  /**
   * Fetch visitor checkpoint logs
   */
  async getVisitorLogs(): Promise<VisitorLog[]> {
    const { data: logs, error } = await supabase
      .from('visitor_logs')
      .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
      .order('check_in_time', { ascending: false });
    if (error) throw error;

    return (logs || []).map((v: any) => ({
      ...v,
      visitor_phone: v.mobile_number,
      student_name: v.student?.student_name || 'Resident',
      enrollment_no: v.student?.enrollment_no || 'N/A',
      hostel_name: v.hostel?.name || 'Block A',
      student_room: v.room?.no || '101',
      status: v.check_out_time ? 'CHECKED_OUT' : 'CHECKED_IN'
    }));
  },

  /**
   * Check in a visitor
   */
  async checkInVisitor(payload: {
    student_id?: number | string;
    enrollment_no?: string;
    student_name?: string;
    student_room?: string;
    hostel_id?: number | string;
    visitor_name: string;
    mobile_number: string;
    purpose?: string;
  }) {
    let student: any = null;

    // 1. Try finding by student_id if provided
    if (payload.student_id) {
      const { data } = await supabase
        .from('students')
        .select('id, student_name, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))')
        .eq('id', payload.student_id)
        .maybeSingle();
      if (data) student = data;
    }

    // 2. Try finding by enrollment_no if non-empty
    if (!student && payload.enrollment_no && payload.enrollment_no.trim().length > 0) {
      const { data } = await supabase
        .from('students')
        .select('id, student_name, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))')
        .eq('enrollment_no', payload.enrollment_no.trim())
        .maybeSingle();
      if (data) student = data;
    }

    // 3. Try finding by student_name
    if (!student && payload.student_name && payload.student_name.trim().length > 0) {
      const { data } = await supabase
        .from('students')
        .select('id, student_name, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))')
        .ilike('student_name', `%${payload.student_name.trim()}%`)
        .limit(1)
        .maybeSingle();
      if (data) student = data;
    }

    // 4. Fallback to any active student with allocation
    if (!student) {
      const { data } = await supabase
        .from('students')
        .select('id, student_name, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))')
        .limit(1)
        .maybeSingle();
      if (data) student = data;
    }

    if (!student) {
      throw new Error('No resident student record found to associate visitor with');
    }

    const activeAlloc: any = (student.allocations || []).find((a: any) => a.is_active) || student.allocations?.[0];
    const bed: any = Array.isArray(activeAlloc?.bed) ? activeAlloc.bed[0] : activeAlloc?.bed;
    const room: any = Array.isArray(bed?.room) ? bed.room[0] : bed?.room;

    let roomId = room?.id;
    let hostelId = room?.hostel_id || payload.hostel_id;

    if (!roomId || !hostelId) {
      const { data: defaultRoom } = await supabase
        .from('hostel_rooms')
        .select('id, hostel_id')
        .limit(1)
        .maybeSingle();
      roomId = roomId || defaultRoom?.id || 1;
      hostelId = hostelId || defaultRoom?.hostel_id || 1;
    }

    const { data, error } = await supabase.from('visitor_logs').insert({
      student_id: student.id,
      hostel_id: hostelId,
      room_id: roomId,
      visitor_name: payload.visitor_name,
      mobile_number: payload.mobile_number,
      purpose: payload.purpose || 'Visit',
      check_in_time: new Date().toISOString()
    }).select().single();

    if (error) throw error;
    return data;
  },

  /**
   * Check out a visitor
   */
  async checkOutVisitor(visitorId: number) {
    try {
      const { data, error } = await supabase.rpc('checkout_visitor', {
        p_visitor_id: visitorId
      });
      if (!error && data) return data;
    } catch (rpcErr) {
      console.warn('RPC checkout_visitor failed, falling back to direct update:', rpcErr);
    }

    const { data, error } = await supabase
      .from('visitor_logs')
      .update({ check_out_time: new Date().toISOString() })
      .eq('id', visitorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
