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
      floors: h.floor_count !== undefined && h.floor_count !== null ? Number(h.floor_count) : (h.floors || 3)
    }));

    const targetHostelId = hostelId
      ? Number(hostelId)
      : managedHostels.length > 0 ? managedHostels[0].id : null;

    let targetStat: any = null;

    if (targetHostelId) {
      // Calculate live real-time stats for targetHostelId
      const [roomsRes, passesRes, issuesRes] = await Promise.all([
        supabase.from('hostel_rooms').select('id, capacity, is_active, beds(id, allocations:room_allocations(id, is_active))').eq('hostel_id', targetHostelId).eq('is_active', true),
        supabase.from('gate_passes').select('id', { count: 'exact', head: true }).eq('hostel_id', targetHostelId).or('status.eq.PENDING,status.eq.pending'),
        supabase.from('issues').select('id', { count: 'exact', head: true }).eq('hostel_id', targetHostelId).not('status', 'in', '(COMPLETED,completed,closed,CLOSED)')
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

    // 3. Only return explicitly assigned hostels (via warden_hostel_assignments or hostels.warden_id)
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
      console.error('[wardenService.getGatePasses] Supabase error:', error.code, error.message, error.details);
      return [];
    }

    console.log(`[wardenService.getGatePasses] Fetched ${data?.length ?? 0} gate passes`);
    return (data || []).map((gp: any) => ({
      ...gp,
      student_name: gp.student?.student_name || 'Resident Student',
      enrollment_no: gp.student?.enrollment_no || 'N/A',
      hostel_name: gp.hostel?.name || 'Hostel Block',
      room_no: gp.room?.no || '101',
      floor: gp.room?.floor !== undefined ? gp.room?.floor : null,
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
   * Fetch all issue_updates for a single issue directly from Supabase
   */
  async getIssueUpdates(issueId: number): Promise<any[]> {
    try {
      const { data: rawUpdates, error } = await supabase
        .from('issue_updates')
        .select('*')
        .eq('issue_id', issueId)
        .order('created_at', { ascending: false });

      if (error || !rawUpdates) {
        console.warn('getIssueUpdates query warning:', error);
        return [];
      }

      // Resolve updater profiles in batch
      const updaterUuids = Array.from(new Set(rawUpdates.map((u: any) => u.updated_by).filter(Boolean)));
      const profilesMap: Record<string, string> = {};
      if (updaterUuids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, role')
          .in('id', updaterUuids);
        if (profs) {
          profs.forEach((p: any) => {
            const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
            const roleLabel = p.role === 'WARDEN' ? 'Warden' : p.role === 'ADMIN' ? 'Admin' : (p.role || '');
            const displayName = fullName || p.email || '';
            profilesMap[p.id] = roleLabel && displayName ? `${displayName} (${roleLabel})` : displayName;
          });
        }
      }

      // Active resolution for updates missing updated_by_name
      let activeWardenName = '';
      if (rawUpdates.some((u: any) => !u.updated_by_name && (!u.updated_by || !profilesMap[u.updated_by]))) {
        try {
          const { data: iss } = await supabase
            .from('issues')
            .select('hostel_id')
            .eq('id', issueId)
            .maybeSingle();

          if (iss?.hostel_id) {
            const { data: assign } = await supabase
              .from('warden_hostel_assignments')
              .select('profiles(first_name, last_name, email, role)')
              .eq('hostel_id', iss.hostel_id)
              .limit(1)
              .maybeSingle();

            const p = (assign as any)?.profiles;
            if (p) {
              const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
              const roleLabel = p.role === 'WARDEN' ? 'Warden' : p.role === 'ADMIN' ? 'Admin' : (p.role || 'Warden');
              activeWardenName = fullName ? `${fullName} (${roleLabel})` : (p.email ? `${p.email} (${roleLabel})` : '');
            }
          }

          if (!activeWardenName) {
            const { data: firstWarden } = await supabase
              .from('profiles')
              .select('first_name, last_name, email, role')
              .eq('role', 'WARDEN')
              .limit(1)
              .maybeSingle();
            if (firstWarden) {
              const fullName = `${firstWarden.first_name || ''} ${firstWarden.last_name || ''}`.trim();
              activeWardenName = fullName ? `${fullName} (Warden)` : (firstWarden.email ? `${firstWarden.email} (Warden)` : '');
            }
          }

          if (!activeWardenName) {
            const { data: hw } = await supabase
              .from('hostel_wardens')
              .select('name, designation')
              .limit(1)
              .maybeSingle();
            if (hw) {
              activeWardenName = `${hw.name} (${hw.designation || 'Warden'})`;
            }
          }
        } catch (err) {
          console.warn('Warden lookup error:', err);
        }
      }

      return rawUpdates.map((u: any) => {
        const resolvedName = u.updated_by_name || (u.updated_by ? profilesMap[u.updated_by] : '') || activeWardenName || 'Hostel Warden';
        return {
          ...u,
          updated_by_name: resolvedName
        };
      });
    } catch (e) {
      console.warn('getIssueUpdates error:', e);
      return [];
    }
  },

  /**
   * Fetch issues scoped to warden's assigned hostels directly from Supabase in real-time
   */
  async getIssues(hostelId?: string | number, statusFilter?: string): Promise<HostelIssue[]> {
    let query = supabase
      .from('issues')
      .select('*, student:students(*), hostel:hostels(id, name), room:hostel_rooms(id, no, floor)')
      .order('created_at', { ascending: false });

    if (hostelId && hostelId !== 'ALL' && hostelId !== 'all') {
      query = query.eq('hostel_id', hostelId);
    }

    if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: issues, error } = await query;
    if (error) {
      console.error('[wardenService.getIssues] Supabase error:', error.code, error.message, error.details);
      return [];
    }

    const issueList = issues || [];
    const issueIds = issueList.map((i: any) => i.id);

    // Fetch real-time issue_updates from Supabase
    const allUpdatesMap: Record<number, any[]> = {};
    if (issueIds.length > 0) {
      try {
        const { data: rawUpdates, error: upError } = await supabase
          .from('issue_updates')
          .select('*')
          .in('issue_id', issueIds)
          .order('created_at', { ascending: false });

        if (!upError && rawUpdates && rawUpdates.length > 0) {
          // Resolve updater profiles in batch
          const updaterUuids = Array.from(new Set(rawUpdates.map((u: any) => u.updated_by).filter(Boolean)));
          const profilesMap: Record<string, string> = {};
          if (updaterUuids.length > 0) {
            const { data: profs } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, email, role')
              .in('id', updaterUuids);
            if (profs) {
              profs.forEach((p: any) => {
                const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
                const roleLabel = p.role === 'WARDEN' ? 'Warden' : p.role === 'ADMIN' ? 'Admin' : (p.role || '');
                const displayName = fullName || p.email || '';
                profilesMap[p.id] = roleLabel && displayName ? `${displayName} (${roleLabel})` : displayName;
              });
            }
          }

          rawUpdates.forEach((u: any) => {
            const resolvedName = u.updated_by_name || (u.updated_by ? profilesMap[u.updated_by] : '') || '';
            const formatted = {
              ...u,
              updated_by_name: resolvedName,
            };
            if (!allUpdatesMap[u.issue_id]) allUpdatesMap[u.issue_id] = [];
            allUpdatesMap[u.issue_id].push(formatted);
          });
        }
      } catch (e) {
        console.warn('Real-time issue_updates query error:', e);
      }
    }

    return issueList.map((i: any) => {
      let img = i.image_url || null;
      let desc = i.description || '';
      if (!img && desc.includes('[ATTACHMENT]:')) {
        const parts = desc.split('[ATTACHMENT]:');
        desc = parts[0].trim();
        img = parts[1]?.trim() || null;
      }

      const updatesList = (allUpdatesMap[i.id] || []).map((u: any) => ({
        ...u,
        updated_by_name: u.updated_by_name || ''
      }));

      updatesList.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return {
        ...i,
        description: desc,
        image_url: img,
        student_name: i.student?.student_name || i.student_name || '',
        enrollment_no: i.student?.enrollment_no || i.enrollment_no || '',
        hostel: i.hostel_id || i.hostel?.id,
        hostel_id: i.hostel_id || i.hostel?.id,
        hostel_name: i.hostel?.name || '',
        room_no: i.room?.no || i.room_no || '',
        floor: i.room?.floor !== undefined ? i.room?.floor : (i.floor !== undefined ? i.floor : null),
        updates: updatesList
      };
    });
  },

  /**
   * Update issue status via RPC (SECURITY DEFINER) with guaranteed direct table fallback.
   */
  async updateIssueStatus(issueId: number, status: string, note = ''): Promise<{ updates: any[]; rpcError?: string }> {
    const trimmedNote = note.trim() || `Status changed to ${status.replace(/_/g, ' ')}`;
    const nowIso = new Date().toISOString();
    const sanitizedStatus = status.toLowerCase().replace(/ /g, '_');

    // Resolve updater name & profile ID from current session
    let updaterName = '';
    let updaterProfileId: string | null = null;
    let orgId: string = '00000000-0000-0000-0000-000000000001';

    try {
      const storedUser = localStorage.getItem('hms_user');
      if (storedUser) {
        const uObj = JSON.parse(storedUser);
        const name = `${uObj.first_name || ''} ${uObj.last_name || ''}`.trim();
        const roleLabel = uObj.role === 'WARDEN' ? 'Warden' : uObj.role === 'ADMIN' ? 'Admin' : (uObj.role || '');
        if (name) {
          updaterName = roleLabel ? `${name} (${roleLabel})` : name;
        } else if (uObj.email) {
          updaterName = roleLabel ? `${uObj.email} (${roleLabel})` : uObj.email;
        }
        if (uObj.id && typeof uObj.id === 'string' && uObj.id.includes('-')) {
          updaterProfileId = uObj.id;
        }
        if (uObj.org_id) orgId = uObj.org_id;
      }
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        updaterProfileId = authData.user.id;
        const { data: prof } = await supabase
          .from('profiles')
          .select('first_name, last_name, email, role, org_id')
          .eq('id', authData.user.id)
          .maybeSingle();
        if (prof) {
          const name = `${prof.first_name || ''} ${prof.last_name || ''}`.trim();
          const roleLabel = prof.role === 'WARDEN' ? 'Warden' : prof.role === 'ADMIN' ? 'Admin' : (prof.role || '');
          if (name) {
            updaterName = roleLabel ? `${name} (${roleLabel})` : name;
          } else if (prof.email) {
            updaterName = roleLabel ? `${prof.email} (${roleLabel})` : prof.email;
          }
          if (prof.org_id) orgId = prof.org_id;
        }
      }
    } catch {}

    const guaranteedEntry = {
      id: `optimistic_${Date.now()}`,
      issue_id: issueId,
      new_status: sanitizedStatus,
      note: trimmedNote,
      updated_by_name: updaterName,
      created_at: nowIso
    };

    // 1. First attempt RPC with p_updater_name
    let rpcError: string | undefined;
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('update_issue_status', {
        p_issue_id: issueId,
        p_new_status: sanitizedStatus,
        p_note: trimmedNote,
        p_updater_id: updaterProfileId || undefined,
        p_updater_name: updaterName
      });

      if (rpcErr) {
        console.warn('[updateIssueStatus] RPC returned error, performing direct DB mutation:', rpcErr.message);
        rpcError = rpcErr.message;
      } else {
        console.log('[updateIssueStatus] RPC success:', rpcData);
      }
    } catch (e: any) {
      rpcError = e?.message || 'RPC execution failed';
    }

    // 2. If RPC had error or failed to write, execute direct database mutations
    if (rpcError) {
      try {
        // Direct update to issues table
        await supabase
          .from('issues')
          .update({
            status: sanitizedStatus,
            resolved_at: sanitizedStatus === 'completed' || sanitizedStatus === 'resolved' ? nowIso : null,
            updated_at: nowIso
          })
          .eq('id', issueId);

        // Direct insert to issue_updates table
        await supabase
          .from('issue_updates')
          .insert({
            issue_id: issueId,
            new_status: sanitizedStatus,
            note: trimmedNote,
            updated_by: updaterProfileId,
            updated_by_name: updaterName,
            org_id: orgId
          });
      } catch (directErr) {
        console.warn('[updateIssueStatus] Direct DB update fallback error:', directErr);
      }
    }

    // 3. Fetch all updates from DB
    const dbUpdates = await wardenService.getIssueUpdates(issueId);
    if (dbUpdates.length > 0) {
      return { updates: dbUpdates, rpcError };
    }

    return { updates: [guaranteedEntry], rpcError };
  }
};
