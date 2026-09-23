/**
 * Admin Role Service
 * Handles system-wide operations, hostel configurations, room matrix, resident directory, and staff management.
 */
import { supabase } from '../lib/supabase';
import type { Hostel, HostelRoom, HostelStudent } from '../types';

let inFlightDashboardStatsPromise: Promise<any> | null = null;
let inFlightWardensPromise: Promise<any[]> | null = null;
let inFlightCaretakersPromise: Promise<any[]> | null = null;
let inFlightSecurityStaffPromise: Promise<any[]> | null = null;
let cachedHostelsList: Hostel[] | null = null;
let inFlightHostelsListPromise: Promise<Hostel[]> | null = null;

export const adminService = {

  /**
   * Fetch aggregated system-wide dashboard stats, scoped to the active org.
   * Uses in-flight deduplication to prevent parallel duplicate requests.
   */
  async getDashboardStats() {
    if (inFlightDashboardStatsPromise) {
      return inFlightDashboardStatsPromise;
    }

    inFlightDashboardStatsPromise = (async () => {
      try {
        // Resolve the current user's org_id for tenant isolation
        let orgId: string | undefined;
        try {
          const stored = localStorage.getItem('hms_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            orgId = parsed.org_id;
          }
          if (!orgId) {
            const { data: authUser } = await supabase.auth.getUser();
            if (authUser?.user?.id) {
              const { data: prof } = await supabase.from('profiles').select('org_id').eq('id', authUser.user.id).maybeSingle();
              orgId = prof?.org_id;
            }
          }
        } catch (e) {
          console.warn('Could not determine active org_id:', e);
        }

        // SAFETY GUARD: Never run unfiltered queries — that would leak data across tenants.
        // If org_id is still unknown, return zeroed stats and surface the error.
        if (!orgId) {
          console.error('[adminService.getDashboardStats] BLOCKED: org_id is undefined. Returning empty stats to prevent cross-tenant data leak.');
          return {
            statistics: {
              total_hostels: 0,
              total_capacity: 0,
              occupied_beds: 0,
              vacant_beds: 0,
              occupancy_rate: 0,
              pending_gate_passes: 0,
              active_issues: 0
            },
            recent_passes: [],
            weekly_trends: [],
            trend_stats: { peakDay: 'N/A', peakCount: 0, average: 0, trendPercent: '+0%' }
          };
        }

        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const fourteenDaysAgoDate = fourteenDaysAgo.split('T')[0];

        // Direct table queries for tenant accuracy
        const [h, beds, a, p, iss, recentPassesRes, trendPassesRes] = await Promise.all([
          supabase.from('hostels').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('org_id', orgId),
          supabase.from('beds').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
          supabase.from('room_allocations').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('org_id', orgId),
          // Match both PENDING (uppercase) and pending (lowercase)
          supabase.from('gate_passes').select('id', { count: 'exact', head: true }).or('status.eq.PENDING,status.eq.pending').eq('org_id', orgId),
          // Count issues that are NOT completed
          supabase.from('issues').select('id', { count: 'exact', head: true }).not('status', 'in', '(COMPLETED,completed,closed,CLOSED)').eq('org_id', orgId),
          // Top recent gate passes with student, hostel, and room metadata
          supabase
            .from('gate_passes')
            .select('id, token, pass_type, reason, out_date, out_time, expected_return_date, expected_return_time, status, created_at, actual_exit_time, actual_entry_time, student:students(id, student_name, enrollment_no), hostel:hostels(id, name), room:hostel_rooms(id, no, floor)')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(10),
          // Gate passes in the last 14 days for 7-day movement trend and week-over-week calculation
          supabase
            .from('gate_passes')
            .select('id, out_date, created_at, actual_exit_time, status')
            .eq('org_id', orgId)
            .or(`created_at.gte.${fourteenDaysAgo},out_date.gte.${fourteenDaysAgoDate}`)
        ]);

        const totalCapacity = beds.count || 0;
        const occupied = a.count || 0;

        const stats = {
          total_hostels: h.count || 0,
          total_capacity: totalCapacity,
          occupied_beds: occupied,
          vacant_beds: Math.max(0, totalCapacity - occupied),
          occupancy_rate: totalCapacity > 0 ? Math.round((occupied / totalCapacity) * 100) : 0,
          pending_gate_passes: p.count || 0,
          active_issues: iss.count || 0
        };

        // Format recent gate passes
        const recent_passes = (recentPassesRes.data || []).map((gp: any) => ({
          id: gp.id,
          token: gp.token,
          student_name: gp.student?.student_name || 'Resident Student',
          enrollment_no: gp.student?.enrollment_no || 'N/A',
          hostel_name: gp.hostel?.name || 'Hostel Block',
          room_no: gp.room?.no || 'N/A',
          floor: gp.room?.floor !== undefined ? gp.room?.floor : null,
          pass_type: gp.pass_type || 'DAY_OUT',
          out_date: gp.out_date || (gp.created_at ? gp.created_at.split('T')[0] : 'N/A'),
          out_time: gp.out_time || 'N/A',
          expected_return_date: gp.expected_return_date,
          expected_return_time: gp.expected_return_time,
          status: gp.status?.toLowerCase() || 'pending',
          reason: gp.reason || 'N/A',
          purpose: gp.reason || 'N/A',
          actual_exit_time: gp.actual_exit_time,
          actual_entry_time: gp.actual_entry_time,
          created_at: gp.created_at
        }));

        // Compute 7-day weekly movement trends
        const now = new Date();
        const days7: { day: string; dateStr: string; fullDay: string }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = d.toISOString().split('T')[0];
          const day = d.toLocaleDateString('en-US', { weekday: 'short' });
          const fullDay = d.toLocaleDateString('en-US', { weekday: 'long' });
          days7.push({ day, dateStr, fullDay });
        }

        const priorDateStrs = new Set<string>();
        for (let i = 13; i >= 7; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          priorDateStrs.add(d.toISOString().split('T')[0]);
        }

        const allTrendPasses = trendPassesRes.data || [];

        const dailyCounts = days7.map(({ dateStr }) => {
          return allTrendPasses.filter((gp: any) => {
            const exitDate = gp.actual_exit_time ? gp.actual_exit_time.split('T')[0] : null;
            const createDate = gp.created_at ? gp.created_at.split('T')[0] : null;
            return exitDate === dateStr || gp.out_date === dateStr || createDate === dateStr;
          }).length;
        });

        const prior7Count = allTrendPasses.filter((gp: any) => {
          const exitDate = gp.actual_exit_time ? gp.actual_exit_time.split('T')[0] : null;
          const createDate = gp.created_at ? gp.created_at.split('T')[0] : null;
          return (exitDate && priorDateStrs.has(exitDate)) || (gp.out_date && priorDateStrs.has(gp.out_date)) || (createDate && priorDateStrs.has(createDate));
        }).length;

        const maxCount = Math.max(...dailyCounts, 0);
        const total7Days = dailyCounts.reduce((sum, c) => sum + c, 0);

        const weekly_trends = days7.map((d, index) => {
          const count = dailyCounts[index];
          const heightPercent = maxCount > 0 && count > 0 
            ? Math.max(15, Math.round((count / maxCount) * 100)) 
            : 8;
          return {
            day: d.day,
            count,
            height: `${heightPercent}%`
          };
        });

        let peakDay = 'N/A';
        let peakCount = 0;
        if (maxCount > 0) {
          const peakIndex = dailyCounts.indexOf(maxCount);
          peakDay = days7[peakIndex].fullDay;
          peakCount = maxCount;
        }

        const average = total7Days > 0 ? +(total7Days / 7).toFixed(1) : 0;

        let trendPercent = '+0%';
        if (prior7Count > 0) {
          const diff = Math.round(((total7Days - prior7Count) / prior7Count) * 100);
          trendPercent = diff >= 0 ? `+${diff}%` : `${diff}%`;
        } else if (total7Days > 0) {
          trendPercent = '+100%';
        }

        const trend_stats = {
          peakDay,
          peakCount,
          average,
          trendPercent
        };

        console.log('[adminService.getDashboardStats] orgId:', orgId, 'stats:', stats, 'recentPasses:', recent_passes.length, 'trends:', weekly_trends);
        return {
          statistics: stats,
          recent_passes,
          weekly_trends,
          trend_stats
        };
      } finally {
        inFlightDashboardStatsPromise = null;
      }
    })();

    return inFlightDashboardStatsPromise;
  },



  /**
   * Fetch all active hostel blocks with occupancy metrics
   */
  async getHostels(passedWardens?: any[], passedCaretakers?: any[]): Promise<Hostel[]> {
    let hostels: any[] = [];
    try {
      const { data, error } = await supabase
        .from('hostels')
        .select('id, name, gender, floor_count, address, warden_id, caretaker_id, is_active, rooms:hostel_rooms(id, capacity, is_active)')
        .eq('is_active', true)
        .order('id', { ascending: true });
      if (!error && data) {
        hostels = data;
      }
    } catch (e) {
      console.warn('Failed to load hostels from supabase:', e);
    }
    const combinedHostels = hostels;
    if (combinedHostels.length === 0) {
      return [];
    }

    const [wardensList, caretakersList, activeAllocsRes] = await Promise.all([
      passedWardens ? Promise.resolve(passedWardens) : adminService.getWardens(),
      passedCaretakers ? Promise.resolve(passedCaretakers) : adminService.getCaretakers(),
      supabase.from('room_allocations').select('id, bed:beds(room:hostel_rooms(hostel_id))').eq('is_active', true)
    ]);

    const activeAllocs = activeAllocsRes.data || [];

    return combinedHostels.map((h: any) => {
      const totalRooms = (h.rooms || []).filter((r: any) => r.is_active).length;
      const totalCap = (h.rooms || []).filter((r: any) => r.is_active).reduce((sum: number, r: any) => sum + (r.capacity || 0), 0);
      const occ = activeAllocs.filter((a: any) => a.bed?.room?.hostel_id === h.id).length;
      
      const wDetail = h.warden_id ? wardensList.find((w: any) => String(w.id) === String(h.warden_id)) : null;
      const cDetail = h.caretaker_id ? caretakersList.find((c: any) => String(c.id) === String(h.caretaker_id)) : null;

      return {
        ...h,
        total_rooms: totalRooms,
        total_capacity: totalCap,
        occupied_beds: occ,
        warden: h.warden_id || null,
        warden_detail: wDetail || null,
        caretaker: h.caretaker_id || null,
        caretaker_detail: cDetail || null
      };
    });
  },

  /**
   * Alias for getHostels — kept for backward compatibility with components
   * that call adminService.getHostelsList() for filter dropdowns.
   */
  async getHostelsList(): Promise<Hostel[]> {
    return adminService.getHostels();
  },

  async createHostel(payload: { name: string; gender: 'M' | 'F' | 'C'; floor_count: number; address?: string; warden?: any; caretaker?: any }) {
    let createdHostel: any = null;
    const { data, error } = await supabase
      .from('hostels')
      .insert({
        name: payload.name,
        gender: payload.gender,
        floor_count: payload.floor_count,
        address: payload.address || '',
        warden_id: payload.warden || null,
        caretaker_id: payload.caretaker || null,
        is_active: true
      })
      .select()
      .single();
    if (error || !data) {
      throw error || new Error("Failed to create hostel in the database.");
    }
    createdHostel = data;

    // If warden is UUID, try linking in DB
    const isUuid = typeof payload.warden === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.warden);
    if (isUuid) {
      try {
        await supabase.from('warden_hostel_assignments').insert({
          warden_profile_id: payload.warden,
          hostel_id: createdHostel.id
        });
      } catch (we) {
        console.warn('Warden assignment insert failed:', we);
      }
    }

    return {
      ...createdHostel,
      warden: payload.warden || null,
      caretaker: payload.caretaker || null
    };
  },

  async updateHostel(id: string | number, payload: Partial<{ name: string; gender: 'M' | 'F' | 'C'; floor_count: number; address?: string; warden?: any; caretaker?: any }>) {
    try {
      const sanitizedWardenId = payload.warden === 'none' || payload.warden === '' ? null : (payload.warden !== undefined ? payload.warden : undefined);
      const sanitizedCaretakerId = payload.caretaker === 'none' || payload.caretaker === '' ? null : (payload.caretaker !== undefined ? payload.caretaker : undefined);

      await supabase.from('hostels').update({
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.gender ? { gender: payload.gender } : {}),
        ...(payload.floor_count !== undefined ? { floor_count: payload.floor_count } : {}),
        ...(payload.address !== undefined ? { address: payload.address } : {}),
        ...(sanitizedWardenId !== undefined ? { warden_id: sanitizedWardenId } : {}),
        ...(sanitizedCaretakerId !== undefined ? { caretaker_id: sanitizedCaretakerId } : {})
      }).eq('id', id);

      const isUuid = typeof payload.warden === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.warden);
      if (isUuid) {
        try {
          await supabase.from('warden_hostel_assignments').delete().eq('hostel_id', id);
          await supabase.from('warden_hostel_assignments').insert({
            warden_profile_id: payload.warden,
            hostel_id: id
          });
        } catch (we) {
          console.warn('Warden assignment update failed:', we);
        }
      } else if (payload.warden === null || payload.warden === 'none' || payload.warden === '') {
        try {
          await supabase.from('warden_hostel_assignments').delete().eq('hostel_id', id);
        } catch (we) {
          console.warn('Warden assignment clear failed:', we);
        }
      }
    } catch (e) {
      console.warn('Hostel update in Supabase failed:', e);
      throw e;
    }

    return { id, ...payload };
  },

  async deleteHostel(id: string | number) {
    try {
      await supabase.from('hostels').update({ is_active: false }).eq('id', id);
    } catch (e) {
      console.warn('Hostel soft-delete in Supabase failed:', e);
      throw e;
    }
    return { success: true };
  },

  /**
   * Fetch rooms with bed slots and assigned occupants
   */
  async getRooms(hostelId?: string | number): Promise<HostelRoom[]> {
    let query = supabase
      .from('hostel_rooms')
      .select('*, hostel:hostels(name), beds(*, allocations:room_allocations(*, student:students(*)))')
      .eq('is_active', true)
      .order('no', { ascending: true });

    if (hostelId) {
      query = query.eq('hostel_id', hostelId);
    }

    const { data: rooms, error } = await query;
    if (error) throw error;

    return (rooms || []).map((r: any) => {
      const activeOccupants: any[] = [];
      (r.beds || []).forEach((b: any) => {
        (b.allocations || []).forEach((a: any) => {
          if (a.is_active && a.student) {
            activeOccupants.push({
              ...a.student,
              bed_number: b.bed_number,
              allocated_at: a.allocated_at
            });
          }
        });
      });

      const occCount = activeOccupants.length;
      return {
        ...r,
        name: r.name || `Room ${r.no}`,
        hostel: r.hostel_id,
        hostel_name: r.hostel?.name || '',
        room_no: r.no,
        vacant: occCount < r.capacity,
        occupied_count: occCount,
        current_occupancy: occCount,
        occupants: activeOccupants,
        room_type_display: r.room_type === 'S' ? 'Single' : r.room_type === 'D' ? 'Double' : r.room_type === 'T' ? 'Triple' : r.room_type === 'P' ? 'Scholar' : r.room_type === 'B' ? 'Dormitory' : 'Multi-Bed'
      };
    });
  },

  /**
   * Update room configuration, floor, bed capacity, and room type
   */
  async updateRoom(roomId: string | number, payload: Partial<{ no: string; room_no?: string; name?: string; floor: number; capacity: number; room_type: string; hostel: number | string; hostel_id?: number | string }>) {
    const numId = Number(roomId);
    const capacity = payload.capacity !== undefined ? Number(payload.capacity) : undefined;
    const floor = payload.floor !== undefined ? Number(payload.floor) : undefined;
    const roomNo = payload.no !== undefined || payload.room_no !== undefined ? String(payload.no || payload.room_no).trim() : undefined;
    const roomType = payload.room_type;
    const rawHostel = payload.hostel || payload.hostel_id;
    const hostelId = rawHostel !== undefined && !isNaN(Number(rawHostel)) ? Number(rawHostel) : undefined;

    // 1. Try RPC resize_room_capacity if capacity is changing
    if (capacity !== undefined) {
      try {
        await supabase.rpc('resize_room_capacity', {
          p_room_id: numId,
          p_new_capacity: capacity
        });
      } catch (e) {
        console.warn('RPC resize_room_capacity skipped/fallback:', e);
      }
    }

    // 2. Direct update on hostel_rooms
    const updateData: any = {};
    if (capacity !== undefined) updateData.capacity = capacity;
    if (roomNo !== undefined) updateData.no = roomNo;
    if (floor !== undefined) updateData.floor = floor;
    if (roomType !== undefined) updateData.room_type = roomType;
    if (hostelId !== undefined && hostelId > 0) updateData.hostel_id = hostelId;

    let updatedRoom: any = null;
    if (Object.keys(updateData).length > 0) {
      const { data, error } = await supabase
        .from('hostel_rooms')
        .update(updateData)
        .eq('id', numId)
        .select('*, hostel:hostels(name)')
        .maybeSingle();
      if (error) throw error;
      updatedRoom = data;
    }

    // 3. Ensure beds table matches new capacity
    if (capacity !== undefined) {
      try {
        const { data: existingBeds } = await supabase
          .from('beds')
          .select('id, bed_number')
          .eq('room_id', numId)
          .order('bed_number', { ascending: true });

        const currentCount = existingBeds?.length || 0;
        if (capacity > currentCount) {
          const newBeds = [];
          for (let b = currentCount + 1; b <= capacity; b++) {
            newBeds.push({ room_id: numId, bed_number: b });
          }
          if (newBeds.length > 0) {
            await supabase.from('beds').insert(newBeds);
          }
        }
      } catch (be) {
        console.warn('Bed sync warning:', be);
      }
    }

    return updatedRoom ? {
      ...updatedRoom,
      name: payload.name || `Room ${updatedRoom.no || ''}`,
      room_no: updatedRoom.no,
      hostel: updatedRoom.hostel_id,
      hostel_name: updatedRoom.hostel?.name || '',
      room_type_display: updatedRoom.room_type === 'S' ? 'Single' : updatedRoom.room_type === 'D' ? 'Double' : updatedRoom.room_type === 'T' ? 'Triple' : updatedRoom.room_type === 'P' ? 'Scholar' : updatedRoom.room_type === 'B' ? 'Dormitory' : 'Multi-Bed'
    } : { id: numId, ...payload };
  },

  /**
   * Fetch resident students directory
   */
  async getStudents(): Promise<HostelStudent[]> {
    let students: any[] = [];
    try {
      // 1. Try full join query
      const { data, error } = await supabase
        .from('students')
        .select('*, course:hostel_courses(*), allocations:room_allocations(*, bed:beds(*, room:hostel_rooms(*, hostel:hostels(*))))')
        .order('student_name', { ascending: true, nullsFirst: false });

      if (!error && data && data.length > 0) {
        students = data;
      } else {
        if (error) {
          console.warn('Nested student query error, attempting resilient fallback:', error.message || error);
        }
        // Fallback: Direct select from students table
        const { data: rawData, error: rawError } = await supabase
          .from('students')
          .select('*')
          .order('student_name', { ascending: true, nullsFirst: false });

        if (!rawError && rawData) {
          students = rawData;
          // Enrich active allocations if possible
          try {
            const { data: allocData } = await supabase
              .from('room_allocations')
              .select('*, bed:beds(*, room:hostel_rooms(*, hostel:hostels(*)))')
              .eq('is_active', true);

            if (allocData && allocData.length > 0) {
              students = students.map((st: any) => ({
                ...st,
                allocations: allocData.filter((a: any) => String(a.student_id) === String(st.id))
              }));
            }
          } catch (allocErr) {
            console.warn('Allocations enrichment fallback warning:', allocErr);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load students from supabase:', e);
      try {
        const { data: simpleData } = await supabase.from('students').select('*');
        if (simpleData) students = simpleData;
      } catch (fe) {
        console.warn('Simple fallback failed:', fe);
      }
    }

    return students.map((s: any) => {
      const activeAlloc = (s.allocations || []).find((a: any) => a.is_active) || s.allocations?.[0];
      const bed = Array.isArray(activeAlloc?.bed) ? activeAlloc.bed[0] : activeAlloc?.bed;
      const room = Array.isArray(bed?.room) ? bed.room[0] : bed?.room;
      const hostel = Array.isArray(room?.hostel) ? room.hostel[0] : room?.hostel;
      const resolvedEmail = s.email || s.profile?.email || '';
      const isAllotted = !!activeAlloc || !!s.room_allotted || !!s.room_no || !!s.room_number || !!s.bed_number;

      return {
        ...s,
        id: s.id,
        student_name: s.student_name || s.name || 'Resident Student',
        enrollment_no: s.enrollment_no || s.usn || '',
        gender: s.gender || 'M',
        phone: s.phone || '',
        email: resolvedEmail,
        room_allotted: isAllotted,
        hostel_name: hostel?.name || s.hostel_name || (s.hostel ? `Hostel ${s.hostel}` : ''),
        room_no: room?.no || s.room_no || s.room_number || '',
        room_number: room?.no || s.room_number || s.room_no || '',
        bed_number: bed?.bed_number || s.bed_number || null,
        floor: room?.floor !== undefined ? room.floor : (s.floor ?? s.room_detail?.floor ?? null),
        hostel: hostel ? hostel.id : (s.hostel || s.hostel_id || null),
        room_detail: room || s.room_detail || null
      };
    });
  },

  /**
   * Update student details
   */
  async updateStudent(studentId: number | string, payload: {
    student_name?: string;
    enrollment_no?: string;
    email?: string;
    gender?: 'M' | 'F';
    phone?: string;
    father_name?: string;
    guardian_phone?: string;
    emergency_contact?: string;
  }) {
    const updateData: any = {};
    if (payload.student_name !== undefined) updateData.student_name = payload.student_name;
    if (payload.enrollment_no !== undefined) updateData.enrollment_no = payload.enrollment_no;
    if (payload.gender !== undefined) updateData.gender = payload.gender;
    if (payload.phone !== undefined) updateData.phone = payload.phone;
    if (payload.father_name !== undefined) updateData.father_name = payload.father_name;
    if (payload.guardian_phone !== undefined) updateData.guardian_phone = payload.guardian_phone;
    if (payload.emergency_contact !== undefined) updateData.emergency_contact = payload.emergency_contact;
    if (payload.email !== undefined) updateData.email = payload.email;

    let resData: any = null;
    const { data, error } = await supabase
      .from('students')
      .update(updateData)
      .eq('id', studentId)
      .select()
      .maybeSingle();

    if (error) {
      // If error is about email column not existing on students table, omit email and retry
      if (error.message?.includes('email') || error.code === '42703') {
        const { email: _omitted, ...safeUpdate } = updateData;
        const { data: retryData, error: retryErr } = await supabase
          .from('students')
          .update(safeUpdate)
          .eq('id', studentId)
          .select()
          .maybeSingle();
        if (retryErr) throw retryErr;
        resData = retryData;
      } else {
        throw error;
      }
    } else {
      resData = data;
    }

    // Also sync to auth profile if linked
    if (resData?.profile_id) {
      try {
        const profileUpdate: any = {};
        if (payload.email) profileUpdate.email = payload.email;
        if (payload.student_name) profileUpdate.first_name = payload.student_name;
        if (payload.phone) profileUpdate.phone = payload.phone;
        if (Object.keys(profileUpdate).length > 0) {
          await supabase.from('profiles').update(profileUpdate).eq('id', resData.profile_id);
        }
      } catch (pe) {
        console.warn('Student linked profile update warning:', pe);
      }
    }

    return resData || { id: studentId, ...payload };
  },

  /**
   * Create single student record
   */
  async createStudent(payload: {
    student_name: string;
    enrollment_no: string;
    email?: string;
    gender: 'M' | 'F';
    phone?: string;
    father_name?: string;
    guardian_phone?: string;
    emergency_contact?: string;
    room_id?: number | string;
    bed_number?: number | string;
  }) {
    let profileId: string | null = null;
    const studentEmail = payload.email || `${payload.enrollment_no.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.amc.edu`;

    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('enroll-staff', {
        body: {
          name: payload.student_name,
          email: studentEmail,
          phone: payload.phone || '',
          role: 'STUDENT'
        }
      });
      if (!edgeError && edgeData?.userId) {
        profileId = edgeData.userId;
      }
    } catch (e) {
      console.warn('Student enroll edge function skipped:', e);
    }

    const { data, error } = await supabase
      .from('students')
      .insert({
        student_name: payload.student_name,
        enrollment_no: payload.enrollment_no,
        email: studentEmail,
        gender: payload.gender,
        phone: payload.phone || '',
        father_name: payload.father_name || '',
        guardian_phone: payload.guardian_phone || '',
        emergency_contact: payload.emergency_contact || '',
        profile_id: profileId,
        no_dues: true,
        status: 'ACTIVE'
      })
      .select()
      .single();
    
    if (error || !data) {
      throw error || new Error("Failed to create student in the database.");
    }
    const createdStudent = data;

    // Immediate room allocation if specified
    if (payload.room_id) {
      try {
        let bedId: any = null;
        const bedNum = payload.bed_number ? Number(payload.bed_number) : 1;
        const { data: bedRecord } = await supabase
          .from('beds')
          .select('id')
          .eq('room_id', payload.room_id)
          .eq('bed_number', bedNum)
          .single();
        bedId = bedRecord?.id;

        if (bedId) {
          await supabase.rpc('allocate_student_room', {
            p_student_id: data.id,
            p_bed_id: bedId
          });
        }
      } catch (ae) {
        console.warn('Initial room allocation failed:', ae);
      }
    }

    return createdStudent;
  },

  /**
   * Bulk create student records
   */
  async bulkCreateStudents(students: Array<{
    student_name: string;
    enrollment_no: string;
    email?: string;
    gender: 'M' | 'F';
    phone?: string;
    father_name?: string;
    guardian_phone?: string;
    emergency_contact?: string;
  }>) {
    if (!students || students.length === 0) return [];

    const defaultOrgId = '00000000-0000-0000-0000-000000000001';
    const dbPayload = students.map(s => {
      const email = (s.email || '').trim().toLowerCase() || `${s.enrollment_no.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.amc.edu`;
      return {
        student_name: s.student_name.trim(),
        enrollment_no: s.enrollment_no.trim().toUpperCase(),
        email: email,
        gender: s.gender || 'M',
        phone: (s.phone || '').trim(),
        father_name: (s.father_name || '').trim(),
        guardian_phone: (s.guardian_phone || '').trim(),
        emergency_contact: (s.emergency_contact || '').trim(),
        org_id: defaultOrgId,
        no_dues: true,
        status: 'ACTIVE'
      };
    });

    try {
      // 1. Primary Attempt: Upsert with composite key (org_id, enrollment_no)
      const { data, error } = await supabase
        .from('students')
        .upsert(dbPayload, { onConflict: 'org_id,enrollment_no', ignoreDuplicates: false })
        .select();
      
      if (!error && data) {
        return data;
      }

      // 2. Secondary Attempt: Upsert with enrollment_no
      const { data: data2, error: error2 } = await supabase
        .from('students')
        .upsert(dbPayload, { onConflict: 'enrollment_no', ignoreDuplicates: false })
        .select();
      
      if (!error2 && data2) {
        return data2;
      }

      // 3. Bulletproof Fallback: Query existing USNs, update existing and insert new records
      console.warn('Upsert fallback triggered, performing smart split update/insert');
      const usns = dbPayload.map(p => p.enrollment_no);
      const { data: existingRecords } = await supabase
        .from('students')
        .select('id, enrollment_no')
        .in('enrollment_no', usns);
      
      const existingMap = new Map((existingRecords || []).map(r => [r.enrollment_no, r.id]));
      const toInsert: any[] = [];
      const updatePromises: PromiseLike<any>[] = [];

      for (const p of dbPayload) {
        const existingId = existingMap.get(p.enrollment_no);
        if (existingId) {
          updatePromises.push(
            supabase
              .from('students')
              .update({
                student_name: p.student_name,
                email: p.email,
                gender: p.gender,
                phone: p.phone,
                father_name: p.father_name,
                guardian_phone: p.guardian_phone,
                emergency_contact: p.emergency_contact
              })
              .eq('id', existingId)
          );
        } else {
          toInsert.push(p);
        }
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('students').insert(toInsert);
        if (insErr) console.warn('Insert batch warning:', insErr.message);
      }
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      return dbPayload;
    } catch (e: any) {
      console.warn('Bulk student insertion error:', e);
      throw e;
    }
  },

  /**
   * Delete a single student record
   */
  async deleteStudent(studentId: number | string) {
    return this.bulkDeleteStudents([studentId]);
  },

  /**
   * Bulk delete student records and clean up associated room allocations/passes
   */
  async bulkDeleteStudents(studentIds: (number | string)[]) {
    if (!studentIds || studentIds.length === 0) return true;

    try {
      // 1. Release active room allocations
      try {
        await supabase
          .from('room_allocations')
          .delete()
          .in('student_id', studentIds);
      } catch (ae) {
        console.warn('Allocations cleanup warning:', ae);
      }

      // 2. Clean up gate passes
      try {
        await supabase
          .from('gate_pass_requests')
          .delete()
          .in('student_id', studentIds);
      } catch (gpe) {
        console.warn('Gate passes cleanup warning:', gpe);
      }

      // 3. Clean up maintenance issues/complaints
      try {
        await supabase
          .from('maintenance_issues')
          .delete()
          .in('student_id', studentIds);
      } catch (me) {
        console.warn('Issues cleanup warning:', me);
      }

      // 4. Delete students
      const { error } = await supabase
        .from('students')
        .delete()
        .in('id', studentIds);

      if (error) throw error;
      return true;
    } catch (e: any) {
      console.error('Failed to delete student(s):', e);
      throw e;
    }
  },

  /**
   * Staff: Wardens - Backed by Supabase profiles table (role = 'WARDEN')
   */
  async getWardens() {
    if (inFlightWardensPromise) {
      return inFlightWardensPromise;
    }

    inFlightWardensPromise = (async () => {
      try {
        // Fetch manually added wardens
        const { data: customWardens } = await supabase
          .from('hostel_wardens')
          .select('id, name, email, phone, designation, experience, is_active')
          .eq('is_active', true)
          .order('id', { ascending: true });
        
        let combined: any[] = customWardens || [];

        // Fetch registered warden profiles
        try {
          const { data: profileWardens } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone, role')
            .eq('role', 'WARDEN');
          if (profileWardens && profileWardens.length > 0) {
            const mapped = profileWardens.map((w: any) => {
              const matchedCustom = (customWardens || []).find((cw: any) => 
                (cw.email && w.email && cw.email.toLowerCase() === w.email.toLowerCase()) ||
                cw.id === w.id
              );
              return {
                id: w.id,
                name: `${w.first_name || ''} ${w.last_name || ''}`.trim() || matchedCustom?.name || w.email,
                email: w.email,
                phone: w.phone || matchedCustom?.phone || '',
                designation: matchedCustom?.designation || 'Hostel Warden',
                experience: matchedCustom?.experience !== undefined ? Number(matchedCustom.experience) : 5
              };
            });

            const profileEmails = mapped.map(m => (m.email || '').toLowerCase()).filter(Boolean);
            const nonDuplicateCustom = (customWardens || []).filter((cw: any) => !profileEmails.includes((cw.email || '').toLowerCase()));
            combined = [...mapped, ...nonDuplicateCustom];
          }
        } catch (err) {
          console.warn('Could not fetch WARDEN profiles:', err);
        }
        
        return combined;
      } finally {
        inFlightWardensPromise = null;
      }
    })();

    return inFlightWardensPromise;
  },

  async createWarden(payload: { name: string; email?: string; phone: string; designation?: string; experience?: number }) {
    if (payload.email) {
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('enroll-staff', {
          body: { ...payload, role: 'WARDEN' }
        });
        if (!edgeError && edgeData?.success) {
          // Fallback to fetch the newly created warden just to return it in the format the UI expects
          return { id: edgeData.userId, name: payload.name, email: payload.email, phone: payload.phone };
        }
        if (edgeData && !edgeData.success) {
          throw new Error(edgeData.error || "Edge function failed during user creation.");
        }
        if (edgeError) console.warn("Edge function failed, falling back to manual insert:", edgeError);
      } catch (e) {
        console.warn("Could not invoke edge function:", e);
      }
    }
    const { data, error } = await supabase.from('hostel_wardens').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async updateWarden(id: string | number, payload: Partial<{ name: string; email?: string; phone: string; designation?: string; experience?: number }>) {
    const isUuid = typeof id === 'string' && id.includes('-');
    let targetEmail = payload.email;

    if (isUuid) {
      const profileUpdate: any = {};
      if (payload.name) {
        const parts = payload.name.trim().split(' ');
        profileUpdate.first_name = parts[0] || '';
        profileUpdate.last_name = parts.slice(1).join(' ') || '';
      }
      if (payload.phone !== undefined) profileUpdate.phone = payload.phone;
      if (payload.email !== undefined) profileUpdate.email = payload.email;

      let profileResult: any = null;
      if (Object.keys(profileUpdate).length > 0) {
        const { data: profData, error: profError } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (profError) throw profError;
        profileResult = profData;
        if (profData?.email) targetEmail = profData.email;
      }

      if (!targetEmail) {
        const { data: prof } = await supabase.from('profiles').select('email').eq('id', id).maybeSingle();
        if (prof?.email) targetEmail = prof.email;
      }

      if (targetEmail) {
        try {
          const { data: existingWarden } = await supabase
            .from('hostel_wardens')
            .select('id')
            .ilike('email', targetEmail)
            .maybeSingle();

          if (existingWarden) {
            await supabase.from('hostel_wardens').update({
              ...(payload.name ? { name: payload.name } : {}),
              ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
              ...(payload.designation ? { designation: payload.designation } : {}),
              ...(payload.experience !== undefined ? { experience: Number(payload.experience) } : {})
            }).eq('id', existingWarden.id);
          } else {
            await supabase.from('hostel_wardens').insert({
              name: payload.name || targetEmail,
              email: targetEmail,
              phone: payload.phone || '',
              designation: payload.designation || 'Hostel Warden',
              experience: Number(payload.experience) || 5,
              is_active: true
            });
          }
        } catch (we) {
          console.warn('Sync to hostel_wardens failed:', we);
        }
      }

      return { id, ...payload, ...(profileResult || {}), email: targetEmail };
    }

    const { data, error } = await supabase.from('hostel_wardens').update(payload).eq('id', id).select().single();
    if (error) throw error;

    if (data?.email) {
      try {
        const profSync: any = {};
        if (payload.name) {
          const parts = payload.name.trim().split(' ');
          profSync.first_name = parts[0] || '';
          profSync.last_name = parts.slice(1).join(' ') || '';
        }
        if (payload.phone !== undefined) profSync.phone = payload.phone;
        if (Object.keys(profSync).length > 0) {
          await supabase.from('profiles').update(profSync).ilike('email', data.email);
        }
      } catch (pe) {
        console.warn('Profile sync from hostel_wardens update failed:', pe);
      }
    }

    return data;
  },

  async deleteWarden(id: string | number) {
    if (typeof id === 'string' && id.includes('-')) {
      try {
        const { data: prof } = await supabase.from('profiles').select('email').eq('id', id).maybeSingle();
        if (prof?.email) {
          await supabase.from('hostel_wardens').update({ is_active: false }).ilike('email', prof.email);
        }
      } catch (e) {
        console.warn('Hostel wardens deactivate error:', e);
      }
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    }
    const { error } = await supabase.from('hostel_wardens').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  /**
   * Staff: Caretakers - Directly backed by Supabase hostel_caretakers table
   */
  async getCaretakers() {
    if (inFlightCaretakersPromise) {
      return inFlightCaretakersPromise;
    }

    inFlightCaretakersPromise = (async () => {
      try {
        const { data: customCaretakers } = await supabase
          .from('hostel_caretakers')
          .select('id, name, email, phone, experience, is_active')
          .eq('is_active', true)
          .order('id', { ascending: true });
        
        let combined: any[] = customCaretakers || [];

        try {
          const { data: profileCaretakers } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, phone, role')
            .eq('role', 'CARETAKER');
          if (profileCaretakers && profileCaretakers.length > 0) {
            const mapped = profileCaretakers.map((c: any) => {
              const matched = (customCaretakers || []).find((cd: any) => 
                (cd.email && c.email && cd.email.toLowerCase() === c.email.toLowerCase()) ||
                cd.id === c.id
              );
              return {
                id: c.id,
                name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || matched?.name || c.email,
                email: c.email,
                phone: c.phone || matched?.phone || '',
                experience: matched?.experience !== undefined ? Number(matched.experience) : 3
              };
            });
            const profileEmails = mapped.map(m => (m.email || '').toLowerCase()).filter(Boolean);
            const nonDup = (customCaretakers || []).filter((cd: any) => !profileEmails.includes((cd.email || '').toLowerCase()));
            combined = [...mapped, ...nonDup];
          }
        } catch (err) {
          console.warn('Could not fetch CARETAKER profiles:', err);
        }
        return combined;
      } finally {
        inFlightCaretakersPromise = null;
      }
    })();

    return inFlightCaretakersPromise;
  },

  async createCaretaker(payload: { name: string; email?: string; phone: string; experience?: number }) {
    if (payload.email) {
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('enroll-staff', {
          body: { ...payload, role: 'CARETAKER' }
        });
        if (!edgeError && edgeData?.success) {
          return { id: edgeData.userId, name: payload.name, email: payload.email, phone: payload.phone };
        }
      } catch (e) {
        console.warn("Could not invoke edge function:", e);
      }
    }
    const { data, error } = await supabase.from('hostel_caretakers').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async updateCaretaker(id: string | number, payload: Partial<{ name: string; email?: string; phone: string; experience?: number }>) {
    const isUuid = typeof id === 'string' && id.includes('-');
    let targetEmail = payload.email;

    if (isUuid) {
      const profileUpdate: any = {};
      if (payload.name) {
        const parts = payload.name.trim().split(' ');
        profileUpdate.first_name = parts[0] || '';
        profileUpdate.last_name = parts.slice(1).join(' ') || '';
      }
      if (payload.phone !== undefined) profileUpdate.phone = payload.phone;
      if (payload.email !== undefined) profileUpdate.email = payload.email;

      let profileResult: any = null;
      if (Object.keys(profileUpdate).length > 0) {
        const { data: profData, error: profError } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (profError) throw profError;
        profileResult = profData;
        if (profData?.email) targetEmail = profData.email;
      }

      if (!targetEmail) {
        const { data: prof } = await supabase.from('profiles').select('email').eq('id', id).maybeSingle();
        if (prof?.email) targetEmail = prof.email;
      }

      if (targetEmail) {
        try {
          const { data: existingCaretaker } = await supabase
            .from('hostel_caretakers')
            .select('id')
            .ilike('email', targetEmail)
            .maybeSingle();

          if (existingCaretaker) {
            await supabase.from('hostel_caretakers').update({
              ...(payload.name ? { name: payload.name } : {}),
              ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
              ...(payload.experience !== undefined ? { experience: Number(payload.experience) } : {})
            }).eq('id', existingCaretaker.id);
          } else {
            await supabase.from('hostel_caretakers').insert({
              name: payload.name || targetEmail,
              email: targetEmail,
              phone: payload.phone || '',
              experience: Number(payload.experience) || 3,
              is_active: true
            });
          }
        } catch (ce) {
          console.warn('Sync to hostel_caretakers failed:', ce);
        }
      }

      return { id, ...payload, ...(profileResult || {}), email: targetEmail };
    }

    const { data, error } = await supabase.from('hostel_caretakers').update(payload).eq('id', id).select().single();
    if (error) throw error;

    if (data?.email) {
      try {
        const profSync: any = {};
        if (payload.name) {
          const parts = payload.name.trim().split(' ');
          profSync.first_name = parts[0] || '';
          profSync.last_name = parts.slice(1).join(' ') || '';
        }
        if (payload.phone !== undefined) profSync.phone = payload.phone;
        if (Object.keys(profSync).length > 0) {
          await supabase.from('profiles').update(profSync).ilike('email', data.email);
        }
      } catch (pe) {
        console.warn('Profile sync from hostel_caretakers update failed:', pe);
      }
    }

    return data;
  },

  async deleteCaretaker(id: string | number) {
    if (typeof id === 'string' && id.includes('-')) {
      try {
        const { data: prof } = await supabase.from('profiles').select('email').eq('id', id).maybeSingle();
        if (prof?.email) {
          await supabase.from('hostel_caretakers').update({ is_active: false }).ilike('email', prof.email);
        }
      } catch (e) {
        console.warn('Hostel caretakers deactivate error:', e);
      }
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    }
    const { error } = await supabase.from('hostel_caretakers').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  /**
   * Staff: Security
   */
  async getSecurityStaff() {
    if (inFlightSecurityStaffPromise) {
      return inFlightSecurityStaffPromise;
    }

    inFlightSecurityStaffPromise = (async () => {
      try {
        // Fetch manually added security staff
        const { data: customSecurity } = await supabase
          .from('security_staff')
          .select('*')
          .eq('is_active', true)
          .order('id', { ascending: true });
        
        let combined: any[] = customSecurity || [];

        // Fetch registered security profiles
        try {
          const { data: profileSecurity } = await supabase.from('profiles').select('*').eq('role', 'SECURITY');
          if (profileSecurity && profileSecurity.length > 0) {
            const mapped = profileSecurity.map((w: any) => {
              const matched = (customSecurity || []).find((cs: any) => 
                (cs.email && w.email && cs.email.toLowerCase() === w.email.toLowerCase()) ||
                cs.id === w.id
              );
              return {
                id: w.id,
                name: `${w.first_name || ''} ${w.last_name || ''}`.trim() || matched?.name || w.email,
                email: w.email,
                phone: w.phone || matched?.phone || '',
                designation: matched?.designation || 'Security Guard',
                experience: matched?.experience !== undefined ? Number(matched?.experience) : 5
              };
            });
            const profileEmails = mapped.map(m => (m.email || '').toLowerCase()).filter(Boolean);
            const nonDuplicateCustom = (customSecurity || []).filter((cs: any) => !profileEmails.includes((cs.email || '').toLowerCase()));
            combined = [...mapped, ...nonDuplicateCustom];
          }
        } catch (err) {
          console.warn('Could not fetch SECURITY profiles:', err);
        }

        return combined;
      } finally {
        inFlightSecurityStaffPromise = null;
      }
    })();

    return inFlightSecurityStaffPromise;
  },

  async createSecurityStaff(payload: { name: string; email?: string; phone: string; designation?: string; experience?: number }) {
    if (payload.email) {
      try {
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke('enroll-staff', {
          body: { ...payload, role: 'SECURITY' }
        });
        if (!edgeError && edgeData?.success) {
          return { id: edgeData.userId, name: payload.name, email: payload.email, phone: payload.phone };
        }
      } catch (e) {
        console.warn("Could not invoke edge function:", e);
      }
    }
    const { data, error } = await supabase.from('security_staff').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async updateSecurityStaff(id: string | number, payload: Partial<{ name: string; email?: string; phone: string; designation?: string; experience?: number }>) {
    const isUuid = typeof id === 'string' && id.includes('-');
    let targetEmail = payload.email;

    if (isUuid) {
      const profileUpdate: any = {};
      if (payload.name) {
        const parts = payload.name.trim().split(' ');
        profileUpdate.first_name = parts[0] || '';
        profileUpdate.last_name = parts.slice(1).join(' ') || '';
      }
      if (payload.phone !== undefined) profileUpdate.phone = payload.phone;
      if (payload.email !== undefined) profileUpdate.email = payload.email;

      let profileResult: any = null;
      if (Object.keys(profileUpdate).length > 0) {
        const { data: profData, error: profError } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (profError) throw profError;
        profileResult = profData;
        if (profData?.email) targetEmail = profData.email;
      }

      if (!targetEmail) {
        const { data: prof } = await supabase.from('profiles').select('email').eq('id', id).maybeSingle();
        if (prof?.email) targetEmail = prof.email;
      }

      if (targetEmail) {
        try {
          const { data: existingSecurity } = await supabase
            .from('security_staff')
            .select('id')
            .ilike('email', targetEmail)
            .maybeSingle();

          if (existingSecurity) {
            await supabase.from('security_staff').update({
              ...(payload.name ? { name: payload.name } : {}),
              ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
              ...(payload.designation ? { designation: payload.designation } : {}),
              ...(payload.experience !== undefined ? { experience: Number(payload.experience) } : {})
            }).eq('id', existingSecurity.id);
          } else {
            await supabase.from('security_staff').insert({
              name: payload.name || targetEmail,
              email: targetEmail,
              phone: payload.phone || '',
              designation: payload.designation || 'Security Guard',
              experience: Number(payload.experience) || 5,
              is_active: true
            });
          }
        } catch (se) {
          console.warn('Sync to security_staff failed:', se);
        }
      }

      return { id, ...payload, ...(profileResult || {}), email: targetEmail };
    }

    const { data, error } = await supabase.from('security_staff').update(payload).eq('id', id).select().single();
    if (error) throw error;

    if (data?.email) {
      try {
        const profSync: any = {};
        if (payload.name) {
          const parts = payload.name.trim().split(' ');
          profSync.first_name = parts[0] || '';
          profSync.last_name = parts.slice(1).join(' ') || '';
        }
        if (payload.phone !== undefined) profSync.phone = payload.phone;
        if (Object.keys(profSync).length > 0) {
          await supabase.from('profiles').update(profSync).ilike('email', data.email);
        }
      } catch (pe) {
        console.warn('Profile sync from security_staff update failed:', pe);
      }
    }

    return data;
  },

  async deleteSecurityStaff(id: string | number) {
    if (typeof id === 'string' && id.includes('-')) {
      try {
        const { data: prof } = await supabase.from('profiles').select('email').eq('id', id).maybeSingle();
        if (prof?.email) {
          await supabase.from('security_staff').update({ is_active: false }).ilike('email', prof.email);
        }
      } catch (e) {
        console.warn('Security staff deactivate error:', e);
      }
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    }
    const { error } = await supabase.from('security_staff').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  }
};
