export type UserRole = 'ADMIN' | 'WARDEN' | 'SECURITY' | 'STUDENT';
export type { User, Role, HostelStudent, GatePassRequest, IssueTicket, HostelIssue, HostelWarden, HostelCaretaker, SecurityStaff } from './legacy';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone?: string;
  org_id?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Hostel {
  id: number;
  name: string;
  gender: 'M' | 'F' | 'C';
  floor_count: number;
  address?: string;
  is_active: boolean;
  total_rooms?: number;
  total_capacity?: number;
  occupied_beds?: number;
  warden?: any;
  caretaker?: any;
  warden_detail?: any;
  caretaker_detail?: any;
  created_at: string;
  updated_at: string;
}

export interface HostelRoom {
  id: number;
  hostel_id: number;
  hostel?: any;
  hostel_name?: string;
  no: string;
  room_no?: string;
  name?: string;
  floor: number;
  capacity: number;
  room_type: 'S' | 'D' | 'T' | 'P' | 'B';
  room_type_display?: string;
  is_active: boolean;
  vacant?: boolean;
  occupied_count?: number;
  current_occupancy?: number;
  occupants?: any[];
  beds?: Bed[];
  created_at: string;
  updated_at: string;
}

export interface Bed {
  id: number;
  room_id: number;
  bed_number: number;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: number;
  code: string;
  name?: string;
  room_type: string;
}

export interface Student {
  id: number;
  profile_id?: string;
  student_name: string;
  enrollment_no: string;
  email?: string;
  father_name?: string;
  course_id?: number;
  dob?: string;
  gender: 'M' | 'F';
  phone?: string;
  guardian_phone?: string;
  emergency_contact?: string;
  no_dues: boolean;
  status: 'ACTIVE' | 'ALUMNI' | 'SUSPENDED' | 'WITHDRAWN';
  created_at: string;
  updated_at: string;
}

export interface RoomAllocation {
  id: number;
  student_id: number;
  bed_id: number;
  allocated_by?: string;
  allocated_at: string;
  vacated_at?: string;
  is_active: boolean;
  student?: Student;
  bed?: Bed & { room?: HostelRoom & { hostel?: Hostel } };
}

export interface Issue {
  id: number;
  student_id: number;
  hostel_id: number;
  room_id: number;
  category: 'PLUMBING' | 'ELECTRICAL' | 'CARPENTRY' | 'WIFI' | 'CLEANLINESS' | 'OTHER';
  title: string;
  description: string;
  image_url?: string;
  priority?: string;
  status: 'pending' | 'in_progress' | 'waiting_for_workers' | 'completed';
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
  room?: HostelRoom;
}

export interface IssueUpdate {
  id: number;
  issue_id: number;
  old_status?: string;
  new_status: string;
  note?: string;
  updated_by?: string;
  created_at: string;
}

export interface GatePass {
  id: number;
  token: string;
  student_id: number;
  hostel_id: number;
  room_id: number;
  pass_type: 'DAY_OUT' | 'NIGHT_OUT' | 'HOME_VISIT' | 'EMERGENCY';
  reason: string;
  out_date: string;
  out_time: string;
  expected_return_date: string;
  expected_return_time: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'completed';
  approved_by?: string;
  action_note?: string;
  actioned_at?: string;
  actual_exit_time?: string;
  actual_entry_time?: string;
  is_late: boolean;
  security_guard_id?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
  room?: HostelRoom;
}

export interface VisitorLog {
  id: number;
  student_id: number;
  hostel_id: number;
  hostel?: any;
  hostel_name?: string;
  room_id: number;
  visitor_name: string;
  visitor_phone?: string;
  mobile_number: string;
  relation?: string;
  purpose: string;
  student_name?: string;
  enrollment_no?: string;
  student_room?: string;
  room_no?: string;
  floor?: number | string;
  status?: string;
  check_in_time: string;
  check_out_time?: string;
  entry_time?: string;
  exit_time?: string;
  recorded_by?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
  room?: HostelRoom;
}

export interface MealType {
  id: number;
  name: 'BR' | 'LN' | 'SN' | 'DN';
  description?: string;
  time_from?: string;
  time_to?: string;
  start_time?: string;
  end_time?: string;
}

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  category?: string;
  vegetarian: boolean;
  is_veg?: boolean;
  is_active: boolean;
}

export interface Menu {
  id: number;
  hostel_id: number;
  day_of_week: string;
  meal_type_id: number;
  meal_type?: any;
  is_recurring: boolean;
  items?: MenuItem[];
  items_detail?: MenuItem[];
}

export interface StudentMealSkip {
  id: number;
  student_id: number;
  hostel_id: number;
  date: string;
  meal_type_id: number;
  skip_type: 'SKIP' | 'LEAVE' | 'RETURN';
  reason?: string;
  approved: boolean;
  meal_type?: MealType;
}

export interface DashboardStats {
  total_hostels: number;
  total_rooms: number;
  total_capacity: number;
  occupied_beds: number;
  vacant_beds: number;
  occupancy_rate: number;
  pending_gate_passes: number;
  active_issues: number;
  total_students?: number;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  created_by_role?: string;
  created_by_name?: string;
  created_at: string;
  is_circular?: boolean;
  expires_at?: string;
  circular_number?: string;
  file_url?: string;
  file_name?: string;
  is_read?: boolean;
  target_roles?: string[];
  target_hostel_id?: number | null;
}
