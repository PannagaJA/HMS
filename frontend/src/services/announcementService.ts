import { supabase } from '../lib/supabase';
import type { Announcement } from '../types';

export const announcementService = {

  async getUserHostelId(role: string, userId: string): Promise<number | null> {
    try {
      const userRole = (role || '').toUpperCase();
      if (userRole === 'STUDENT') {
        let studentData: any = null;
        const allocSelect = 'id, allocations:room_allocations(id, is_active, bed:beds(room:hostel_rooms(id, hostel_id)))';

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '');
        if (isUuid) {
          const { data } = await supabase.from('students').select(allocSelect).eq('profile_id', userId).maybeSingle();
          if (data) studentData = data;
        }

        if (!studentData) {
          try {
            const stored = localStorage.getItem('hms_user');
            const userObj = stored ? JSON.parse(stored) : null;
            const email = userObj?.email;
            if (email) {
              const { data: byEmail } = await supabase.from('students').select(allocSelect).ilike('email', email).maybeSingle();
              if (byEmail) studentData = byEmail;

              if (!studentData) {
                const usnPrefix = email.split('@')[0];
                const { data: byUsn } = await supabase.from('students').select(allocSelect).ilike('enrollment_no', usnPrefix).maybeSingle();
                if (byUsn) studentData = byUsn;
              }
            }
          } catch {
            // ignore JSON parse errors
          }
        }

        const allocations = studentData?.allocations || [];
        const activeAlloc = allocations.find((a: any) => a.is_active) || allocations[0];
        const bed = Array.isArray(activeAlloc?.bed) ? activeAlloc.bed[0] : activeAlloc?.bed;
        const room = Array.isArray(bed?.room) ? bed.room[0] : bed?.room;
        const hostelId = room?.hostel_id || null;
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

    const { data: allData, error } = await query;

    if (error) {
      console.error('Failed to fetch announcements:', error);
      throw error;
    }

    if (!allData || allData.length === 0) return { data: [], count: 0 };

    // Filter non-expired, role-targeted, and hostel-appropriate announcements
    const filtered = allData.filter(a => {
      if (a.expires_at) {
        const expiry = new Date(a.expires_at).getTime();
        if (expiry <= now) return false;
      }
      if (userRole && userRole !== 'ADMIN') {
        const roles = (a.target_roles || []).map((r: string) => String(r).toUpperCase());
        if (roles.length > 0 && !roles.includes(userRole) && !roles.includes('ALL')) {
          return false;
        }
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
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('announcements')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (userRole !== 'ADMIN') {
      query = query.eq('created_by_role', role);
    }

    const { data, count, error } = await query.range(from, to);

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

    if (error) {
      console.error('Failed to delete announcement in DB:', error);
      throw error;
    }
  },

  async createAnnouncement(data: Partial<Announcement>): Promise<Announcement> {
    const newAnnouncement = {
      title: data.title,
      message: data.message,
      priority: data.priority || 'low',
      target_roles: data.target_roles || [],
      created_by_role: data.created_by_role,
      created_by_name: data.created_by_name,
      is_circular: data.is_circular || false,
      target_hostel_id: data.target_hostel_id || null,
      expires_at: data.expires_at || null,
    } as Announcement;

    const { is_read, ...insertData } = newAnnouncement;

    const { data: created, error } = await supabase
      .from('announcements')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('Failed to create announcement in DB:', error);
      throw error;
    }

    return created;
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

      const { data: targeted, error: targetError } = await supabase
        .from('announcements')
        .select('id, target_roles, target_hostel_id, expires_at');
        
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
        if (userRole && userRole !== 'ADMIN') {
          const roles = (a.target_roles || []).map((r: string) => String(r).toUpperCase());
          if (roles.length > 0 && !roles.includes(userRole) && !roles.includes('ALL')) {
            return false;
          }
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
