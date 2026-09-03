/**
 * Admin Role Service
 * Handles system-wide operations, hostel configurations, room matrix, resident directory, and staff management.
 */
import { supabase } from '../lib/supabase';
import type { Hostel, HostelRoom, HostelStudent } from '../types';

export const adminService = {
  /**
   * Fetch aggregated system-wide dashboard stats
   */
  async getDashboardStats() {
    const { data, error } = await supabase.from('view_admin_dashboard_stats').select('*').single();
    if (!error && data) {
      return { statistics: data };
    }
    // Live table fallback
    const [h, r, a, p, iss] = await Promise.all([
      supabase.from('hostels').select('id', { count: 'exact', head: true }),
      supabase.from('hostel_rooms').select('id, capacity').eq('is_active', true),
      supabase.from('room_allocations').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('gate_passes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('issues').select('id', { count: 'exact', head: true }).neq('status', 'completed')
    ]);
    const totalCapacity = (r.data || []).reduce((sum, item) => sum + (item.capacity || 0), 0);
    const occupied = a.count || 0;
    return {
      statistics: {
        total_hostels: h.count || 0,
        total_rooms: (r.data || []).length,
        total_capacity: totalCapacity,
        occupied_beds: occupied,
        vacant_beds: Math.max(0, totalCapacity - occupied),
        occupancy_rate: totalCapacity > 0 ? Math.round((occupied / totalCapacity) * 100) : 0,
        pending_gate_passes: p.count || 0,
        active_issues: iss.count || 0
      }
    };
  },

  /**
   * Fetch all active hostel blocks with occupancy metrics
   */
  async getHostels(): Promise<Hostel[]> {
    const { data: hostels, error } = await supabase
      .from('hostels')
      .select('*, rooms:hostel_rooms(id, capacity, is_active)')
      .eq('is_active', true);
    if (error) throw error;

    const { data: activeAllocs } = await supabase
      .from('room_allocations')
      .select('id, bed:beds(room:hostel_rooms(hostel_id))')
      .eq('is_active', true);

    // Fetch staff for mapping names
    const wardensList = await adminService.getWardens();
    const caretakersList = await adminService.getCaretakers();

    return (hostels || []).map((h: any) => {
      const totalRooms = (h.rooms || []).filter((r: any) => r.is_active).length;
      const totalCap = (h.rooms || []).filter((r: any) => r.is_active).reduce((sum: number, r: any) => sum + (r.capacity || 0), 0);
      const occ = (activeAllocs || []).filter((a: any) => a.bed?.room?.hostel_id === h.id).length;
      
      const wDetail = h.warden_id ? wardensList.find(w => String(w.id) === String(h.warden_id)) : null;
      const cDetail = h.caretaker_id ? caretakersList.find(c => String(c.id) === String(h.caretaker_id)) : null;

      return {
        ...h,
        total_rooms: totalRooms,
        total_capacity: totalCap,
        occupied_beds: occ,
        warden: h.warden_id || null,
        warden_detail: wDetail || null,
        caretaker: h.caretaker_id || null,
        caretaker_detail: cDetail || null
      };
    });
  },

  async createHostel(payload: any) {
    const { data, error } = await supabase.from('hostels').insert({
      name: payload.name,
      gender: payload.gender,
      floor_count: payload.floor_count,
      address: payload.address,
      warden_id: payload.warden ? String(payload.warden) : null,
      caretaker_id: payload.caretaker ? String(payload.caretaker) : null
    }).select().single();
    if (error) throw error;
    return data;
  },

  async updateHostel(id: string | number, payload: any) {
    const { data, error } = await supabase.from('hostels').update({
      name: payload.name,
      gender: payload.gender,
      floor_count: payload.floor_count,
      address: payload.address,
      warden_id: payload.warden ? String(payload.warden) : null,
      caretaker_id: payload.caretaker ? String(payload.caretaker) : null
    }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch rooms with bed slots and assigned occupants
   */
  async getRooms(hostelId?: string | number): Promise<HostelRoom[]> {
    let query = supabase
      .from('hostel_rooms')
      .select('*, hostel:hostels(name), beds(*, allocations:room_allocations(*, student:students(*)))')
      .eq('is_active', true)
      .order('no', { ascending: true });

    if (hostelId) {
      query = query.eq('hostel_id', hostelId);
    }

    const { data: rooms, error } = await query;
    if (error) throw error;

    return (rooms || []).map((r: any) => {
      const activeOccupants: any[] = [];
      (r.beds || []).forEach((b: any) => {
        (b.allocations || []).forEach((a: any) => {
          if (a.is_active && a.student) {
            activeOccupants.push({
              ...a.student,
              bed_number: b.bed_number,
              allocated_at: a.allocated_at
            });
          }
        });
      });

      const occCount = activeOccupants.length;
      return {
        ...r,
        hostel: r.hostel_id,
        hostel_name: r.hostel?.name || '',
        room_no: r.no,
        vacant: occCount < r.capacity,
        occupied_count: occCount,
        current_occupancy: occCount,
        occupants: activeOccupants,
        room_type_display: r.room_type === 'S' ? 'Single' : r.room_type === 'D' ? 'Double' : r.room_type === 'T' ? 'Triple' : 'Multi-Bed'
      };
    });
  },

  /**
   * Fetch resident students directory
   */
  async getStudents(): Promise<HostelStudent[]> {
    const { data: students, error } = await supabase
      .from('students')
      .select('*, course:hostel_courses(*), allocations:room_allocations(*, bed:beds(*, room:hostel_rooms(*, hostel:hostels(*))))')
      .order('student_name', { ascending: true });
    if (error) throw error;

    return (students || []).map((s: any) => {
      const activeAlloc = (s.allocations || []).find((a: any) => a.is_active);
      const bed = activeAlloc?.bed;
      const room = bed?.room;
      const hostel = room?.hostel;
      return {
        ...s,
        room_allotted: !!activeAlloc,
        hostel_name: hostel?.name || '',
        room_no: room?.no || '',
        room_number: room?.no || '',
        bed_number: bed?.bed_number || null,
        hostel: hostel ? hostel.id : null,
        room_detail: room || null
      };
    });
  },

  /**
   * Staff: Wardens
   */
  async getWardens() {
    // Fetch manually added wardens
    const { data: customWardens, error } = await supabase
      .from('hostel_wardens')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });
    
    let combined = customWardens || [];

    // Fetch registered warden profiles
    try {
      const { data: profileWardens } = await supabase.from('profiles').select('*').eq('role', 'WARDEN');
      if (profileWardens) {
        const mapped = profileWardens.map((w: any) => ({
          id: w.id,
          name: `${w.first_name || ''} ${w.last_name || ''}`.trim() || w.email,
          email: w.email,
          phone: w.phone || '',
          designation: 'Hostel Warden',
          experience: 5
        }));
        combined = [...mapped, ...combined];
      }
    } catch (err) {
      console.warn('Could not fetch WARDEN profiles:', err);
    }
    
    return combined;
  },

  async createWarden(payload: { name: string; email?: string; phone: string; designation?: string; experience?: number }) {
    const { data, error } = await supabase.from('hostel_wardens').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async updateWarden(id: string | number, payload: Partial<{ name: string; email?: string; phone: string; designation?: string; experience?: number }>) {
    if (typeof id === 'string' && id.includes('-')) {
      throw new Error("Cannot edit a registered system user from this dashboard.");
    }
    const { data, error } = await supabase.from('hostel_wardens').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteWarden(id: string | number) {
    if (typeof id === 'string' && id.includes('-')) {
      throw new Error("Cannot delete a registered system user from this dashboard.");
    }
    const { error } = await supabase.from('hostel_wardens').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  /**
   * Staff: Caretakers
   */
  async getCaretakers() {
    const { data, error } = await supabase
      .from('hostel_caretakers')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createCaretaker(payload: { name: string; email?: string; phone: string; experience?: number }) {
    const { data, error } = await supabase.from('hostel_caretakers').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async updateCaretaker(id: string | number, payload: Partial<{ name: string; email?: string; phone: string; experience?: number }>) {
    const { data, error } = await supabase.from('hostel_caretakers').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteCaretaker(id: string | number) {
    const { error } = await supabase.from('hostel_caretakers').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  /**
   * Staff: Security
   */
  async getSecurityStaff() {
    // Fetch manually added security staff
    const { data: customSecurity, error } = await supabase
      .from('security_staff')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });
    
    let combined = customSecurity || [];

    // Fetch registered security profiles
    try {
      const { data: profileSecurity } = await supabase.from('profiles').select('*').eq('role', 'SECURITY');
      if (profileSecurity) {
        const mapped = profileSecurity.map((w: any) => ({
          id: w.id,
          name: `${w.first_name || ''} ${w.last_name || ''}`.trim() || w.email,
          email: w.email,
          phone: w.phone || '',
          designation: 'Security Guard',
          experience: 5
        }));
        combined = [...mapped, ...combined];
      }
    } catch (err) {
      console.warn('Could not fetch SECURITY profiles:', err);
    }

    return combined;
  },

  async createSecurityStaff(payload: { name: string; email?: string; phone: string; designation?: string; experience?: number }) {
    const { data, error } = await supabase.from('security_staff').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async updateSecurityStaff(id: string | number, payload: Partial<{ name: string; email?: string; phone: string; designation?: string; experience?: number }>) {
    if (typeof id === 'string' && id.includes('-')) {
      throw new Error("Cannot edit a registered system user from this dashboard.");
    }
    const { data, error } = await supabase.from('security_staff').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteSecurityStaff(id: string | number) {
    if (typeof id === 'string' && id.includes('-')) {
      throw new Error("Cannot delete a registered system user from this dashboard.");
    }
    const { error } = await supabase.from('security_staff').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  }
};
