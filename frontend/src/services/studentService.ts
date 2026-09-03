/**
 * Student Resident Role Service
 * Self-service actions: personal profile, room assignment, gate pass applications, and dining schedules.
 */
import { supabase } from '../lib/supabase';
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
  async getMyGatePasses(studentId: number): Promise<GatePassRequest[]> {
    const { data: passes } = await supabase
      .from('gate_passes')
      .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    return (passes || []).map((gp: any) => ({
      ...gp,
      student_name: gp.student?.student_name || 'Resident',
      enrollment_no: gp.student?.enrollment_no || 'N/A',
      hostel_name: gp.hostel?.name || 'Block A',
      room_no: gp.room?.no || '101'
    }));
  },

  /**
   * Fetch today's meal schedule
   */
  async getTodayMenu() {
    const todayDayOfWeek = String(new Date().getDay());
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const { data: menus } = await supabase
      .from('menus')
      .select('*, meal_type:meal_types(*), links:menu_item_links(item:menu_items(*))')
      .eq('day_of_week', todayDayOfWeek);

    const mappedMeals = (menus || []).map((m: any) => {
      const items = (m.links || []).map((l: any) => l.item).filter(Boolean).map((i: any) => ({
        ...i,
        is_veg: Boolean(i.vegetarian ?? i.is_veg ?? true)
      }));
      return {
        ...m,
        meal_type: m.meal_type_id || m.meal_type?.id,
        items,
        items_detail: items
      };
    });

    return {
      day_name: dayNames[new Date().getDay()],
      meals: mappedMeals
    };
  }
};
