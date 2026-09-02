import { supabase } from '../lib/supabase';
import type { Profile, User } from '../types';

export const apiClient = {
  async get<T = any>(endpoint: string) {
    // 1. Current user profile (/auth/me/)
    if (endpoint.includes('/auth/me/')) {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return { data: null as T };
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      const mappedUser: User = {
        id: user.id as any,
        email: user.email || '',
        role: profile?.role || 'ADMIN',
        first_name: profile?.first_name || '',
        last_name: profile?.last_name || '',
        phone: profile?.phone || '',
        avatar_url: profile?.avatar_url || '',
        is_active: profile?.is_active ?? true,
        created_at: profile?.created_at || user.created_at,
        updated_at: profile?.updated_at || user.created_at
      };
      return { data: mappedUser as T };
    }

    // 2. Staff Management (/hms/wardens/ & /hms/caretakers/)
    if (endpoint.includes('/hms/wardens/')) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'WARDEN');
      const wardens = (data || []).map((w: any) => ({
        id: w.id,
        name: `${w.first_name || ''} ${w.last_name || ''}`.trim() || w.email,
        email: w.email,
        phone: w.phone || '',
        designation: 'Hostel Warden',
        experience: 5
      }));
      return { data: wardens as T };
    }
    if (endpoint.includes('/hms/caretakers/')) {
      const { data, error } = await supabase
        .from('hostel_caretakers')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });
      if (error) throw error;
      return { data: (data || []) as T };
    }

    // 3. Students / Resident Directory (/hms/students/)
    if (endpoint.includes('/hms/students/')) {
      const { data: students, error } = await supabase
        .from('students')
        .select('*, course:hostel_courses(*), allocations:room_allocations(*, bed:beds(*, room:hostel_rooms(*, hostel:hostels(*))))')
        .order('student_name', { ascending: true });
      if (error) throw error;
      
      const mapped = (students || []).map((s: any) => {
        const activeAlloc = (s.allocations || []).find((a: any) => a.is_active);
        const bed = activeAlloc?.bed;
        const room = bed?.room;
        const hostel = room?.hostel;
        return {
          ...s,
          room_allotted: !!activeAlloc,
          hostel_name: hostel?.name || '',
          room_no: room?.no || '',
          room_number: room?.no || '',
          bed_number: bed?.bed_number || null,
          hostel: hostel ? hostel.id : null,
          room_detail: room || null
        };
      });
      return { data: mapped as T };
    }

    // 4. Hostels Management (/hms/hostels/)
    if (endpoint.includes('/hms/hostels/')) {
      const { data: hostels, error } = await supabase
        .from('hostels')
        .select('*, rooms:hostel_rooms(id, capacity, is_active), wardens:warden_hostel_assignments(warden_profile_id)')
        .eq('is_active', true);
      if (error) throw error;

      const { data: activeAllocs } = await supabase
        .from('room_allocations')
        .select('id, bed:beds(room:hostel_rooms(hostel_id))')
        .eq('is_active', true);

      const mapped = (hostels || []).map((h: any) => {
        const totalRooms = (h.rooms || []).filter((r: any) => r.is_active).length;
        const totalCap = (h.rooms || []).filter((r: any) => r.is_active).reduce((sum: number, r: any) => sum + (r.capacity || 0), 0);
        const occ = (activeAllocs || []).filter((a: any) => a.bed?.room?.hostel_id === h.id).length;
        return {
          ...h,
          total_rooms: totalRooms,
          total_capacity: totalCap,
          occupied_beds: occ,
          warden: h.wardens?.[0]?.warden_profile_id || null,
          warden_detail: null,
          caretaker: null
        };
      });
      return { data: mapped as T };
    }

    // 5. Rooms Management (/hms/rooms/)
    if (endpoint.includes('/hms/rooms/')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      const hostelFilter = urlParams.get('hostel') || urlParams.get('hostel_id');
      
      let query = supabase
        .from('hostel_rooms')
        .select('*, hostel:hostels(name), beds(*, allocations:room_allocations(*, student:students(*)))')
        .eq('is_active', true)
        .order('no', { ascending: true });

      if (hostelFilter) {
        query = query.eq('hostel_id', hostelFilter);
      }

      const { data: rooms, error } = await query;
      if (error) throw error;

      const mapped = (rooms || []).map((r: any) => {
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
      return { data: mapped as T };
    }

    // 6. Warden Dashboard & Rooms (/warden/dashboard/ & /warden/rooms/)
    if (endpoint.includes('/warden/dashboard/')) {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
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
        data: {
          managed_hostels: managedHostels,
          total_rooms: primary?.total_rooms || 0,
          total_capacity: totalCap,
          pending_gate_passes: primary?.pending_gate_passes || 0,
          open_issues: primary?.open_issues || 0,
          occupancy_rate: rate
        } as T
      };
    }
    if (endpoint.includes('/warden/rooms/')) {
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      const hostelId = urlParams.get('hostel_id');
      const floor = urlParams.get('floor');
      let query = supabase.from('hostel_rooms').select('*, beds(*, allocations:room_allocations(*, student:students(*)))').eq('is_active', true);
      if (hostelId) query = query.eq('hostel_id', hostelId);
      if (floor && floor !== 'all') query = query.eq('floor', floor);
      const { data, error } = await query;
      if (error) throw error;
      return { data: (data || []) as T };
    }

    // 7. Maintenance Issues (/hms/issues/)
    if (endpoint.includes('/hms/issues/') || endpoint.includes('/warden/issues/')) {
      const { data: issues, error } = await supabase
        .from('issues')
        .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no), updates:issue_updates(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const mapped = (issues || []).map((i: any) => ({
        ...i,
        student_name: i.student?.student_name || 'Resident',
        enrollment_no: i.student?.enrollment_no || 'N/A',
        hostel_name: i.hostel?.name || 'Block A',
        room_no: i.room?.no || '101',
        updates: i.updates || []
      }));
      return { data: mapped as T };
    }

    // 8. Gate Passes (/gate-passes/ & /security/gate-passes/)
    if (endpoint.includes('/gate-passes/') || endpoint.includes('/gatepass/') || endpoint.includes('/security/passes/') || endpoint.includes('/security/gate-passes/')) {
      const { data, error } = await supabase
        .from('gate_passes')
        .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const formatted = (data || []).map((gp: any) => ({
        ...gp,
        student_name: gp.student?.student_name || 'Student Resident',
        enrollment_no: gp.student?.enrollment_no || 'N/A',
        hostel_name: gp.hostel?.name || 'Aryabhata Bhavan',
        room_no: gp.room?.no || '101'
      }));
      return { data: formatted as T };
    }

    // 9. Visitor Checkpoint Logs (/hms/visitor-logs/ & /hms/visitors/)
    if (endpoint.includes('/visitor-logs/') || endpoint.includes('/hms/visitors/')) {
      const { data: logs, error } = await supabase
        .from('visitor_logs')
        .select('*, student:students(*), hostel:hostels(name), room:hostel_rooms(no)')
        .order('check_in_time', { ascending: false });
      if (error) throw error;

      const mapped = (logs || []).map((v: any) => ({
        ...v,
        visitor_phone: v.mobile_number,
        student_name: v.student?.student_name || 'Resident',
        enrollment_no: v.student?.enrollment_no || 'N/A',
        hostel_name: v.hostel?.name || 'Block A',
        student_room: v.room?.no || '101',
        status: v.check_out_time ? 'CHECKED_OUT' : 'CHECKED_IN'
      }));
      return { data: mapped as T };
    }

    // 10. Admin Telemetry & Statistics (/hms/dashboard/stats/)
    if (endpoint.includes('/hms/dashboard/stats/')) {
      const { data, error } = await supabase.from('view_admin_dashboard_stats').select('*').single();
      if (!error && data) {
        return { data: { statistics: data } as T };
      }
      const [h, r, a, p, iss] = await Promise.all([
        supabase.from('hostels').select('id', { count: 'exact', head: true }),
        supabase.from('hostel_rooms').select('id, capacity').eq('is_active', true),
        supabase.from('room_allocations').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('gate_passes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('issues').select('id', { count: 'exact', head: true }).neq('status', 'completed')
      ]);
      const totalCapacity = (r.data || []).reduce((sum, item) => sum + (item.capacity || 0), 0);
      const occupied = a.count || 0;
      return {
        data: {
          statistics: {
            total_hostels: h.count || 0,
            total_rooms: (r.data || []).length,
            total_capacity: totalCapacity,
            occupied_beds: occupied,
            vacant_beds: Math.max(0, totalCapacity - occupied),
            occupancy_rate: totalCapacity > 0 ? Math.round((occupied / totalCapacity) * 100) : 0,
            pending_gate_passes: p.count || 0,
            active_issues: iss.count || 0
          }
        } as T
      };
    }

    // 11. Courses & Dining (/hms/courses/, /hms/meal-types/, /hms/menu-items/, /hms/menus/)
    if (endpoint.includes('/hms/courses/')) {
      const { data, error } = await supabase.from('hostel_courses').select('*');
      if (error) throw error;
      return { data: data as T };
    }
    if (endpoint.includes('/hms/meal-types/')) {
      const { data, error } = await supabase.from('meal_types').select('*').order('id', { ascending: true });
      if (error) throw error;
      return { data: data as T };
    }
    if (endpoint.includes('/hms/menu-items/')) {
      const { data, error } = await supabase.from('menu_items').select('*').order('name', { ascending: true });
      if (error) throw error;
      return { data: data as T };
    }
    if (endpoint.includes('/hms/menus/') || endpoint.includes('/mess/menu/')) {
      const { data, error } = await supabase
        .from('menus')
        .select('*, meal_type:meal_types(*), links:menu_item_links(item:menu_items(*))');
      if (error) throw error;
      const mapped = (data || []).map((m: any) => ({
        ...m,
        items: (m.links || []).map((l: any) => l.item).filter(Boolean)
      }));
      return { data: mapped as T };
    }

    return { data: [] as T };
  },

  async post<T = any>(endpoint: string, body?: any) {
    // Allocate Room (Supports both endpoint styles)
    if (endpoint.includes('/allocate-room') || endpoint.includes('/allocate/')) {
      let bedId = body?.bed_id;
      // If client supplied room_id and bed_number, resolve physical bed ID
      if (!bedId && body?.room_id) {
        const bedNum = body?.bed_number ? Number(body.bed_number) : 1;
        const { data: bedRecord } = await supabase
          .from('beds')
          .select('id')
          .eq('room_id', body.room_id)
          .eq('bed_number', bedNum)
          .single();
        bedId = bedRecord?.id;
      }

      const { data, error } = await supabase.rpc('allocate_student_room', {
        p_student_id: body?.student_id || body?.student,
        p_bed_id: bedId,
      });
      if (error) throw error;
      return { data: data as T };
    }

    // Vacate Room
    if (endpoint.includes('/vacate')) {
      const studentId = body?.student_id || parseInt(endpoint.split('/')[3] || '0', 10);
      const { data, error } = await supabase.rpc('vacate_student_room', {
        p_student_id: studentId,
      });
      if (error) throw error;
      return { data: data as T };
    }

    // Create Room with physical beds
    if (endpoint.includes('/hms/rooms/')) {
      const { data, error } = await supabase.rpc('create_room_with_beds', {
        p_hostel_id: body?.hostel || body?.hostel_id,
        p_room_no: body?.no || body?.room_no,
        p_floor: body?.floor || 0,
        p_capacity: body?.capacity || 2,
        p_room_type: body?.room_type || 'D'
      });
      if (error) throw error;
      return { data: data as T };
    }

    // Create Maintenance Issue
    if (endpoint.includes('/hms/issues/') && !endpoint.includes('update_status')) {
      const { data, error } = await supabase.from('issues').insert(body).select().single();
      if (error) throw error;
      return { data: data as T };
    }

    // Update Issue Status (RPC)
    if (endpoint.includes('/update_status/')) {
      const parts = endpoint.split('/');
      const issueId = parseInt(parts[parts.indexOf('issues') + 1] || '0', 10);
      const { data, error } = await supabase.rpc('update_issue_status', {
        p_issue_id: issueId,
        p_new_status: body?.status,
        p_note: body?.note || ''
      });
      if (error) throw error;
      return { data: data as T };
    }

    // Gate Pass Actions (Approve / Reject)
    if (endpoint.includes('/warden_action/') || endpoint.includes('/action/')) {
      const parts = endpoint.split('/');
      const passId = parseInt(parts[parts.indexOf('gate-passes') + 1] || '0', 10);
      const action = body?.action;
      const fnName = action === 'approve' ? 'approve_gate_pass' : 'reject_gate_pass';
      const { data, error } = await supabase.rpc(fnName, {
        p_pass_id: passId,
        p_note: body?.note || ''
      });
      if (error) throw error;
      return { data: data as T };
    }

    // Visitor Check-In
    if (endpoint.includes('/visitor-logs/')) {
      // Look up student by enrollment_no
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('enrollment_no', body?.enrollment_no)
        .single();
      
      if (!student) throw new Error(`Student with enrollment ${body?.enrollment_no} not found`);

      const { data, error } = await supabase.from('visitor_logs').insert({
        student_id: student.id,
        visitor_name: body?.visitor_name,
        mobile_number: body?.mobile_number || body?.visitor_phone,
        purpose: body?.purpose || 'Visit'
      }).select().single();
      if (error) throw error;
      return { data: data as T };
    }

    // Visitor Checkout
    if (endpoint.includes('/checkout_visitor/')) {
      const parts = endpoint.split('/');
      const visitorId = parseInt(parts[parts.indexOf('visitor-logs') + 1] || '0', 10);
      const { data, error } = await supabase.rpc('checkout_visitor', {
        p_visitor_id: visitorId
      });
      if (error) throw error;
      return { data: data as T };
    }

    // Caretaker Creation
    if (endpoint.includes('/hms/caretakers/')) {
      const { data, error } = await supabase.from('hostel_caretakers').insert({
        name: body?.name,
        email: body?.email,
        phone: body?.phone,
        experience: body?.experience || 0
      }).select().single();
      if (error) throw error;
      return { data: data as T };
    }

    return { data: {} as T };
  },

  async put<T = any>(_endpoint: string, body: any) {
    return { data: body as T };
  },

  async patch<T = any>(endpoint: string, body: any) {
    // Room Resizing via RPC
    if (endpoint.includes('/hms/rooms/')) {
      const parts = endpoint.split('/');
      const roomId = parseInt(parts[parts.indexOf('rooms') + 1] || '0', 10);
      if (body?.capacity) {
        const { data, error } = await supabase.rpc('resize_room_capacity', {
          p_room_id: roomId,
          p_new_capacity: body.capacity
        });
        if (error) throw error;
        return { data: data as T };
      }
    }

    // Profile Updates
    if (endpoint.includes('/auth/profile/')) {
      const { data, error } = await supabase.rpc('update_my_profile', {
        p_phone: body?.phone || '',
        p_avatar_url: body?.avatar_url || ''
      });
      if (error) throw error;
      return { data: body as T };
    }

    return { data: body as T };
  },

  async delete<T = any>(endpoint: string) {
    // Decommission Room (RPC)
    if (endpoint.includes('/hms/rooms/')) {
      const parts = endpoint.split('/');
      const roomId = parseInt(parts[parts.indexOf('rooms') + 1] || '0', 10);
      const { data, error } = await supabase.rpc('decommission_room', {
        p_room_id: roomId
      });
      if (error) throw error;
      return { data: data as T };
    }
    // Caretaker Delete
    if (endpoint.includes('/hms/caretakers/')) {
      const parts = endpoint.split('/');
      const caretakerId = parseInt(parts[parts.indexOf('caretakers') + 1] || '0', 10);
      const { data, error } = await supabase
        .from('hostel_caretakers')
        .delete()
        .eq('id', caretakerId);
      if (error) throw error;
      return { data: { success: true } as T };
    }

    return { data: { success: true } as T };
  }
};

export const authService = {
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async getCurrentProfile(): Promise<Profile | null> {
    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    return data as Profile | null;
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const profile = await this.getCurrentProfile();
    return { session: data.session, user: data.user, profile };
  },

  async logout() {
    await supabase.auth.signOut();
  }
};

export const loginUser = async (u: string, p: string) => {
  const res = await authService.login(u, p);
  const token = res.session?.access_token || '';
  if (res.profile) {
    localStorage.setItem('hms_user', JSON.stringify(res.profile));
  }
  if (token) {
    localStorage.setItem('hms_token', token);
  }
  return { user: res.profile as any, access: token };
};

export const logoutUser = async () => {
  localStorage.removeItem('hms_user');
  localStorage.removeItem('hms_token');
  await authService.logout();
};

export const getStoredUser = (): any => {
  try {
    const raw = localStorage.getItem('hms_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const getAccessToken = (): string | null => {
  return localStorage.getItem('hms_token');
};

export const saveAuthSession = (token?: string, _b?: any, user?: any): void => {
  if (token) localStorage.setItem('hms_token', token);
  if (user) localStorage.setItem('hms_user', JSON.stringify(user));
};
