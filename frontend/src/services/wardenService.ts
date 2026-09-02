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
    const { data, error } = await supabase.rpc(fnName, {
      p_pass_id: passId,
      p_note: note
    });
    if (error) throw error;
    return data;
  }
};
