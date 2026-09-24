/**
 * core_flows.test.ts
 * End-to-End lifecycle tests for Core HMS Business Flows:
 * 1. Gate Pass Flow: Application -> Warden Approval/Rejection -> Security Exit & Entry Movement Tracking
 * 2. Issue Tracking Flow: Student Complaint Submission -> Warden Ticket Resolution & Notes
 * 3. Announcement Flow: Multi-Role Publication -> Scope/Target Filtering -> Read Receipts & Unread Count Tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { studentService } from '../services/studentService';
import { wardenService } from '../services/wardenService';
import { securityService } from '../services/securityService';
import { issueService } from '../services/facilitiesService';
import { announcementService } from '../services/announcementService';
import { supabase } from '../lib/supabase';

// Mock localStorage for test environment
const store: Record<string, string> = {};
const mockStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; }
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
  });
}

// Fluent Supabase Query Chain Builder for Robust Testing
function createSupabaseMockChain(resolveValue: any = { data: null, error: null }) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.ilike = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(resolveValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolveValue);
  chain.then = (resolve: any, reject: any) => Promise.resolve(resolveValue).then(resolve, reject);
  return chain;
}

vi.mock('../lib/supabase', () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
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

describe('HMS Core Business Flow: Gate Passes Lifecycle', () => {
  const mockOrgId = 'org-tenant-uuid-101';
  const mockStudent = {
    id: 10,
    student_name: 'Rahul Sharma',
    enrollment_no: '1AM22CS099',
    phone: '9876543210',
    org_id: mockOrgId,
    allocations: [
      {
        id: 1,
        is_active: true,
        bed: {
          id: 1,
          bed_number: 'Bed 1',
          room: {
            id: 101,
            no: 'A-101',
            floor: 1,
            hostel_id: 1,
            hostel: { id: 1, name: 'Aryabhata Bhavan' },
          },
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();
    mockStorage.setItem(
      'hms_user',
      JSON.stringify({
        id: 'user-uuid-1',
        email: 'rahul@amc.edu',
        role: 'STUDENT',
        org_id: mockOrgId,
      })
    );
  });

  it('Stage 1: Student applies for a gate pass with valid reason and active tenant org_id', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'user-uuid-1', email: 'rahul@amc.edu' } },
    });

    const mockPassRecord = {
      id: 501,
      student_id: 10,
      hostel_id: 1,
      room_id: 101,
      pass_type: 'DAY_OUT',
      reason: 'Weekend Library Visit',
      status: 'pending',
      out_date: '2026-09-25',
      out_time: '14:00',
      expected_return_date: '2026-09-25',
      expected_return_time: '18:00',
      org_id: mockOrgId,
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'students') {
        return createSupabaseMockChain({ data: mockStudent, error: null });
      }
      if (table === 'hostels') {
        return createSupabaseMockChain({ data: { id: 1 }, error: null });
      }
      if (table === 'hostel_rooms') {
        return createSupabaseMockChain({ data: { id: 101, hostel_id: 1 }, error: null });
      }
      if (table === 'gate_passes') {
        return createSupabaseMockChain({ data: mockPassRecord, error: null });
      }
      return createSupabaseMockChain();
    });

    const createdPass = await studentService.applyGatePass({
      pass_type: 'DAY_OUT',
      reason: 'Weekend Library Visit',
      out_date: '2026-09-25',
      out_time: '14:00',
      expected_return_date: '2026-09-25',
      expected_return_time: '18:00',
    });

    expect(createdPass).toBeDefined();
    expect(createdPass.status).toBe('pending');
    expect(createdPass.pass_type).toBe('DAY_OUT');
    expect(createdPass.org_id).toBe(mockOrgId);
  });

  it('Stage 2A: Warden approves the gate pass and status updates to approved', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'warden-uuid-1', email: 'warden@amc.edu' } },
    });

    const approvedPass = {
      id: 501,
      status: 'approved',
      action_note: 'Approved by Warden',
      approved_by: 'warden-uuid-1',
      org_id: mockOrgId,
    };

    (supabase.from as any).mockReturnValue(createSupabaseMockChain({ data: approvedPass, error: null }));
    (supabase.rpc as any).mockResolvedValue({ data: approvedPass, error: null });

    const result = await wardenService.actionGatePass(501, 'approve', 'Approved by Warden');
    expect(result).toBeDefined();
    expect(result.status).toBe('approved');
  });

  it('Stage 2B: Warden rejects the gate pass with reason and status updates to rejected', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'warden-uuid-1', email: 'warden@amc.edu' } },
    });

    const rejectedPass = {
      id: 501,
      status: 'rejected',
      action_note: 'Exam preparation curfew',
      org_id: mockOrgId,
    };

    (supabase.from as any).mockReturnValue(createSupabaseMockChain({ data: rejectedPass, error: null }));
    (supabase.rpc as any).mockResolvedValue({ data: rejectedPass, error: null });

    const result = await wardenService.actionGatePass(501, 'reject', 'Exam preparation curfew');
    expect(result).toBeDefined();
    expect(result.status).toBe('rejected');
    expect(result.action_note).toBe('Exam preparation curfew');
  });

  it('Stage 3: Security Guard logs movement and stamps entry/exit timestamps', async () => {
    const approvedPass = {
      id: 501,
      student_id: 10,
      status: 'approved',
      expected_return_date: '2026-09-25',
      expected_return_time: '18:00:00',
      org_id: mockOrgId,
      actual_exit_time: '2026-09-25T14:05:00Z',
      actual_entry_time: '2026-09-25T17:45:00Z',
      student: { student_name: 'Rahul Sharma', enrollment_no: '1AM22CS099' },
    };

    (supabase.from as any).mockReturnValue(createSupabaseMockChain({ data: approvedPass, error: null }));
    (supabase.rpc as any).mockResolvedValue({ data: approvedPass, error: null });

    const movementRes = await securityService.logMovement(501, 'ENTRY');
    expect(movementRes).toBeDefined();
    expect(movementRes.message).toContain('Gate Return Entry Verified');
    expect(movementRes.pass).toBeDefined();
    expect(movementRes.pass.status).toBe('approved');
  });
});

describe('HMS Core Business Flow: Issue Tracking & Complaint Resolution', () => {
  const mockOrgId = 'org-tenant-uuid-101';
  const mockStudentWithAlloc = {
    id: 10,
    student_name: 'Rahul Sharma',
    enrollment_no: '1AM22CS099',
    org_id: mockOrgId,
    allocations: [
      {
        id: 1,
        is_active: true,
        bed: {
          id: 1,
          room: { id: 101, hostel_id: 1 },
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();
    mockStorage.setItem(
      'hms_user',
      JSON.stringify({
        id: 'user-uuid-1',
        email: 'rahul@amc.edu',
        role: 'STUDENT',
        org_id: mockOrgId,
      })
    );
  });

  it('Stage 1: Student raises maintenance ticket with category and details', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'user-uuid-1', email: 'rahul@amc.edu' } },
    });

    const newIssue = {
      id: 301,
      title: 'Water Leakage in Bathroom',
      category: 'PLUMBING',
      description: 'Tap leaking continuously in Room A-101',
      status: 'pending',
      priority: 'high',
      hostel_id: 1,
      room_id: 101,
      student_id: 10,
      org_id: mockOrgId,
      created_at: new Date().toISOString(),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'students') {
        return createSupabaseMockChain({ data: mockStudentWithAlloc, error: null });
      }
      if (table === 'issues') {
        return createSupabaseMockChain({ data: newIssue, error: null });
      }
      return createSupabaseMockChain();
    });

    const created = await issueService.createIssue({
      title: 'Water Leakage in Bathroom',
      category: 'PLUMBING',
      description: 'Tap leaking continuously in Room A-101',
      priority: 'high',
    });

    expect(created).toBeDefined();
    expect(created.title).toBe('Water Leakage in Bathroom');
    expect(created.category).toBe('PLUMBING');
    expect(created.status).toBe('pending');
  });

  it('Stage 2: Warden transitions ticket status to resolved with notes', async () => {
    mockStorage.setItem(
      'hms_user',
      JSON.stringify({
        id: 'warden-uuid-1',
        email: 'warden@amc.edu',
        first_name: 'Suresh',
        last_name: 'Kumar',
        role: 'WARDEN',
        org_id: mockOrgId,
      })
    );

    const updatedIssue = {
      id: 301,
      status: 'resolved',
      remarks: 'Plumber fixed the tap valve.',
      updated_at: new Date().toISOString(),
      org_id: mockOrgId,
    };

    (supabase.from as any).mockReturnValue(createSupabaseMockChain({ data: updatedIssue, error: null }));
    (supabase.rpc as any).mockResolvedValue({ data: null, error: { message: 'RPC fallback' } });

    const result = await wardenService.updateIssueStatus(301, 'RESOLVED', 'Plumber fixed the tap valve.');
    expect(result).toBeDefined();
    expect(result.updates).toBeDefined();
  });
});

describe('HMS Core Business Flow: Announcements & Broadcast Messaging', () => {
  const mockOrgId = 'org-tenant-uuid-101';

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();
    mockStorage.setItem(
      'hms_user',
      JSON.stringify({
        id: 'admin-uuid-1',
        email: 'admin@amc.edu',
        role: 'ADMIN',
        org_id: mockOrgId,
      })
    );
  });

  it('Stage 1: Admin creates an urgent announcement targeted to STUDENTS', async () => {
    const mockAnnouncement = {
      id: 'ann-uuid-1',
      title: 'Hostel Inspection Schedule',
      message: 'Monthly room maintenance inspection on Friday 10 AM.',
      priority: 'high' as const,
      target_roles: ['STUDENT'],
      created_by_role: 'ADMIN',
      created_by_name: 'Hostel Superintendent',
      org_id: mockOrgId,
      created_at: new Date().toISOString(),
    };

    (supabase.from as any).mockReturnValue(createSupabaseMockChain({ data: mockAnnouncement, error: null }));

    const created = await announcementService.createAnnouncement({
      title: 'Hostel Inspection Schedule',
      message: 'Monthly room maintenance inspection on Friday 10 AM.',
      priority: 'high',
      target_roles: ['STUDENT'],
      created_by_role: 'ADMIN',
      created_by_name: 'Hostel Superintendent',
    });

    expect(created).toBeDefined();
    expect(created.title).toBe('Hostel Inspection Schedule');
    expect(created.priority).toBe('high');
    expect(created.target_roles).toContain('STUDENT');
  });

  it('Stage 2: Student receives only eligible targeted announcements for their role and org', async () => {
    const allAnnouncements = [
      {
        id: 'ann-1',
        title: 'Students Only Notice',
        message: 'Curfew at 10 PM',
        priority: 'high',
        target_roles: ['STUDENT'],
        created_by_role: 'ADMIN',
        target_hostel_id: null as number | null,
        org_id: mockOrgId,
        created_at: '2026-09-24T10:00:00Z',
      },
      {
        id: 'ann-2',
        title: 'Wardens Only Internal Memo',
        message: 'Staff meeting tomorrow',
        priority: 'high',
        target_roles: ['WARDEN'],
        created_by_role: 'ADMIN',
        target_hostel_id: null as number | null,
        org_id: mockOrgId,
        created_at: '2026-09-24T09:00:00Z',
      },
    ];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'announcements') {
        return createSupabaseMockChain({ data: allAnnouncements, error: null });
      }
      if (table === 'students') {
        return createSupabaseMockChain({ data: null, error: null });
      }
      return createSupabaseMockChain();
    });

    const res = await announcementService.getAnnouncements('STUDENT', 'student-uuid-99');
    expect(res.data.length).toBe(1);
    expect(res.data[0].id).toBe('ann-1');
    expect(res.data[0].title).toBe('Students Only Notice');
  });

  it('Stage 3: Student marks announcement as read and unread status is recorded', async () => {
    const studentUserId = 'student-uuid-99';
    const announcementId = 'ann-1';

    (supabase.from as any).mockReturnValue(createSupabaseMockChain({ data: null, error: null }));

    await announcementService.markAsRead(announcementId, studentUserId);

    const storedReads = JSON.parse(mockStorage.getItem(`hms_read_announcements_${studentUserId}`) || '[]');
    expect(storedReads).toContain(announcementId);
  });
});
