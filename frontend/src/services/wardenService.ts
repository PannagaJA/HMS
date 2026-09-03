/**
 * Warden Role Service
 * Scoped actions for block wardens (assigned hostels, resident directory, gate pass approval/rejection).
 */
import { supabase } from '../lib/supabase';
import type { HostelStudent } from '../types';
import { adminService } from './adminService';

export const wardenService = {
  /**
   * Fetch scoped stats for the logged-in warden's assigned hostels
   */
  async getDashboardStats(userId?: string) {
    const { data: assignments } = await supabase
      .from('warden_hostel_assignments')
      .select('hostel_id, hostel:hostels(*)')
      .eq('warden_profile_id', userId || '');

    const managedHostels = (assignments || []).map((a: any) => a.hostel).filter(Boolean);
    const { data: viewStats } = await supabase.from('view_warden_dashboard_stats').select('*');
    const primary = (viewStats && viewStats.length > 0) ? viewStats[0] : null;

    const totalCap = primary?.total_capacity || 0;
    const occupied = primary?.occupied_beds || 0;
    const rate = totalCap > 0 ? Math.round((occupied / totalCap) * 100) : 0;

    return {
      managed_hostels: managedHostels,
      total_rooms: primary?.total_rooms || 0,
      total_capacity: totalCap,
      pending_gate_passes: primary?.pending_gate_passes || 0,
      open_issues: primary?.open_issues || 0,
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

    // 3. Only if completely empty in DB (e.g. offline mock testing): check localStorage with exact ID match
    if (managedHostels.length === 0) {
      try {
        const localHostels: any[] = JSON.parse(localStorage.getItem('hms_custom_hostels') || '[]');
        const matched = localHostels.filter((lh: any) => {
          return lh.is_active !== false && String(lh.warden || lh.warden_id || '') === String(resolvedUserId);
        });
        if (matched.length > 0) {
          managedHostels = matched;
        }
      } catch (e) {
        console.warn('Error reading local hostels:', e);
      }
    }

    return managedHostels;
  },

  /**
   * Fetch warden's residents with floor filtering
   */
  async getResidents(floorFilter = 'all'): Promise<HostelStudent[]> {
    const students = await adminService.getStudents();
    let allotted = students.filter((s) => s.room_allotted);
    if (floorFilter && floorFilter !== 'all') {
      allotted = allotted.filter((s) => String(s.room_detail?.floor) === String(floorFilter));
    }
    return allotted;
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
  }
};
