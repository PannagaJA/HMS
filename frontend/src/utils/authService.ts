import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

export const apiClient = {
  async get<T = any>(endpoint: string) {
    if (endpoint.includes('/hms/students/')) {
      const { data, error } = await supabase.from('students').select('*');
      if (error) throw error;
      return { data: data as T };
    }
    if (endpoint.includes('/hms/hostels/')) {
      const { data, error } = await supabase.from('hostels').select('*');
      if (error) throw error;
      return { data: data as T };
    }
    if (endpoint.includes('/hms/rooms/')) {
      const { data, error } = await supabase.from('hostel_rooms').select('*, beds(*)');
      if (error) throw error;
      return { data: data as T };
    }
    if (endpoint.includes('/hms/issues/') || endpoint.includes('/warden/issues/')) {
      const { data, error } = await supabase.from('issues').select('*, student:students(*)');
      if (error) throw error;
      return { data: data as T };
    }
    if (endpoint.includes('/hms/gatepass/') || endpoint.includes('/security/passes/')) {
      const { data, error } = await supabase.from('gate_passes').select('*, student:students(*)');
      if (error) throw error;
      return { data: data as T };
    }
    if (endpoint.includes('/hms/visitors/')) {
      const { data, error } = await supabase.from('visitor_logs').select('*, student:students(*)');
      if (error) throw error;
      return { data: data as T };
    }
    return { data: [] as T };
  },

  async post<T = any>(endpoint: string, body?: any) {
    if (endpoint.includes('/hms/allocate-room/')) {
      const { data, error } = await supabase.rpc('allocate_student_room', {
        p_student_id: body?.student_id,
        p_bed_id: body?.bed_id,
      });
      if (error) throw error;
      return { data: data as T };
    }
    if (endpoint.includes('/vacate') || endpoint.includes('/hms/vacate-room/')) {
      const studentId = body?.student_id || parseInt(endpoint.split('/')[3] || '0', 10);
      const { data, error } = await supabase.rpc('vacate_student_room', {
        p_student_id: studentId,
      });
      if (error) throw error;
      return { data: data as T };
    }
    return { data: {} as T };
  },

  async put<T = any>(_endpoint: string, body: any) {
    return { data: body as T };
  },

  async patch<T = any>(_endpoint: string, body: any) {
    return { data: body as T };
  },

  async delete<T = any>(_endpoint: string) {
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
  return { user: res.profile as any, access: res.session?.access_token || '' };
};
export const logoutUser = async () => authService.logout();
export const getStoredUser = (): any => null;
export const getAccessToken = (): string | null => null;
export const saveAuthSession = (_a?: any, _b?: any, _c?: any): void => {};
