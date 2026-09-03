/**
 * Warden Role Service
 * Scoped actions for block wardens (assigned hostels, resident directory, gate pass approval/rejection).
 */
import { supabase } from '../lib/supabase';
import type { HostelStudent, HostelIssue } from '../types';
import { adminService } from './adminService';

export const wardenService = {
  /**
   * Fetch scoped stats for the logged-in warden's assigned hostels
   */
  async getDashboardStats(userId?: string, hostelId?: number | string) {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData?.user?.id;
    }

    const managedHostelsRaw = await this.getAssignedHostels(resolvedUserId);
    const managedHostels = managedHostelsRaw.map((h: any) => ({
      id: h.id,
      name: h.name,
      gender: h.gender,
      floors: h.floor_count || h.floors || 3
    }));

    const targetHostelId = hostelId
      ? Number(hostelId)
      : managedHostels.length > 0 ? managedHostels[0].id : null;

    let targetStat: any = null;

    if (targetHostelId) {
      const { data: viewStats } = await supabase
        .from('view_warden_dashboard_stats')
        .select('*')
        .eq('hostel_id', targetHostelId)
        .maybeSingle();

      if (viewStats) {
        targetStat = viewStats;
      } else {
        // Fallback: calculate live stats for targetHostelId
        const [roomsRes, passesRes, issuesRes] = await Promise.all([
          supabase.from('hostel_rooms').select('id, capacity, is_active, beds(id, allocations:room_allocations(id, is_active))').eq('hostel_id', targetHostelId).eq('is_active', true),
          supabase.from('gate_passes').select('id', { count: 'exact', head: true }).eq('hostel_id', targetHostelId).eq('status', 'pending'),
          supabase.from('issues').select('id', { count: 'exact', head: true }).eq('hostel_id', targetHostelId).neq('status', 'completed')
        ]);

        const rooms = roomsRes.data || [];
        const totalRooms = rooms.length;
        let totalCap = 0;
        let occupied = 0;

        rooms.forEach((r: any) => {
          totalCap += (r.capacity || 0);
          (r.beds || []).forEach((b: any) => {
            if ((b.allocations || []).some((a: any) => a.is_active)) {
              occupied++;
            }
          });
        });

        targetStat = {
          hostel_id: targetHostelId,
          total_rooms: totalRooms,
          total_capacity: totalCap,
          occupied_beds: occupied,
          pending_gate_passes: passesRes.count || 0,
          open_issues: issuesRes.count || 0
        };
      }
    }

    const totalRooms = targetStat?.total_rooms || 0;
    const totalCap = targetStat?.total_capacity || 0;
    const occupied = targetStat?.occupied_beds || 0;
    const rate = totalCap > 0 ? Math.round((occupied / totalCap) * 100) : 0;

    return {
      managed_hostels: managedHostels,
      total_residents: occupied,
      total_rooms: totalRooms,
      total_capacity: totalCap,
      pending_gate_passes: targetStat?.pending_gate_passes || 0,
      open_issues: targetStat?.open_issues || 0,
      occupancy_rate: rate
    };
  },

  /**
   * Fetch scoped hostels assigned to the warden
   */
  async getAssignedHostels(userId?: string) {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData?.user?.id;
    }
    if (!resolvedUserId) return [];

    // 1. Primary: Check authoritative assignments table
    const { data: assignments } = await supabase
      .from('warden_hostel_assignments')
      .select('hostel_id, hostel:hostels(*)')
      .eq('warden_profile_id', resolvedUserId);

    let managedHostels = (assignments || []).map((a: any) => a.hostel).filter(Boolean);

    // 2. Secondary: Check direct warden_id on hostels table in Supabase
    const { data: directHostels } = await supabase
      .from('hostels')
      .select('*')
      .eq('is_active', true)
      .eq('warden_id', resolvedUserId);

    if (directHostels && directHostels.length > 0) {
      for (const dh of directHostels) {
        if (!managedHostels.some(h => String(h.id) === String(dh.id))) {
          managedHostels.push(dh);
        }
      }
    }

    // 3. Fallback: If no explicit assignment in DB for this warden, default to Boys Hostel or first active hostel
    if (managedHostels.length === 0) {
      const { data: allHostels } = await supabase.from('hostels').select('*').eq('is_active', true);
      if (allHostels && allHostels.length > 0) {
        const boysHostel = allHostels.find((h) => h.name.toLowerCase().includes('boys'));
        managedHostels = [boysHostel || allHostels[0]];
      }
    }

    return managedHostels;
  },

  /**
   * Fetch warden's residents with floor and hostel filtering
   */
  async getResidents(floorFilter = 'all', hostelId?: string | number): Promise<HostelStudent[]> {
    const students = await adminService.getStudents();
    let allotted = students.filter((s) => s.room_allotted);
    if (hostelId && hostelId !== 'all' && hostelId !== 'ALL') {
      allotted = allotted.filter((s) => String(s.hostel) === String(hostelId) || String((s.room_detail as any)?.hostel_id) === String(hostelId));
    }
    if (floorFilter && floorFilter !== 'all') {
      allotted = allotted.filter((s) => String(s.room_detail?.floor) === String(floorFilter));
    }
    return allotted;
  },

  /**
   * Fetch gate passes scoped for warden review directly from Supabase
   */
  async getGatePasses(hostelId?: string | number): Promise<any[]> {
    let query = supabase
      .from('gate_passes')
      .select('*, student:students(*), hostel:hostels(*), room:hostel_rooms(id, no, floor)')
      .order('created_at', { ascending: false });

    if (hostelId && hostelId !== 'ALL' && hostelId !== 'all') {
      query = query.eq('hostel_id', hostelId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching warden gate passes from Supabase:', error);
      return [];
    }

    return (data || []).map((gp: any) => ({
      ...gp,
      student_name: gp.student?.student_name || 'Resident Student',
      enrollment_no: gp.student?.enrollment_no || 'N/A',
      hostel_name: gp.hostel?.name || 'Hostel Block',
      room_no: gp.room?.no || '101',
      hostel_id: gp.hostel_id || gp.hostel?.id
    }));
  },

  /**
   * Action gate pass: Approve or Reject
   */
  async actionGatePass(passId: number, action: 'approve' | 'reject', note = '') {
    const fnName = action === 'approve' ? 'approve_gate_pass' : 'reject_gate_pass';
    try {
      const { data, error } = await supabase.rpc(fnName, {
        p_pass_id: passId,
        p_note: note
      });
      if (!error && data) return data;
    } catch (rpcErr) {
      console.warn(`RPC ${fnName} failed, falling back to direct update:`, rpcErr);
    }

    const { data: user } = await supabase.auth.getUser();
    const updatePayload: any = {
      status: action === 'approve' ? 'approved' : 'rejected',
      action_note: note,
      actioned_at: new Date().toISOString(),
      approved_by: user.user?.id || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('gate_passes')
      .update(updatePayload)
      .eq('id', passId)
      .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Fetch issues scoped to warden's assigned hostels directly from Supabase
   */
  async getIssues(hostelId?: string | number, statusFilter?: string): Promise<HostelIssue[]> {
    let query = supabase
      .from('issues')
      .select('*, student:students(*), hostel:hostels(id, name), room:hostel_rooms(id, no, floor), updates:issue_updates(*)')
      .order('created_at', { ascending: false });

    if (hostelId && hostelId !== 'ALL' && hostelId !== 'all') {
      query = query.eq('hostel_id', hostelId);
    }

    if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: issues, error } = await query;
    if (error) {
      console.warn('Error fetching issues from Supabase in wardenService:', error);
      return [];
    }

    let list = issues || [];

    return list.map((i: any) => {
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
        student_name: i.student?.student_name || i.student_name || 'Resident',
        enrollment_no: i.student?.enrollment_no || i.enrollment_no || 'N/A',
        hostel: i.hostel_id || i.hostel?.id,
        hostel_id: i.hostel_id || i.hostel?.id,
        hostel_name: i.hostel?.name || 'Aryabhata Bhavan (Boys Hostel)',
        room_no: i.room?.no || i.room_no || '101',
        updates: i.updates || []
      };
    });
  },

  /**
   * Update issue status directly in Supabase
   */
  async updateIssueStatus(issueId: number, status: string, note = '') {
    try {
      const { data, error } = await supabase.rpc('update_issue_status', {
        p_issue_id: issueId,
        p_new_status: status,
        p_note: note,
      });
      if (!error && data) return data;
    } catch (rpcErr) {
      console.warn('RPC update_issue_status error, falling back to direct table update:', rpcErr);
    }

    const { data: user } = await supabase.auth.getUser();
    const updatePayload: any = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'completed') {
      updatePayload.resolved_at = new Date().toISOString();
    }

    const { data: updatedIssue, error: updateErr } = await supabase
      .from('issues')
      .update(updatePayload)
      .eq('id', issueId)
      .select('*, student:students(*), hostel:hostels(id, name), room:hostel_rooms(id, no, floor)')
      .single();

    if (updateErr) throw updateErr;

    // Record audit update in issue_updates table
    try {
      await supabase.from('issue_updates').insert({
        issue_id: issueId,
        new_status: status,
        note: note || '',
        updated_by: user.user?.id || null,
      });
    } catch (auditErr) {
      console.warn('Failed to insert issue_update record:', auditErr);
    }

    return updatedIssue;
  }
};


