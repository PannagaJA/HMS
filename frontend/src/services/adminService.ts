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
      .select('*, rooms:hostel_rooms(id, capacity, is_active), wardens:warden_hostel_assignments(warden_profile_id)')
      .eq('is_active', true);
    if (error) throw error;

    const { data: activeAllocs } = await supabase
      .from('room_allocations')
      .select('id, bed:beds(room:hostel_rooms(hostel_id))')
      .eq('is_active', true);

    return (hostels || []).map((h: any) => {
      const totalRooms = (h.rooms || []).filter((r: any) => r.is_active).length;
      const totalCap = (h.rooms || []).filter((r: any) => r.is_active).reduce((sum: number, r: any) => sum + (r.capacity || 0), 0);
      const occ = (activeAllocs || []).filter((a: any) => a.bed?.room?.hostel_id === h.id).length;
      return {
        ...h,
        total_rooms: totalRooms,
        total_capacity: totalCap,
        occupied_beds: occ,
        warden: h.wardens?.[0]?.warden_profile_id || null,
        warden_detail: null,
        caretaker: null
      };
    });
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
    // 1. Check local/custom wardens cache
    const storedWardens: any[] = JSON.parse(localStorage.getItem('hms_custom_wardens') || '[]');
    
    // 2. Fetch WARDEN profiles from Supabase
    try {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'WARDEN');
      const profileWardens = (data || []).map((w: any) => ({
        id: w.id,
        name: `${w.first_name || ''} ${w.last_name || ''}`.trim() || w.email,
        email: w.email,
        phone: w.phone || '',
        designation: 'Hostel Warden',
        experience: 5
      }));

      // Merge avoiding duplicate IDs
      const combined = [...profileWardens];
      for (const sw of storedWardens) {
        if (!combined.some(w => String(w.id) === String(sw.id))) {
          combined.push(sw);
        }
      }
      return combined;
    } catch {
      return storedWardens;
    }
  },

  async createWarden(payload: { name: string; email?: string; phone: string; designation?: string; experience?: number }) {
    // Save to local custom wardens list
    const storedWardens: any[] = JSON.parse(localStorage.getItem('hms_custom_wardens') || '[]');
    const newWarden = {
      id: Date.now(),
      name: payload.name,
      email: payload.email || '',
      phone: payload.phone,
      designation: payload.designation || 'Hostel Warden',
      experience: payload.experience || 0
    };
    storedWardens.push(newWarden);
    localStorage.setItem('hms_custom_wardens', JSON.stringify(storedWardens));
    return newWarden;
  },

  async updateWarden(id: string | number, payload: Partial<{ name: string; email?: string; phone: string; designation?: string; experience?: number }>) {
    const storedWardens: any[] = JSON.parse(localStorage.getItem('hms_custom_wardens') || '[]');
    const index = storedWardens.findIndex(w => String(w.id) === String(id));
    if (index !== -1) {
      storedWardens[index] = { ...storedWardens[index], ...payload };
      localStorage.setItem('hms_custom_wardens', JSON.stringify(storedWardens));
      return storedWardens[index];
    }
    // Also try updating profiles if it was a profile
    try {
      const names = (payload.name || '').trim().split(' ');
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || '';
      await supabase.from('profiles').update({
        first_name: firstName,
        last_name: lastName,
        phone: payload.phone
      }).eq('id', id);
    } catch (e) {
      console.warn('Could not update profile in Supabase:', e);
    }
    return { id, ...payload };
  },

  async deleteWarden(id: string | number) {
    const storedWardens: any[] = JSON.parse(localStorage.getItem('hms_custom_wardens') || '[]');
    const filtered = storedWardens.filter(w => String(w.id) !== String(id));
    localStorage.setItem('hms_custom_wardens', JSON.stringify(filtered));

    try {
      await supabase.from('profiles').delete().eq('id', id);
    } catch (e) {
      console.warn('Could not delete profile in Supabase:', e);
    }
    return { success: true };
  },

  /**
   * Staff: Caretakers
   */
  async getCaretakers() {
    const storedCaretakers: any[] = JSON.parse(localStorage.getItem('hms_custom_caretakers') || '[]');
    try {
      const { data, error } = await supabase
        .from('hostel_caretakers')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });
      if (error || !data) {
        return storedCaretakers;
      }
      const combined = [...data];
      for (const sc of storedCaretakers) {
        if (!combined.some(c => String(c.id) === String(sc.id))) {
          combined.push(sc);
        }
      }
      return combined;
    } catch {
      return storedCaretakers;
    }
  },

  async createCaretaker(payload: { name: string; email?: string; phone: string; experience?: number }) {
    // Try Supabase insert
    try {
      const { data, error } = await supabase.from('hostel_caretakers').insert(payload).select().single();
      if (!error && data) return data;
    } catch (e) {
      console.warn('Hostel caretakers table insert failed, falling back to local store:', e);
    }

    // Fallback store
    const storedCaretakers: any[] = JSON.parse(localStorage.getItem('hms_custom_caretakers') || '[]');
    const newCaretaker = {
      id: Date.now(),
      name: payload.name,
      email: payload.email || '',
      phone: payload.phone,
      experience: payload.experience || 0,
      is_active: true
    };
    storedCaretakers.push(newCaretaker);
    localStorage.setItem('hms_custom_caretakers', JSON.stringify(storedCaretakers));
    return newCaretaker;
  },

  async updateCaretaker(id: string | number, payload: Partial<{ name: string; email?: string; phone: string; experience?: number }>) {
    try {
      await supabase.from('hostel_caretakers').update(payload).eq('id', id);
    } catch (e) {
      console.warn('Hostel caretakers table update failed:', e);
    }
    const storedCaretakers: any[] = JSON.parse(localStorage.getItem('hms_custom_caretakers') || '[]');
    const index = storedCaretakers.findIndex(c => String(c.id) === String(id));
    if (index !== -1) {
      storedCaretakers[index] = { ...storedCaretakers[index], ...payload };
      localStorage.setItem('hms_custom_caretakers', JSON.stringify(storedCaretakers));
      return storedCaretakers[index];
    }
    return { id, ...payload };
  },

  async deleteCaretaker(id: string | number) {
    try {
      await supabase.from('hostel_caretakers').delete().eq('id', id);
    } catch (e) {
      console.warn('Hostel caretakers delete failed:', e);
    }
    const storedCaretakers: any[] = JSON.parse(localStorage.getItem('hms_custom_caretakers') || '[]');
    const filtered = storedCaretakers.filter(c => String(c.id) !== String(id));
    localStorage.setItem('hms_custom_caretakers', JSON.stringify(filtered));
    return { success: true };
  }
};
