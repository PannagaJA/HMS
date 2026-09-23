/**
 * Warden Role Service
 * Scoped actions for block wardens (assigned hostels, resident directory, gate pass approval/rejection).
 */
import { supabase } from '../lib/supabase';
import type { HostelStudent, HostelIssue } from '../types';
import { adminService } from './adminService';

const inFlightGatePasses = new Map<string, Promise<any[]>>();
const inFlightIssues = new Map<string, Promise<HostelIssue[]>>();
const inFlightAssignedHostels = new Map<string, Promise<any[]>>();
const inFlightWardenStats = new Map<string, Promise<any>>();

export const wardenService = {
  /**
   * Fetch scoped stats for the logged-in warden's assigned hostels
   */
  async getDashboardStats(userId?: string, hostelId?: number | string) {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      try {
        const stored = localStorage.getItem('hms_user');
        if (stored) {
          resolvedUserId = JSON.parse(stored)?.id;
        }
      } catch (e) {}
      if (!resolvedUserId) {
        const session = (await supabase.auth.getSession()).data.session;
        resolvedUserId = session?.user?.id;
      }
    }

    const cacheKey = `${resolvedUserId || 'anon'}_${hostelId || 'default'}`;
    if (inFlightWardenStats.has(cacheKey)) {
      return inFlightWardenStats.get(cacheKey)!;
    }

    const promise = (async () => {
      try {
        const { data: hostelData, error } = await supabase
          .from('hostels')
          .select(`
            id,
            name,
            gender,
            floor_count,
            is_active,
            warden_id,
            warden_hostel_assignments(warden_profile_id),
            rooms:hostel_rooms(
              id,
              no,
              floor,
              capacity,
              room_type,
              is_active,
              beds(
                id,
                bed_number,
                allocations:room_allocations(id, is_active)
              )
            )
          `)
          .eq('is_active', true)
          .order('id', { ascending: true });

        if (error) {
          console.error('[wardenService.getDashboardStats] Error querying hostels:', error);
          throw error;
        }

        const allHostels = hostelData || [];

        // Identify hostels assigned to this warden (via warden_hostel_assignments or direct warden_id)
        const managed = allHostels.filter((h: any) => {
          if (!resolvedUserId) return true; // Fallback if admin viewing
          const isDirect = String(h.warden_id) === String(resolvedUserId);
          const isAssigned = (h.warden_hostel_assignments || []).some(
            (a: any) => String(a.warden_profile_id) === String(resolvedUserId)
          );
          return isDirect || isAssigned;
        });

        const managedHostels = managed.map((h: any) => ({
          id: h.id,
          name: h.name,
          gender: h.gender,
          floors: h.floor_count !== undefined && h.floor_count !== null ? Number(h.floor_count) : 3
        }));

        const target = (hostelId 
          ? managed.find((h: any) => String(h.id) === String(hostelId)) 
          : managed[0]) || managed[0] || allHostels[0];

        let totalRooms = 0;
        let totalCap = 0;
        let occupied = 0;
        let roomsList: any[] = [];
        let pendingPassesCount = 0;
        let openIssuesCount = 0;

        if (target) {
          const rawRooms = (target.rooms || []).filter((r: any) => r.is_active);
          totalRooms = rawRooms.length;

          roomsList = rawRooms.map((r: any) => {
            let occ = 0;
            totalCap += (r.capacity || 0);
            (r.beds || []).forEach((b: any) => {
              if ((b.allocations || []).some((a: any) => a.is_active)) {
                occ++;
                occupied++;
              }
            });
            return {
              id: r.id,
              no: r.no,
              room_no: r.no,
              floor: r.floor,
              capacity: r.capacity,
              room_type: r.room_type,
              occupied_count: occ,
              current_occupancy: occ,
              hostel_id: target.id
            };
          });

          // Fetch only lightweight counts (head: true, transferring 0 rows) for metric cards
          try {
            const [passesRes, issuesRes] = await Promise.all([
              supabase
                .from('gate_passes')
                .select('id', { count: 'exact', head: true })
                .eq('hostel_id', target.id)
                .or('status.eq.PENDING,status.eq.pending,status.eq.REQUESTED,status.eq.requested'),
              supabase
                .from('issues')
                .select('id', { count: 'exact', head: true })
                .eq('hostel_id', target.id)
                .not('status', 'in', '(COMPLETED,completed,closed,CLOSED,resolved,RESOLVED)')
            ]);

            pendingPassesCount = passesRes.count || 0;
            openIssuesCount = issuesRes.count || 0;
          } catch (countErr) {
            console.warn('[wardenService.getDashboardStats] Error fetching counts:', countErr);
          }
        }

        const rate = totalCap > 0 ? Math.round((occupied / totalCap) * 100) : 0;

        return {
          managed_hostels: managedHostels,
          total_residents: occupied,
          total_rooms: totalRooms,
          total_capacity: totalCap,
          pending_gate_passes: pendingPassesCount,
          open_issues: openIssuesCount,
          occupancy_rate: rate,
          rooms: roomsList
        };
      } finally {
        inFlightWardenStats.delete(cacheKey);
      }
    })();

    inFlightWardenStats.set(cacheKey, promise);
    return promise;
  },

  /**
   * Fetch scoped hostels assigned to the warden
   */
  async getAssignedHostels(userId?: string) {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      try {
        const stored = localStorage.getItem('hms_user');
        if (stored) {
          resolvedUserId = JSON.parse(stored)?.id;
        }
      } catch (e) {}
      if (!resolvedUserId) {
        const session = (await supabase.auth.getSession()).data.session;
        resolvedUserId = session?.user?.id;
      }
    }
    if (!resolvedUserId) return [];

    const cacheKey = String(resolvedUserId);
    if (inFlightAssignedHostels.has(cacheKey)) {
      return inFlightAssignedHostels.get(cacheKey)!;
    }

    const promise = (async () => {
      try {
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
      } finally {
        inFlightAssignedHostels.delete(cacheKey);
      }
    })();

    inFlightAssignedHostels.set(cacheKey, promise);
    return promise;
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
   * Fetch structured residents directory for warden view (summary, allotted, unallotted, all)
   */
  async getStructuredResidents(hostelId?: string | number) {
    return adminService.getStructuredResidents(hostelId);
  },

  /**
   * Fetch lightweight resident student lookup specifically for visitor registration dropdown
   * Returns only: id, student_name, enrollment_no, floor, room_no, room_id, hostel_id
   */
  async getStudentVisitorLookup(hostelId?: string | number) {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          student_name,
          enrollment_no,
          allocations:room_allocations(
            is_active,
            bed:beds(
              room:hostel_rooms(
                id,
                no,
                floor,
                hostel_id
              )
            )
          )
        `)
        .order('student_name', { ascending: true, nullsFirst: false });

      if (error) throw error;

      const targetHostelStr = hostelId && hostelId !== 'ALL' && hostelId !== 'all' ? String(hostelId) : null;

      return (data || [])
        .map((st: any) => {
          const activeAlloc = (st.allocations || []).find((a: any) => a.is_active === true);
          if (!activeAlloc) return null;

          const bed = Array.isArray(activeAlloc.bed) ? activeAlloc.bed[0] : activeAlloc.bed;
          const room = Array.isArray(bed?.room) ? bed?.room[0] : bed?.room;
          const hostelIdVal = room?.hostel_id;

          if (targetHostelStr && String(hostelIdVal) !== targetHostelStr) {
            return null;
          }

          return {
            id: st.id,
            student_name: st.student_name || 'Resident Student',
            enrollment_no: st.enrollment_no || '',
            floor: room?.floor !== undefined ? room.floor : null,
            room_no: room?.no || '',
            room_id: room?.id || null,
            hostel_id: hostelIdVal || null
          };
        })
        .filter(Boolean);
    } catch (err) {
      console.error('[wardenService.getStudentVisitorLookup] Error:', err);
      return [];
    }
  },

  /**
   * Fetch gate passes scoped for warden review directly from Supabase
   */
  async getGatePasses(hostelId?: string | number): Promise<any[]> {
    const cacheKey = String(hostelId || 'ALL');
    if (inFlightGatePasses.has(cacheKey)) {
      return inFlightGatePasses.get(cacheKey)!;
    }

    const promise = (async () => {
      try {
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
      } finally {
        inFlightGatePasses.delete(cacheKey);
      }
    })();

    inFlightGatePasses.set(cacheKey, promise);
    return promise;
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
   * Fetch hostel maintenance issues scoped for warden review directly from Supabase
   */
  async getIssues(hostelId?: string | number, statusFilter?: string): Promise<HostelIssue[]> {
    const cacheKey = `${hostelId || 'ALL'}_${statusFilter || 'ALL'}`;
    if (inFlightIssues.has(cacheKey)) {
      return inFlightIssues.get(cacheKey)!;
    }

    const promise = (async () => {
      try {
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

        return issueList.map((i: any) => {
          let img = i.image_url || null;
          let desc = i.description || '';
          if (!img && desc.includes('[ATTACHMENT]:')) {
            const parts = desc.split('[ATTACHMENT]:');
            desc = parts[0].trim();
            img = parts[1]?.trim() || null;
          }

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
            updates: i.updates || []
          };
        });
      } finally {
        inFlightIssues.delete(cacheKey);
      }
    })();

    inFlightIssues.set(cacheKey, promise);
    return promise;
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
  },

  /**
   * Fetch structured single room details with active occupants on-demand
   */
  async getRoomDetails(hostelId: number | string, roomId: number | string) {
    let query = supabase
      .from('hostel_rooms')
      .select(`
        id,
        no,
        floor,
        capacity,
        room_type,
        hostel_id,
        hostel:hostels(id, name),
        beds(
          id,
          bed_number,
          allocations:room_allocations(
            id,
            is_active,
            student:students(
              id,
              student_name,
              enrollment_no
            )
          )
        )
      `)
      .eq('id', Number(roomId));

    if (hostelId) {
      query = query.eq('hostel_id', Number(hostelId));
    }

    const { data: r, error } = await query.maybeSingle();

    if (error) {
      console.error('[wardenService.getRoomDetails] Error:', error);
      throw error;
    }
    if (!r) return null;

    let occupied_count = 0;
    const occupants: any[] = [];
    const beds: any[] = [];

    (r.beds || []).forEach((b: any) => {
      const activeAlloc = (b.allocations || []).find((a: any) => a.is_active);
      if (activeAlloc) {
        occupied_count++;
        if (activeAlloc.student) {
          occupants.push({
            bed_id: b.id,
            bed_number: b.bed_number,
            student_id: activeAlloc.student.id,
            student_name: activeAlloc.student.student_name || 'Resident',
            enrollment_no: activeAlloc.student.enrollment_no || 'N/A',
            student: {
              id: activeAlloc.student.id,
              name: activeAlloc.student.student_name || 'Resident',
              student_name: activeAlloc.student.student_name || 'Resident',
              enrollment_no: activeAlloc.student.enrollment_no || 'N/A',
            }
          });
        }
      }
      beds.push({
        id: b.id,
        bed_number: b.bed_number,
        occupant: activeAlloc?.student ? {
          student_id: activeAlloc.student.id,
          student_name: activeAlloc.student.student_name,
          enrollment_no: activeAlloc.student.enrollment_no,
          is_active: true
        } : null
      });
    });

    const rData: any = r;
    const hostelObj = Array.isArray(rData.hostel) ? rData.hostel[0] : rData.hostel;
    const hostelName = hostelObj?.name || 'Hostel Block';
    const hostelIdVal = hostelObj?.id || rData.hostel_id;

    return {
      id: rData.id,
      room_no: rData.no,
      no: rData.no,
      floor: rData.floor,
      capacity: rData.capacity,
      room_type: rData.room_type,
      hostel_id: rData.hostel_id,
      hostel: {
        id: hostelIdVal,
        name: hostelName
      },
      hostel_name: hostelName,
      occupied_count,
      current_occupancy: occupied_count,
      beds,
      occupants
    };
  }
};
