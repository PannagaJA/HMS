/**
 * crud_remediations.test.ts
 * Tests for the 4 CRUD Audit Remediations:
 * 1. Password change handler in apiClient.post('/auth/profile/')
 * 2. Room number (no) and floor persistence in apiClient.patch('/hms/rooms/')
 * 3. Registered UUID staff profile updates in adminService (Wardens & Security Guards)
 * 4. Centralized Warden visitor check-in payload handling in securityService
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../utils/authService';
import { adminService } from '../services/adminService';
import { securityService } from '../services/securityService';
import { supabase } from '../lib/supabase';

// Mock Supabase client
vi.mock('../lib/supabase', () => {
  const mockSupabase = {
    auth: {
      updateUser: vi.fn(),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: '00000000-0000-0000-0000-000000000001', email: 'test@amc.edu' } } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  };
  return { supabase: mockSupabase };
});

describe('CRUD Remediation 1: Password Change Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects password changes with less than 6 characters', async () => {
    await expect(
      apiClient.post('/auth/profile/', { current_password: 'old', new_password: '123' })
    ).rejects.toThrow('New password must be at least 6 characters long.');
  });

  it('rejects password changes with missing new password', async () => {
    await expect(
      apiClient.post('/auth/profile/', { current_password: 'old', new_password: '' })
    ).rejects.toThrow('New password must be at least 6 characters long.');
  });

  it('successfully invokes supabase.auth.updateUser when valid new password is provided', async () => {
    (supabase.auth.updateUser as any).mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    });

    const res = await apiClient.post('/auth/profile/', {
      current_password: 'oldPassword123',
      new_password: 'newValidPassword2026',
    });

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'newValidPassword2026',
    });
    expect(res.data).toEqual({
      success: true,
      message: 'Password changed successfully!',
    });
  });

  it('surfaces error message when supabase.auth.updateUser fails', async () => {
    (supabase.auth.updateUser as any).mockResolvedValue({
      data: null,
      error: { message: 'Auth session expired' },
    });

    await expect(
      apiClient.post('/auth/profile/', {
        current_password: 'oldPassword123',
        new_password: 'newValidPassword2026',
      })
    ).rejects.toThrow('Auth session expired');
  });
});

describe('CRUD Remediation 2: Room Number & Floor Persistence in Room Patch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists no and floor in hostel_rooms update query when patched', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 42, no: '205-B', floor: 2, capacity: 3, room_type: 'T' },
            error: null,
          }),
        }),
      }),
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'hostel_rooms') {
        return { update: mockUpdate };
      }
      return {};
    });

    const payload = {
      hostel: 1,
      no: '205-B',
      name: 'Room 205-B Deluxe',
      floor: 2,
      capacity: 3,
      room_type: 'T',
    };

    const res = await apiClient.patch('/hms/rooms/42/', payload);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        no: '205-B',
        floor: 2,
        capacity: 3,
        name: 'Room 205-B Deluxe',
        room_type: 'T',
        hostel_id: 1,
      })
    );
    expect(res.data.no).toBe('205-B');
    expect(res.data.floor).toBe(2);
  });
});

describe('CRUD Remediation 3: Direct Profile Editing for Registered UUID Staff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates profiles table directly for registered UUID Wardens without throwing restrictions', async () => {
    const uuidId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: uuidId, first_name: 'John', last_name: 'Doe', phone: '9876543210' },
            error: null,
          }),
        }),
      }),
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { update: mockUpdate };
      }
      return {};
    });

    const res = await adminService.updateWarden(uuidId, {
      name: 'John Doe',
      phone: '9876543210',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      first_name: 'John',
      last_name: 'Doe',
      phone: '9876543210',
    });
    expect(res.first_name).toBe('John');
  });

  it('updates profiles table directly for registered UUID Security Guards without throwing restrictions', async () => {
    const uuidId = 'f1e2d3c4-b5a6-7890-1234-56789abcdef0';
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: uuidId, first_name: 'Ramesh', last_name: 'Kumar', phone: '9123456780' },
            error: null,
          }),
        }),
      }),
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { update: mockUpdate };
      }
      return {};
    });

    const res = await adminService.updateSecurityStaff(uuidId, {
      name: 'Ramesh Kumar',
      phone: '9123456780',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      first_name: 'Ramesh',
      last_name: 'Kumar',
      phone: '9123456780',
    });
    expect(res.first_name).toBe('Ramesh');
  });
});

describe('CRUD Remediation 4: Visitor Check-In Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records visitor check-in with host student and room associations', async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 10,
            visitor_name: 'Mr. Sharma',
            mobile_number: '9876543211',
            student_id: 5,
            hostel_id: 1,
            room_id: 12,
            purpose: 'Parents Visit',
          },
          error: null,
        }),
      }),
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'students') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 5,
                  student_name: 'Aarav Sharma',
                  allocations: [
                    {
                      is_active: true,
                      bed: { room: { id: 12, hostel_id: 1 } },
                    },
                  ],
                },
              }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { org_id: '00000000-0000-0000-0000-000000000001' },
              }),
            }),
          }),
        };
      }
      if (table === 'visitor_logs') {
        return { insert: mockInsert };
      }
      return {};
    });

    const res = await securityService.checkInVisitor({
      student_id: 5,
      visitor_name: 'Mr. Sharma',
      mobile_number: '9876543211',
      purpose: 'Parents Visit',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: 5,
        visitor_name: 'Mr. Sharma',
        mobile_number: '9876543211',
        hostel_id: 1,
        room_id: 12,
      })
    );
    expect(res.id).toBe(10);
  });
});
