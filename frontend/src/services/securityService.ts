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
  async checkInVisitor(payload: { enrollment_no: string; visitor_name: string; mobile_number: string; purpose?: string }) {
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('enrollment_no', payload.enrollment_no)
      .single();

    if (!student) throw new Error(`Student with enrollment ${payload.enrollment_no} not found`);

    const { data, error } = await supabase.from('visitor_logs').insert({
      student_id: student.id,
      visitor_name: payload.visitor_name,
      mobile_number: payload.mobile_number,
      purpose: payload.purpose || 'Visit'
    }).select().single();
    if (error) throw error;
    return data;
  },

  /**
   * Check out a visitor
   */
  async checkOutVisitor(visitorId: number) {
    const { data, error } = await supabase.rpc('checkout_visitor', {
      p_visitor_id: visitorId
    });
    if (error) throw error;
    return data;
  }
};
