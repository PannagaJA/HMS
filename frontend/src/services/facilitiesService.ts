/**
 * Shared Facilities & Operations Service
 * Maintenance tickets and dining menu schedules.
 */
import { supabase } from '../lib/supabase';
import type { MealType, MenuItem, Menu, HostelIssue } from '../types';

export const diningService = {
  async getMealTypes(): Promise<MealType[]> {
    const { data, error } = await supabase.from('meal_types').select('*').order('id', { ascending: true });
    if (error || !data || data.length === 0) {
      return [
        { id: 1, name: 'BR', description: 'Breakfast', time_from: '07:30:00', time_to: '09:30:00', start_time: '07:30', end_time: '09:30' },
        { id: 2, name: 'LN', description: 'Lunch', time_from: '12:30:00', time_to: '14:30:00', start_time: '12:30', end_time: '14:30' },
        { id: 3, name: 'SN', description: 'Evening Snacks & Tea', time_from: '17:00:00', time_to: '18:30:00', start_time: '17:00', end_time: '18:30' },
        { id: 4, name: 'DN', description: 'Dinner', time_from: '20:00:00', time_to: '22:00:00', start_time: '20:00', end_time: '22:00' },
      ] as any;
    }
    return data;
  },

  async getMenuItems(): Promise<MenuItem[]> {
    const { data, error } = await supabase.from('menu_items').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createMenuItem(payload: { name: string; category?: string; description?: string; is_veg?: boolean }) {
    const { data, error } = await supabase.from('menu_items').insert({
      name: payload.name,
      category: payload.category || 'Main Course',
      description: payload.description || '',
      vegetarian: payload.is_veg ?? true
    }).select().single();
    if (error) throw error;
    return data;
  },

  async updateMenuItem(id: number | string, payload: Partial<{ name: string; category: string; description: string; is_veg: boolean }>) {
    const updateBody: any = { ...payload };
    if ('is_veg' in payload) {
      updateBody.vegetarian = payload.is_veg;
      delete updateBody.is_veg;
    }
    const { data, error } = await supabase.from('menu_items').update(updateBody).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteMenuItem(id: number | string) {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async getWeeklyMenus(hostelId?: number | string): Promise<Menu[]> {
    let query = supabase
      .from('menus')
      .select('*, meal_type:meal_types(*), links:menu_item_links(item:menu_items(*))');
    if (hostelId) {
      query = query.eq('hostel_id', Number(hostelId));
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((m: any) => {
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
  },

  async getTodayMenu(): Promise<{ day_name: string; day_id: string; meals: Menu[] }> {
    const jsDay = new Date().getDay();
    const appDayId = String((jsDay + 6) % 7);
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const currentDayName = dayNames[(jsDay + 6) % 7];

    const { data, error } = await supabase
      .from('menus')
      .select('*, meal_type:meal_types(*), links:menu_item_links(item:menu_items(*))')
      .eq('day_of_week', appDayId);

    if (error) {
      console.warn('Error fetching today menu:', error);
    }

    const meals = (data || []).map((m: any) => {
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
      day_name: currentDayName,
      day_id: appDayId,
      meals
    };
  },

  async getTodaySkips(studentId?: number): Promise<number[]> {
    let resolvedStudentId = studentId;
    if (!resolvedStudentId) {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      if (userId) {
        const { data: st } = await supabase.from('students').select('id').eq('profile_id', userId).maybeSingle();
        if (st) resolvedStudentId = st.id;
      }
    }

    if (!resolvedStudentId) return [];

    const todayStr = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('student_meal_skips')
      .select('meal_type_id')
      .eq('student_id', resolvedStudentId)
      .eq('date', todayStr);

    if (error) {
      console.warn('Error fetching meal skips:', error);
      return [];
    }

    return (data || []).map((d: any) => Number(d.meal_type_id));
  },

  async recordMealSkip(payload: { date?: string; meal_type: number | string; skip_type?: string; reason?: string }) {
    const { data: user } = await supabase.auth.getUser();
    const userId = user.user?.id;

    let student: any = null;
    if (userId) {
      const { data } = await supabase
        .from('students')
        .select('id, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))')
        .eq('profile_id', userId)
        .maybeSingle();
      if (data) student = data;
    }

    if (!student) {
      const { data } = await supabase
        .from('students')
        .select('id, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))')
        .limit(1)
        .maybeSingle();
      if (data) student = data;
    }

    if (!student) {
      throw new Error('Student record not found for recording meal skip');
    }

    const activeAlloc: any = (student.allocations || []).find((a: any) => a.is_active) || student.allocations?.[0];
    const bed: any = Array.isArray(activeAlloc?.bed) ? activeAlloc.bed[0] : activeAlloc?.bed;
    const room: any = Array.isArray(bed?.room) ? bed.room[0] : bed?.room;
    let hostelId = room?.hostel_id;

    if (!hostelId) {
      const { data: defaultHostel } = await supabase.from('hostels').select('id').limit(1).maybeSingle();
      hostelId = defaultHostel?.id || 1;
    }

    const todayStr = payload.date || new Date().toISOString().split('T')[0];
    const mealTypeId = Number(payload.meal_type);

    const { data, error } = await supabase
      .from('student_meal_skips')
      .upsert({
        student_id: student.id,
        hostel_id: hostelId,
        date: todayStr,
        meal_type_id: mealTypeId,
        skip_type: payload.skip_type || 'SKIP',
        reason: payload.reason || 'Opted out from portal',
        approved: true
      }, { onConflict: 'student_id,date,meal_type_id' })
      .select()
      .single();

    if (error) {
      console.warn('Error recording meal skip in Supabase:', error);
    }

    return { success: true, skip: data };
  },

  async cancelMealSkip(mealTypeId: number | string, date?: string) {
    const { data: user } = await supabase.auth.getUser();
    const userId = user.user?.id;

    let studentId: number | null = null;
    if (userId) {
      const { data } = await supabase.from('students').select('id').eq('profile_id', userId).maybeSingle();
      if (data) studentId = data.id;
    }

    if (!studentId) {
      const { data } = await supabase.from('students').select('id').limit(1).maybeSingle();
      if (data) studentId = data.id;
    }

    if (!studentId) return { success: false };

    const todayStr = date || new Date().toISOString().split('T')[0];
    const mealIdNum = Number(mealTypeId);

    const { error } = await supabase
      .from('student_meal_skips')
      .delete()
      .eq('student_id', studentId)
      .eq('date', todayStr)
      .eq('meal_type_id', mealIdNum);

    if (error) console.warn('Error canceling meal skip:', error);
    return { success: true };
  },

  async saveMenuSlot(dayOfWeek: number | string, mealTypeId: number | string, itemIds: (number | string)[], hostelId?: number | string) {
    const dayStr = String(dayOfWeek);
    const mealIdNum = Number(mealTypeId);

    let targetHostelId = hostelId ? Number(hostelId) : null;
    if (!targetHostelId) {
      const { data: hostel } = await supabase.from('hostels').select('id').limit(1).maybeSingle();
      targetHostelId = hostel?.id || 1;
    }

    // 1. Find or create menu entry for hostel, day_of_week and meal_type
    let menuId: number | null = null;
    const { data: existing, error: findError } = await supabase
      .from('menus')
      .select('id')
      .eq('hostel_id', targetHostelId)
      .eq('day_of_week', dayStr)
      .eq('meal_type_id', mealIdNum)
      .maybeSingle();

    if (findError) {
      console.warn('Error finding menu slot:', findError);
    }

    if (existing) {
      menuId = existing.id;
    } else {
      const { data: inserted, error } = await supabase
        .from('menus')
        .insert({
          hostel_id: targetHostelId,
          day_of_week: dayStr,
          meal_type_id: mealIdNum,
          is_recurring: true
        })
        .select()
        .single();
      if (error) throw error;
      menuId = inserted.id;
    }

    if (menuId) {
      // 2. Clear old item links and insert new links
      const { error: delError } = await supabase.from('menu_item_links').delete().eq('menu_id', menuId);
      if (delError) {
        console.warn('Error deleting old menu item links:', delError);
      }

      if (itemIds.length > 0) {
        const linkInserts = itemIds.map(itemId => ({
          menu_id: menuId,
          item_id: Number(itemId)
        }));
        const { error: insertError } = await supabase.from('menu_item_links').insert(linkInserts);
        if (insertError) throw insertError;
      }
    }
    return { success: true, menu_id: menuId };
  }
};

export const issueService = {
  async getIssues(studentId?: number): Promise<HostelIssue[]> {
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
      .from('issues')
      .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no), updates:issue_updates(*)')
      .order('created_at', { ascending: false });

    if (resolvedStudentId) {
      query = query.eq('student_id', resolvedStudentId);
    }

    const { data: issues, error } = await query;
    if (error) {
      console.warn('Error fetching issues:', error);
      return [];
    }

    return (issues || []).map((i: any) => {
      let img = i.image_url;
      let desc = i.description || '';
      if (!img && desc.includes('[ATTACHMENT]:')) {
        const parts = desc.split('[ATTACHMENT]:');
        desc = parts[0].trim();
        img = parts[1].trim();
      }
      return {
        ...i,
        description: desc,
        image_url: img,
        student_name: i.student?.student_name || 'Resident',
        enrollment_no: i.student?.enrollment_no || 'N/A',
        hostel_name: i.hostel?.name || 'Block A',
        room_no: i.room?.no || '101',
        updates: i.updates || []
      };
    });
  },

  async createIssue(payload: { title: string; category: string; description: string; priority?: string; image_url?: string }) {
    const { data: user } = await supabase.auth.getUser();
    const userId = user.user?.id;

    // Find student record and their active room allocation
    let student: any = null;
    if (userId) {
      const { data } = await supabase
        .from('students')
        .select('id, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))')
        .eq('profile_id', userId)
        .maybeSingle();
      if (data) student = data;
    }

    if (!student) {
      const { data } = await supabase
        .from('students')
        .select('id, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))')
        .limit(1)
        .maybeSingle();
      if (data) student = data;
    }

    if (!student) {
      throw new Error('Could not identify resident student record for issue reporting');
    }

    const activeAlloc: any = (student.allocations || []).find((a: any) => a.is_active) || student.allocations?.[0];
    const bed: any = Array.isArray(activeAlloc?.bed) ? activeAlloc.bed[0] : activeAlloc?.bed;
    const room: any = Array.isArray(bed?.room) ? bed.room[0] : bed?.room;
    
    let roomId = room?.id;
    let hostelId = room?.hostel_id;

    if (!roomId || !hostelId) {
      const { data: defaultRoom } = await supabase.from('hostel_rooms').select('id, hostel_id').limit(1).maybeSingle();
      roomId = roomId || defaultRoom?.id || 1;
      hostelId = hostelId || defaultRoom?.hostel_id || 1;
    }

    const insertBody: any = {
      student_id: student.id,
      hostel_id: hostelId,
      room_id: roomId,
      title: payload.title,
      category: (payload.category || 'OTHER').toUpperCase(),
      description: payload.description,
      status: 'pending'
    };

    if (payload.image_url) {
      insertBody.image_url = payload.image_url;
    }

    let insertRes = await supabase
      .from('issues')
      .insert(insertBody)
      .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no), updates:issue_updates(*)')
      .single();

    // Fallback if image_url column is not yet present on remote DB
    if (insertRes.error && (insertRes.error.message?.includes('image_url') || insertRes.error.code === '42703')) {
      delete insertBody.image_url;
      insertBody.description = `${payload.description}\n\n[ATTACHMENT]: ${payload.image_url}`;
      insertRes = await supabase
        .from('issues')
        .insert(insertBody)
        .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no), updates:issue_updates(*)')
        .single();
    }

    if (insertRes.error) {
      console.error('Supabase issue create error:', insertRes.error);
      throw insertRes.error;
    }

    const data = insertRes.data;
    return {
      ...data,
      image_url: data.image_url || payload.image_url,
      student_name: data.student?.student_name || 'Resident',
      enrollment_no: data.student?.enrollment_no || 'N/A',
      hostel_name: data.hostel?.name || 'Block A',
      room_no: data.room?.no || '101',
      updates: data.updates || []
    };
  },

  async updateStatus(issueId: number, status: string, note = '') {
    const { data, error } = await supabase.rpc('update_issue_status', {
      p_issue_id: issueId,
      p_new_status: status,
      p_note: note
    });
    if (error) throw error;
    return data;
  }
};
