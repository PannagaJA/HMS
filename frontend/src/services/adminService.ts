/**
 * Admin Role Service
 * Handles system-wide operations, hostel configurations, room matrix, resident directory, and staff management.
 */
import { supabase } from '../lib/supabase';
import type { Hostel, HostelRoom, HostelStudent } from '../types';

export const adminService = {
  /**
   * Fetch aggregated system-wide dashboard stats
   */
  async getDashboardStats() {
    // Always use direct table queries for accuracy — avoids view field name inconsistencies
    // (view may return 'open_issues' vs 'active_issues' depending on which SQL fix was run)
    const [h, beds, a, p, iss] = await Promise.all([
      supabase.from('hostels').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('beds').select('id', { count: 'exact', head: true }),
      supabase.from('room_allocations').select('id', { count: 'exact', head: true }).eq('is_active', true),
      // Match both PENDING (uppercase) and pending (lowercase) in case of data inconsistency
      supabase.from('gate_passes').select('id', { count: 'exact', head: true }).or('status.eq.PENDING,status.eq.pending'),
      // Count issues that are NOT completed (handles both case variants)
      supabase.from('issues').select('id', { count: 'exact', head: true }).not('status', 'in', '(COMPLETED,completed,closed,CLOSED)')
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

    console.log('[adminService.getDashboardStats] stats:', stats);
    return { statistics: stats };
  },


  /**
   * Fetch all active hostel blocks with occupancy metrics
   */
  async getHostels(): Promise<Hostel[]> {
    let hostels: any[] = [];
    try {
      const { data, error } = await supabase
        .from('hostels')
        .select('*, rooms:hostel_rooms(id, capacity, is_active)')
        .eq('is_active', true);
      if (!error && data) {
        hostels = data;
      }
    } catch (e) {
      console.warn('Failed to load hostels from supabase:', e);
    }
    let combinedHostels = hostels;
    if (combinedHostels.length === 0) {
      return [];
    }

    const [wardensList, caretakersList, activeAllocsRes] = await Promise.all([
      adminService.getWardens(),
      adminService.getCaretakers(),
      supabase.from('room_allocations').select('id, bed:beds(room:hostel_rooms(hostel_id))').eq('is_active', true)
    ]);

    const activeAllocs = activeAllocsRes.data || [];

    return combinedHostels.map((h: any) => {
      const totalRooms = (h.rooms || []).filter((r: any) => r.is_active).length;
      const totalCap = (h.rooms || []).filter((r: any) => r.is_active).reduce((sum: number, r: any) => sum + (r.capacity || 0), 0);
      const occ = activeAllocs.filter((a: any) => a.bed?.room?.hostel_id === h.id).length;
      
      const wDetail = h.warden_id ? wardensList.find(w => String(w.id) === String(h.warden_id)) : null;
      const cDetail = h.caretaker_id ? caretakersList.find(c => String(c.id) === String(h.caretaker_id)) : null;

      
      const assignedWardenId = h.warden || h.wardens?.[0]?.warden_profile_id || null;
      const assignedCaretakerId = h.caretaker || null;

      const wardenDetail = wardensList.find((w: any) => String(w.id) === String(assignedWardenId)) || null;
      const caretakerDetail = caretakersList.find((c: any) => String(c.id) === String(assignedCaretakerId)) || null;

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
        room_type_display: r.room_type === 'S' ? 'Single' : r.room_type === 'D' ? 'Double' : r.room_type === 'T' ? 'Triple' : 'Multi-Bed'
      };
    });
  },

  /**
   * Fetch resident students directory
   */
  async getStudents(): Promise<HostelStudent[]> {
    let students: any[] = [];
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, course:hostel_courses(*), allocations:room_allocations(*, bed:beds(*, room:hostel_rooms(*, hostel:hostels(*))))')
        .order('student_name', { ascending: true });
      if (!error && data) {
        students = data;
      }
    } catch (e) {
      console.warn('Failed to load students from supabase:', e);
    }

    const combinedStudents = [...students];

    return combinedStudents.map((s: any) => {
      const activeAlloc = (s.allocations || []).find((a: any) => a.is_active);
      const bed = activeAlloc?.bed;
      const room = bed?.room;
      const hostel = room?.hostel;
      const resolvedEmail = s.email || s.profile?.email || (s.enrollment_no ? `${s.enrollment_no.toLowerCase()}@amc.edu` : '');
      return {
        ...s,
        email: resolvedEmail,
        room_allotted: !!activeAlloc || !!s.room_allotted,
        hostel_name: hostel?.name || s.hostel_name || '',
        room_no: room?.no || s.room_no || s.room_number || '',
        room_number: room?.no || s.room_number || s.room_no || '',
        bed_number: bed?.bed_number || s.bed_number || null,
        hostel: hostel ? hostel.id : s.hostel || null,
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
    gender: 'M' | 'F';
    phone?: string;
    father_name?: string;
    guardian_phone?: string;
    emergency_contact?: string;
  }>) {
    const results: any[] = [];
    const dbPayload = students.map(s => ({
      student_name: s.student_name,
      enrollment_no: s.enrollment_no,
      gender: s.gender || 'M',
      phone: s.phone || '',
      father_name: s.father_name || '',
      guardian_phone: s.guardian_phone || '',
      emergency_contact: s.emergency_contact || '',
      no_dues: true,
      status: 'ACTIVE'
    }));

    try {
      const { data, error } = await supabase
        .from('students')
        .insert(dbPayload)
        .select();
      
      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('Bulk student insert failed:', e);
      throw e;
    }

    return results;
  },

  /**
   * Staff: Wardens - Backed by Supabase profiles table (role = 'WARDEN')
   */
  async getWardens() {
    // Fetch manually added wardens
    const { data: customWardens, error } = await supabase
      .from('hostel_wardens')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });
    
    let combined = customWardens || [];

    // Fetch registered warden profiles
    try {
      const { data: profileWardens } = await supabase.from('profiles').select('*').eq('role', 'WARDEN');
      if (profileWardens && profileWardens.length > 0) {
        const mapped = profileWardens.map((w: any) => ({
          id: w.id,
          name: `${w.first_name || ''} ${w.last_name || ''}`.trim() || w.email,
          email: w.email,
          phone: w.phone || '',
          designation: 'Hostel Warden',
          experience: 5
        }));

        const profileEmails = mapped.map(m => (m.email || '').toLowerCase()).filter(Boolean);
        const nonDuplicateCustom = (customWardens || []).filter((cw: any) => !profileEmails.includes((cw.email || '').toLowerCase()));
        combined = [...mapped, ...nonDuplicateCustom];
      }
    } catch (err) {
      console.warn('Could not fetch WARDEN profiles:', err);
    }
    
    return combined;
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
    if (typeof id === 'string' && id.includes('-')) {
      throw new Error("Cannot edit a registered system user from this dashboard.");
    }
    const { data, error } = await supabase.from('hostel_wardens').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteWarden(id: string | number) {
    if (typeof id === 'string' && id.includes('-')) {
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
    const { data, error } = await supabase
      .from('hostel_caretakers')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });
    if (error) throw error;
    return data || [];
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
    const { data, error } = await supabase.from('hostel_caretakers').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteCaretaker(id: string | number) {
    if (typeof id === 'string' && id.includes('-')) {
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
    // Fetch manually added security staff
    const { data: customSecurity, error } = await supabase
      .from('security_staff')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });
    
    let combined = customSecurity || [];

    // Fetch registered security profiles
    try {
      const { data: profileSecurity } = await supabase.from('profiles').select('*').eq('role', 'SECURITY');
      if (profileSecurity) {
        const mapped = profileSecurity.map((w: any) => ({
          id: w.id,
          name: `${w.first_name || ''} ${w.last_name || ''}`.trim() || w.email,
          email: w.email,
          phone: w.phone || '',
          designation: 'Security Guard',
          experience: 5
        }));
        combined = [...mapped, ...combined];
      }
    } catch (err) {
      console.warn('Could not fetch SECURITY profiles:', err);
    }

    return combined;
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
    if (typeof id === 'string' && id.includes('-')) {
      throw new Error("Cannot edit a registered system user from this dashboard.");
    }
    const { data, error } = await supabase.from('security_staff').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteSecurityStaff(id: string | number) {
    if (typeof id === 'string' && id.includes('-')) {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    }
    const { error } = await supabase.from('security_staff').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  }
};
