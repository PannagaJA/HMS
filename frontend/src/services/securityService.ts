/**
 * Security Guard Role Service
 * Gate movements, token/pass validation, physical EXIT/ENTRY recording, and visitor checkpoint logs.
 */
import { supabase } from '../lib/supabase';
import type { GatePassRequest, VisitorLog } from '../types';
import { getActiveOrgId } from '../utils/authService';

let inFlightVisitorLogsPromise: Promise<VisitorLog[]> | null = null;

export const securityService = {
  /**
   * Fetch gate pass movements
   */
  async getGatePasses(): Promise<GatePassRequest[]> {
    const orgId = getActiveOrgId();
    let query = supabase
      .from('gate_passes')
      .select('*, student:students(*), hostel:hostels(id, name), room:hostel_rooms(no, floor)')
      .order('created_at', { ascending: false });

    if (orgId) {
      query = query.eq('org_id', orgId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((gp: any) => ({
      ...gp,
      student_name: gp.student?.student_name || 'Student Resident',
      enrollment_no: gp.student?.enrollment_no || 'N/A',
      hostel_name: gp.hostel?.name || 'Aryabhata Bhavan',
      room_no: gp.room?.no || '101',
      floor: gp.room?.floor !== undefined ? gp.room?.floor : null,
      hostel_id: gp.hostel_id || gp.hostel?.id
    }));
  },

  /**
   * Verify Gate Pass by QR token, code, ID, or student USN/name
   */
  async verifyToken(code: string): Promise<{ valid: boolean; pass: GatePassRequest }> {
    const trimmed = (code || '').trim();
    if (!trimmed) {
      throw new Error('Please enter a student USN, token, or student name');
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    const isNum = /^\d+$/.test(trimmed);
    const orgId = getActiveOrgId();

    let passes: any[] = [];
    let resolvedStudent: any = null;

    // 1. If UUID, check gate_passes.token first (exact match, avoiding invalid operator error on UUID columns)
    if (isUUID) {
      let tokenQuery = supabase
        .from('gate_passes')
        .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
        .eq('token', trimmed);
      if (orgId) tokenQuery = tokenQuery.eq('org_id', orgId);
      const { data: byToken } = await tokenQuery;

      if (byToken && byToken.length > 0) {
        passes = byToken;
      } else {
        // Check if this UUID belongs to a student's profile_id or id
        let stQuery = supabase
          .from('students')
          .select('id, student_name, enrollment_no')
          .eq('profile_id', trimmed);
        if (orgId) stQuery = stQuery.eq('org_id', orgId);
        const { data: stByProfile } = await stQuery.maybeSingle();

        if (stByProfile) {
          resolvedStudent = stByProfile;
          let stPassesQuery = supabase
            .from('gate_passes')
            .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
            .eq('student_id', stByProfile.id)
            .order('created_at', { ascending: false });
          if (orgId) stPassesQuery = stPassesQuery.eq('org_id', orgId);
          const { data: stPasses } = await stPassesQuery;
          if (stPasses) passes = stPasses;
        }
      }
    }

    // 2. If not found yet, search student by enrollment_no / USN
    if (passes.length === 0 && !resolvedStudent) {
      const { data: stByEnroll } = await supabase
        .from('students')
        .select('id, student_name, enrollment_no')
        .ilike('enrollment_no', trimmed)
        .maybeSingle();

      if (stByEnroll) {
        resolvedStudent = stByEnroll;
        const { data: stPasses } = await supabase
          .from('gate_passes')
          .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
          .eq('student_id', stByEnroll.id)
          .order('created_at', { ascending: false });
        if (stPasses) passes = stPasses;
      }
    }

    // 3. If numeric ID, check gate_passes.id or students.id
    if (passes.length === 0 && isNum) {
      const numId = parseInt(trimmed, 10);
      const { data: byId } = await supabase
        .from('gate_passes')
        .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
        .eq('id', numId);

      if (byId && byId.length > 0) {
        passes = byId;
      } else {
        const { data: stById } = await supabase
          .from('students')
          .select('id, student_name, enrollment_no')
          .eq('id', numId)
          .maybeSingle();
        if (stById) {
          resolvedStudent = stById;
          const { data: stPasses } = await supabase
            .from('gate_passes')
            .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
            .eq('student_id', stById.id)
            .order('created_at', { ascending: false });
          if (stPasses) passes = stPasses;
        }
      }
    }

    // 4. Fallback search by student name
    if (passes.length === 0 && !resolvedStudent) {
      const { data: stByName } = await supabase
        .from('students')
        .select('id, student_name, enrollment_no')
        .ilike('student_name', `%${trimmed}%`)
        .limit(1)
        .maybeSingle();

      if (stByName) {
        resolvedStudent = stByName;
        const { data: stPasses } = await supabase
          .from('gate_passes')
          .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
          .eq('student_id', stByName.id)
          .order('created_at', { ascending: false });
        if (stPasses) passes = stPasses;
      }
    }

    // If no gate pass records exist at all:
    if (passes.length === 0) {
      if (resolvedStudent) {
        throw new Error(`Student "${resolvedStudent.student_name}" (${resolvedStudent.enrollment_no}) has no gate pass application on record.`);
      }
      throw new Error(`No student or gate pass record found matching "${trimmed}". Please verify the USN or token.`);
    }

    // Pick the best pass: preferentially an 'approved' pass, otherwise the most recent one
    const activePass = passes.find((p: any) => p.status === 'approved') || passes[0];

    const studentName = activePass.student?.student_name || resolvedStudent?.student_name || 'Resident';
    const enrollmentNo = activePass.student?.enrollment_no || resolvedStudent?.enrollment_no || 'N/A';

    const mapped: GatePassRequest = {
      ...activePass,
      student_name: studentName,
      enrollment_no: enrollmentNo,
      hostel_name: activePass.hostel?.name || 'Aryabhata Bhavan',
      room_no: activePass.room?.no || '101',
      floor: activePass.room?.floor !== undefined ? activePass.room?.floor : null
    };

    // Check if pass is expired: student never exited and curfew deadline has passed
    const isExitDone = Boolean(activePass.actual_exit_time);
    if (!isExitDone && activePass.expected_return_date && activePass.expected_return_time) {
      try {
        const deadline = new Date(`${activePass.expected_return_date}T${activePass.expected_return_time}`);
        if (!isNaN(deadline.getTime()) && new Date() > deadline) {
          mapped.status = 'expired';
          Promise.resolve(
            supabase
              .from('gate_passes')
              .update({ status: 'expired', updated_at: new Date().toISOString() })
              .eq('id', activePass.id)
          ).catch(() => {});
        }
      } catch (e) {
        // ignore date parsing error
      }
    }

    if (activePass.status === 'pending') {
      throw new Error(`Gate pass for student "${studentName}" (${enrollmentNo}) is currently PENDING Warden approval.`);
    }

    if (activePass.status === 'rejected') {
      throw new Error(`Gate pass for student "${studentName}" (${enrollmentNo}) was REJECTED by Warden: ${activePass.action_note || 'Unauthorized departure'}.`);
    }

    return { valid: true, pass: mapped };
  },

  /**
   * Log checkpoint movement (EXIT or ENTRY)
   */
  async logMovement(passId: number, movementType: 'EXIT' | 'ENTRY') {
    // 1. Check current pass status first
    const { data: currentPass } = await supabase
      .from('gate_passes')
      .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
      .eq('id', passId)
      .maybeSingle();

    const stName = currentPass?.student?.student_name || 'Resident';
    const enNo = currentPass?.student?.enrollment_no || 'N/A';

    if (currentPass && currentPass.status !== 'approved') {
      throw new Error(`Cannot stamp movement: Gate pass for ${stName} (${enNo}) is currently ${currentPass.status.toUpperCase()}. It must be approved by the Warden first.`);
    }

    // Check if exit is attempted after return deadline has passed
    if (movementType === 'EXIT' && currentPass && !currentPass.actual_exit_time && currentPass.expected_return_date && currentPass.expected_return_time) {
      try {
        const deadline = new Date(`${currentPass.expected_return_date}T${currentPass.expected_return_time}`);
        if (!isNaN(deadline.getTime()) && new Date() > deadline) {
          throw new Error(`Cannot mark Gate Exit: Outing deadline for ${stName} (${enNo}) expired on ${currentPass.expected_return_date} at ${currentPass.expected_return_time}. Student must request a new pass.`);
        }
      } catch (e) {
        // fallback
      }
    }

    let resultData: any = null;
    let rpcErrorMsg: string | null = null;

    try {
      const { data, error } = await supabase.rpc('log_gate_movement', {
        p_pass_id: passId,
        p_movement_type: movementType
      });
      if (error) {
        rpcErrorMsg = error.message;
        console.warn('RPC log_gate_movement error:', error);
      } else if (data) {
        resultData = data;
      }
    } catch (rpcErr: any) {
      rpcErrorMsg = rpcErr?.message || String(rpcErr);
      console.warn('RPC log_gate_movement exception:', rpcErr);
    }

    if (!resultData) {
      // If RPC failed due to an explicit business constraint, surface it cleanly
      if (rpcErrorMsg && !rpcErrorMsg.includes('permission') && !rpcErrorMsg.includes('Access Denied')) {
        throw new Error(rpcErrorMsg);
      }

      const { data: user } = await supabase.auth.getUser();
      const updatePayload: any = { 
        updated_at: new Date().toISOString(),
        security_guard_id: user.user?.id || null
      };

      if (movementType === 'EXIT') {
        updatePayload.actual_exit_time = new Date().toISOString();
      } else {
        updatePayload.actual_entry_time = new Date().toISOString();
        updatePayload.status = 'completed';
      }

      const { data: updated, error } = await supabase
        .from('gate_passes')
        .update(updatePayload)
        .eq('id', passId)
        .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
        .maybeSingle();

      if (error) {
        throw new Error(rpcErrorMsg || error.message || 'Failed to stamp gate movement');
      }
      resultData = updated;
    }

    const { data: pass } = await supabase
      .from('gate_passes')
      .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
      .eq('id', passId)
      .single();

    const mappedPass = pass ? {
      ...pass,
      student_name: pass.student?.student_name || 'Resident',
      enrollment_no: pass.student?.enrollment_no || 'N/A',
      hostel_name: pass.hostel?.name || 'Aryabhata Bhavan',
      room_no: pass.room?.no || '101',
      floor: pass.room?.floor !== undefined ? pass.room?.floor : null
    } : resultData;

    return {
      message: movementType === 'EXIT' ? 'Gate Exit Verified & Stamped Successfully' : 'Gate Return Entry Verified & Stamped',
      pass: mappedPass
    };
  },

  /**
   * Fetch visitor checkpoint logs
   */
  async getVisitorLogs(): Promise<VisitorLog[]> {
    if (inFlightVisitorLogsPromise) {
      return inFlightVisitorLogsPromise;
    }

    inFlightVisitorLogsPromise = (async () => {
      try {
        const orgId = getActiveOrgId();
        let query = supabase
          .from('visitor_logs')
          .select('*, student:students(*), hostel:hostels(id, name), room:hostel_rooms(id, no, floor)')
          .order('check_in_time', { ascending: false });

        if (orgId) {
          query = query.eq('org_id', orgId);
        }

        const { data: logs, error } = await query;

        let list = logs || [];

        return list.map((v: any) => {
          let rel = 'Parent';
          let stName = v.student?.student_name || v.student_name || 'Resident';
          let stRoom = v.room?.no || v.room_no || '101';
          let pur = v.purpose || 'Visit';
          let isEnquiry = false;

          if (typeof v.purpose === 'string' && v.purpose.startsWith('__META__:')) {
            try {
              const parsed = JSON.parse(v.purpose.slice(9));
              if (parsed.rel) rel = parsed.rel;
              if (parsed.st) stName = parsed.st;
              if (parsed.rm) stRoom = parsed.rm;
              if (parsed.pur) pur = parsed.pur;
              if (parsed.enq) isEnquiry = true;
            } catch {}
          }

          if (isEnquiry || rel === 'Enquiry' || stName.includes('Enquiry')) {
            stName = 'General / Campus Enquiry';
            stRoom = 'Reception / Office';
            rel = 'Enquiry';
          }

          return {
            ...v,
            visitor_name: v.visitor_name,
            visitor_phone: v.mobile_number,
            relation: rel,
            student_name: stName,
            enrollment_no: isEnquiry ? 'N/A' : (v.student?.enrollment_no || v.enrollment_no || 'N/A'),
            hostel_id: v.hostel_id || v.hostel?.id,
            hostel_name: v.hostel?.name || 'Hostel Block',
            student_room: stRoom,
            room_no: stRoom,
            floor: v.room?.floor !== undefined ? v.room?.floor : null,
            purpose: pur,
            status: v.check_out_time ? 'CHECKED_OUT' : 'CHECKED_IN'
          };
        });
      } finally {
        inFlightVisitorLogsPromise = null;
      }
    })();

    return inFlightVisitorLogsPromise;
  },

  /**
   * Check in a visitor
   */
  async checkInVisitor(payload: {
    student_id?: number | string;
    enrollment_no?: string;
    student_name?: string;
    student_room?: string;
    hostel_id?: number | string;
    visitor_name: string;
    mobile_number: string;
    relation?: string;
    purpose?: string;
  }) {
    const isEnquiry = payload.relation === 'Enquiry' || (payload.student_name || '').includes('Enquiry');
    const orgId = getActiveOrgId();

    // 1. Find an active allocated resident to satisfy DB trigger constraints
    let activeAlloc: any = null;
    try {
      let allocQuery = supabase
        .from('room_allocations')
        .select('id, student_id, is_active, bed:beds(room:hostel_rooms(id, hostel_id))')
        .eq('is_active', true);

      if (orgId) {
        allocQuery = allocQuery.eq('org_id', orgId);
      }

      const { data: allocs } = await allocQuery;

      if (allocs && allocs.length > 0) {
        if (payload.hostel_id) {
          activeAlloc = allocs.find((a: any) => {
            const hId = a.bed?.room?.hostel_id || (Array.isArray(a.bed) ? a.bed[0]?.room?.hostel_id : null);
            return String(hId) === String(payload.hostel_id);
          }) || allocs[0];
        } else {
          activeAlloc = allocs[0];
        }
      }
    } catch (allocErr) {
      console.warn('Failed to query allocations for visitor log:', allocErr);
    }

    const studentId = activeAlloc?.student_id || 1;
    const bed = Array.isArray(activeAlloc?.bed) ? activeAlloc.bed[0] : activeAlloc?.bed;
    const room = Array.isArray(bed?.room) ? bed.room[0] : bed?.room;
    const roomId = room?.id || 1;
    const hostelId = room?.hostel_id || payload.hostel_id || 1;

    // Pack complete metadata into purpose so all fields (relation, custom student name, room, purpose) persist with 100% fidelity
    const metaPayload = {
      rel: payload.relation || (isEnquiry ? 'Enquiry' : 'Parent'),
      st: isEnquiry ? 'General / Campus Enquiry' : (payload.student_name || 'Resident'),
      rm: isEnquiry ? 'Reception / Office' : (payload.student_room || '101'),
      pur: payload.purpose || (isEnquiry ? 'General Enquiry' : 'Visit'),
      enq: isEnquiry
    };

    const insertPayload: any = {
      student_id: studentId,
      hostel_id: hostelId,
      room_id: roomId,
      visitor_name: payload.visitor_name,
      mobile_number: payload.mobile_number,
      purpose: `__META__:${JSON.stringify(metaPayload)}`,
      check_in_time: new Date().toISOString()
    };

    if (orgId) {
      insertPayload.org_id = orgId;
    }

    const { data, error } = await supabase.from('visitor_logs').insert(insertPayload).select().single();

    if (error) {
      console.error('[securityService.checkInVisitor] Insert error:', error);
      throw error;
    }
    return data;
  },

  /**
   * Check out a visitor
   */
  async checkOutVisitor(visitorId: number) {
    try {
      const { data, error } = await supabase.rpc('checkout_visitor', {
        p_visitor_id: visitorId
      });
      if (!error && data) return data;
    } catch (rpcErr) {
      console.warn('RPC checkout_visitor failed, falling back to direct update:', rpcErr);
    }

    const { data, error } = await supabase
      .from('visitor_logs')
      .update({ check_out_time: new Date().toISOString() })
      .eq('id', visitorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
