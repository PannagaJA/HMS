import { supabase } from '../lib/supabase';
import type { Announcement } from '../types';

export const announcementService = {

  async getUserHostelId(role: string, userId: string): Promise<number | null> {
    try {
      const userRole = (role || '').toUpperCase();
      if (userRole === 'STUDENT') {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '');
        let query = supabase
          .from('students')
          .select('id, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))');
        
        if (isUuid) {
          query = query.eq('profile_id', userId);
        } else {
          query = query.limit(1);
        }

        const { data } = await query.maybeSingle();

        const allocations = (data as any)?.allocations || [];
        const activeAlloc = allocations.find((a: any) => a.is_active);
        const hostelId = activeAlloc?.bed?.room?.hostel_id || allocations[0]?.bed?.room?.hostel_id || null;
        return hostelId ? Number(hostelId) : null;
      }
      if (userRole === 'WARDEN' || userRole === 'CARETAKER') {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '');
        if (isUuid) {
          const { data } = await supabase.from('warden_hostel_assignments').select('hostel_id').eq('warden_profile_id', userId).maybeSingle();
          return data?.hostel_id ? Number(data.hostel_id) : null;
        }
      }
    } catch (e) {
      console.warn('Could not determine user hostel for announcements', e);
    }
    return null;
  },

  async getAnnouncements(role: string, userId: string, page = 1, limit = 20): Promise<{ data: Announcement[], count: number }> {
    const userRole = (role || '').toUpperCase();
    const userHostelId = await this.getUserHostelId(role, userId);
    const now = Date.now();

    let query = supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (userRole && userRole !== 'ADMIN') {
      query = query.contains('target_roles', [userRole]);
    }

    const { data: allData, error } = await query;

    if (error) {
      console.error('Failed to fetch announcements:', error);
      throw error;
    }

    if (!allData || allData.length === 0) return { data: [], count: 0 };

    // Filter non-expired and hostel-appropriate announcements
    const filtered = allData.filter(a => {
      if (a.expires_at) {
        const expiry = new Date(a.expires_at).getTime();
        if (expiry <= now) return false;
      }
      if (['STUDENT', 'WARDEN', 'CARETAKER'].includes(userRole)) {
        if (userHostelId) {
          return a.target_hostel_id === null || Number(a.target_hostel_id) === Number(userHostelId);
        } else {
          return a.target_hostel_id === null;
        }
      }
      return true;
    });

    // Guarantee recent first
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalCount = filtered.length;
    const from = (page - 1) * limit;
    const pageData = filtered.slice(from, from + limit);

    if (pageData.length === 0) return { data: [], count: totalCount };

    // Fetch read status for these specific announcements for the current user
    const announcementIds = pageData.map(a => a.id);
    const { data: readData } = await supabase
      .from('announcements_read')
      .select('announcement_id')
      .eq('user_id', userId)
      .in('announcement_id', announcementIds);

    const readIds = new Set(readData?.map(r => r.announcement_id) || []);

    const dataWithReadStatus = pageData.map(a => ({
      ...a,
      is_read: readIds.has(a.id)
    }));

    return { data: dataWithReadStatus, count: totalCount };
  },

  async getSentAnnouncements(role: string, page = 1, limit = 20): Promise<{ data: Announcement[], count: number }> {
    const userRole = (role || '').toUpperCase();
    
    let query = supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (userRole !== 'ADMIN') {
      query = query.ilike('created_by_role', userRole);
    }

    const { data: allData, error } = await query;

    if (error) {
      console.error('Failed to fetch sent announcements:', error);
      throw error;
    }

    const list = (allData || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const totalCount = list.length;
    const from = (page - 1) * limit;
    const pageData = list.slice(from, from + limit);

    return { data: pageData, count: totalCount };
  },

  async deleteAnnouncement(id: string): Promise<void> {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Failed to delete announcement in DB:', error);
      throw error;
    }
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
      // Check if already marked to avoid duplicates
      const { data: existing } = await supabase
        .from('announcements_read')
        .select('id')
        .eq('announcement_id', announcementId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing) {
        await supabase
          .from('announcements_read')
          .insert([{ announcement_id: announcementId, user_id: userId }]);
      }
    } catch (error) {
      console.warn('Failed to mark announcement as read:', error);
    }
  },

  async getUnreadCount(role: string, userId: string): Promise<number> {
    try {
      const userRole = (role || '').toUpperCase();
      const nowIso = new Date().toISOString();

      let query = supabase
        .from('announcements')
        .select('id, target_roles, target_hostel_id, expires_at');

      if (userRole && userRole !== 'ADMIN') {
        query = query.contains('target_roles', [userRole]);
      }

      const { data: targeted, error: targetError } = await query;
        
      if (targetError) {
        console.warn('Error querying targeted announcements for unread count:', targetError);
        return 0;
      }
      if (!targeted || targeted.length === 0) return 0;

      const userHostelId = await this.getUserHostelId(role, userId);
      const validAnnouncements = targeted.filter(a => {
        if (a.expires_at && new Date(a.expires_at) <= new Date(nowIso)) {
          return false;
        }
        if (['STUDENT', 'WARDEN', 'CARETAKER'].includes(userRole)) {
          if (userHostelId) {
            return a.target_hostel_id === null || Number(a.target_hostel_id) === Number(userHostelId);
          } else {
            return a.target_hostel_id === null;
          }
        }
        return true;
      });

      if (validAnnouncements.length === 0) return 0;

      const targetedIds = validAnnouncements.map(t => t.id);

      // Get read announcements for this user
      const { data: readRows, error: readError } = await supabase
        .from('announcements_read')
        .select('announcement_id')
        .eq('user_id', userId)
        .in('announcement_id', targetedIds);
        
      if (readError) {
        console.warn('Error checking read rows for unread count:', readError);
        return targetedIds.length;
      }

      const readIds = new Set(readRows?.map(r => r.announcement_id) || []);
      const unreadCount = targetedIds.filter(id => !readIds.has(id)).length;
      return Math.max(0, unreadCount);
    } catch (err) {
      console.error('Failed to get unread count:', err);
      return 0;
    }
  }
};
