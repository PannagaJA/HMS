import { supabase } from '../lib/supabase';
import type { 
  Student, 
  Hostel, 
  HostelRoom, 
  Bed, 
  RoomAllocation, 
  Issue, 
  GatePass, 
  VisitorLog, 
  DashboardStats 
} from '../types';

export const hostelService = {
  async getHostels(): Promise<Hostel[]> {
    const { data, error } = await supabase.from('hostels').select('*').eq('is_active', true);
    if (error) throw error;
    return data || [];
  },

  async getRooms(hostelId?: number): Promise<HostelRoom[]> {
    let query = supabase.from('hostel_rooms').select('*').eq('is_active', true);
    if (hostelId) query = query.eq('hostel_id', hostelId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createRoomWithBeds(hostelId: number, roomNo: string, floor: number, capacity: number, roomType = 'D') {
    const { data, error } = await supabase.rpc('create_room_with_beds', {
      p_hostel_id: hostelId,
      p_room_no: roomNo,
      p_floor: floor,
      p_capacity: capacity,
      p_room_type: roomType,
    });
    if (error) throw error;
    return data;
  },

  async resizeRoomCapacity(roomId: number, newCapacity: number) {
    const { data, error } = await supabase.rpc('resize_room_capacity', {
      p_room_id: roomId,
      p_new_capacity: newCapacity,
    });
    if (error) throw error;
    return data;
  },

  async decommissionRoom(roomId: number) {
    const { data, error } = await supabase.rpc('decommission_room', {
      p_room_id: roomId,
    });
    if (error) throw error;
    return data;
  },

  async getBeds(roomId: number): Promise<Bed[]> {
    const { data, error } = await supabase.from('beds').select('*').eq('room_id', roomId).order('bed_number', { ascending: true });
    if (error) throw error;
    return data || [];
  }
};

export const studentService = {
  async getStudents(): Promise<Student[]> {
    const { data, error } = await supabase.from('students').select('*').order('student_name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getActiveAllocations(): Promise<RoomAllocation[]> {
    const { data, error } = await supabase
      .from('room_allocations')
      .select('*, student:students(*), bed:beds(*, room:hostel_rooms(*, hostel:hostels(*)))')
      .eq('is_active', true);
    if (error) throw error;
    return data || [];
  },

  async allocateRoom(studentId: number, bedId: number) {
    const { data, error } = await supabase.rpc('allocate_student_room', {
      p_student_id: studentId,
      p_bed_id: bedId,
    });
    if (error) throw error;
    return data;
  },

  async vacateRoom(studentId: number) {
    const { data, error } = await supabase.rpc('vacate_student_room', {
      p_student_id: studentId,
    });
    if (error) throw error;
    return data;
  }
};

export const issueService = {
  async getIssues(): Promise<Issue[]> {
    const { data, error } = await supabase
      .from('issues')
      .select('*, student:students(*), room:hostel_rooms(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createIssue(category: string, title: string, description: string, studentId: number) {
    const { data, error } = await supabase.from('issues').insert({
      student_id: studentId,
      category,
      title,
      description,
    }).select().single();
    if (error) throw error;
    return data;
  },

  async updateIssueStatus(issueId: number, newStatus: string, note = '') {
    const { data, error } = await supabase.rpc('update_issue_status', {
      p_issue_id: issueId,
      p_new_status: newStatus,
      p_note: note,
    });
    if (error) throw error;
    return data;
  }
};

export const gatePassService = {
  async getGatePasses(): Promise<GatePass[]> {
    const { data, error } = await supabase
      .from('gate_passes')
      .select('*, student:students(*), room:hostel_rooms(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async approveGatePass(passId: number, note = '') {
    const { data, error } = await supabase.rpc('approve_gate_pass', {
      p_pass_id: passId,
      p_note: note,
    });
    if (error) throw error;
    return data;
  },

  async rejectGatePass(passId: number, note = '') {
    const { data, error } = await supabase.rpc('reject_gate_pass', {
      p_pass_id: passId,
      p_note: note,
    });
    if (error) throw error;
    return data;
  },

  async logMovement(passId: number, movementType: 'EXIT' | 'ENTRY') {
    const { data, error } = await supabase.rpc('log_gate_movement', {
      p_pass_id: passId,
      p_movement_type: movementType,
    });
    if (error) throw error;
    return data;
  }
};

export const visitorService = {
  async getVisitors(): Promise<VisitorLog[]> {
    const { data, error } = await supabase
      .from('visitor_logs')
      .select('*, student:students(*), room:hostel_rooms(*)')
      .order('check_in_time', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async checkoutVisitor(visitorId: number) {
    const { data, error } = await supabase.rpc('checkout_visitor', {
      p_visitor_id: visitorId,
    });
    if (error) throw error;
    return data;
  }
};

export const dashboardService = {
  async getAdminStats(): Promise<DashboardStats> {
    const { data, error } = await supabase
      .from('view_admin_dashboard_stats')
      .select('*')
      .single();
    if (error) throw error;
    return data as DashboardStats;
  }
};
