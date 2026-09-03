import { supabase } from '../lib/supabase';
import type { Announcement } from '../types';

export const announcementService = {

  async getUserHostelId(role: string, userId: string): Promise<number | null> {
    try {
      if (role === 'STUDENT') {
        const { data } = await supabase.from('students').select('hostel_id').eq('profile_id', userId).single();
        return data?.hostel_id || null;
      }
      if (role === 'WARDEN' || role === 'CARETAKER') {
        const { data } = await supabase.from('warden_hostel_assignments').select('hostel_id').eq('warden_profile_id', userId).single();
        return data?.hostel_id || null;
      }
    } catch (e) {
      console.warn('Could not determine user hostel for announcements', e);
    }
    return null;
  },

  async getAnnouncements(role: string, userId: string, page = 1, limit = 20): Promise<{ data: Announcement[], count: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    const userHostelId = await this.getUserHostelId(role, userId);
    
    let query = supabase
      .from('announcements')
      .select('*', { count: 'exact' })
      .contains('target_roles', [role])
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false });

    if (userHostelId) {
      query = query.or(`target_hostel_id.is.null,target_hostel_id.eq.${userHostelId}`);
    } else if (role === 'STUDENT' || role === 'WARDEN' || role === 'CARETAKER') {
      query = query.is('target_hostel_id', null);
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
      console.error('Failed to fetch announcements:', error);
      throw error;
    }

    if (!data || data.length === 0) return { data: [], count: 0 };

    // Fetch read status for these specific announcements for the current user
    const announcementIds = data.map(a => a.id);
    const { data: readData } = await supabase
      .from('announcements_read')
      .select('announcement_id')
      .eq('user_id', userId)
      .in('announcement_id', announcementIds);

    const readIds = new Set(readData?.map(r => r.announcement_id) || []);

    const dataWithReadStatus = data.map(a => ({
      ...a,
      is_read: readIds.has(a.id)
    }));

    return { data: dataWithReadStatus, count: count || 0 };
  },

  async getSentAnnouncements(role: string, page = 1, limit = 20): Promise<{ data: Announcement[], count: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    const { data, count, error } = await supabase
      .from('announcements')
      .select('*', { count: 'exact' })
      .eq('created_by_role', role)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Failed to fetch sent announcements:', error);
      throw error;
    }
    return { data: data || [], count: count || 0 };
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async createAnnouncement(data: Partial<Announcement>): Promise<Announcement> {
    const newAnnouncement = {
      ...data,
      id: Math.random().toString(36).substring(7),
      created_at: new Date().toISOString(),
      is_read: false
    } as Announcement;

    const { is_read, ...insertData } = newAnnouncement;

    const { data: insertedData, error } = await supabase
      .from('announcements')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('Failed to create announcement in DB:', error);
      throw error;
    }
    // Return with is_read set for client-side state
    return { ...insertedData, is_read: false };
  },

  async markAsRead(announcementId: string, userId: string): Promise<void> {
    try {
      await supabase
        .from('announcements_read')
        .insert([{ announcement_id: announcementId, user_id: userId }]);
    } catch (error) {
      console.warn('Failed to mark announcement as read:', error);
    }
  },

  async getUnreadCount(role: string, userId: string): Promise<number> {
    try {
      const userHostelId = await this.getUserHostelId(role, userId);

      // Get all targeted active announcements for this role
      let query = supabase
        .from('announcements')
        .select('id')
        .contains('target_roles', [role])
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
        
      if (userHostelId) {
        query = query.or(`target_hostel_id.is.null,target_hostel_id.eq.${userHostelId}`);
      } else if (role === 'STUDENT' || role === 'WARDEN' || role === 'CARETAKER') {
        query = query.is('target_hostel_id', null);
      }

      const { data: targeted, error: targetError } = await query;
        
      if (targetError) throw targetError;
      if (!targeted || targeted.length === 0) return 0;

      const targetedIds = targeted.map(t => t.id);

      // Get read announcements for this user
      const { count: readCount, error: readError } = await supabase
        .from('announcements_read')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('announcement_id', targetedIds);
        
      if (readError) throw readError;

      const unreadCount = targetedIds.length - (readCount || 0);
      return Math.max(0, unreadCount);
    } catch (err) {
      console.error('Failed to get unread count:', err);
      return 0;
    }
  }
};
