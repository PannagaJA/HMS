/**
 * Shared Facilities & Operations Service
 * Maintenance tickets and dining menu schedules.
 */
import { supabase } from '../lib/supabase';
import type { MealType, MenuItem, Menu, HostelIssue } from '../types';

export const diningService = {
  async getMealTypes(): Promise<MealType[]> {
    const { data, error } = await supabase.from('meal_types').select('*').order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getMenuItems(): Promise<MenuItem[]> {
    const { data, error } = await supabase.from('menu_items').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getWeeklyMenus(): Promise<Menu[]> {
    const { data, error } = await supabase
      .from('menus')
      .select('*, meal_type:meal_types(*), links:menu_item_links(item:menu_items(*))');
    if (error) throw error;
    return (data || []).map((m: any) => ({
      ...m,
      items: (m.links || []).map((l: any) => l.item).filter(Boolean)
    }));
  }
};

export const issueService = {
  async getIssues(): Promise<HostelIssue[]> {
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no), updates:issue_updates(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    return (issues || []).map((i: any) => ({
      ...i,
      student_name: i.student?.student_name || 'Resident',
      enrollment_no: i.student?.enrollment_no || 'N/A',
      hostel_name: i.hostel?.name || 'Block A',
      room_no: i.room?.no || '101',
      updates: i.updates || []
    }));
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
