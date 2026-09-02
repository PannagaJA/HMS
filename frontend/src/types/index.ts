export type Role = 'ADMIN' | 'WARDEN' | 'SECURITY' | 'STUDENT';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: Role;
  phone?: string;
  avatar_url?: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface DashboardStats {
  total_hostels: number;
  total_rooms: number;
  total_students: number;
  total_wardens: number;
  total_caretakers: number;
  total_capacity: number;
  occupied_beds: number;
  vacant_beds: number;
  occupancy_rate: number;
  pending_gate_passes: number;
  active_issues: number;
}

export interface Hostel {
  id: number;
  name: string;
  gender: 'M' | 'F' | 'C';
  floor_count: number;
  warden?: number | null;
  caretaker?: number | null;
  warden_detail?: { id: number; name: string; phone: string } | null;
  caretaker_detail?: { id: number; name: string; phone: string } | null;
  address?: string;
  total_rooms: number;
  total_capacity: number;
  occupied_beds: number;
  occupancy_rate: number;
}

export interface RoomOccupant {
  id?: number;
  student_name: string;
  enrollment_no: string;
  bed_number?: string;
  course_name?: string;
}

export interface HostelRoom {
  id: number;
  hostel: number;
  hostel_name: string;
  room_no?: string;
  no?: string;
  name?: string;
  floor: number;
  capacity: number;
  occupied_beds: number;
  occupied_count: number;
  current_occupancy: number;
  vacant_beds: number;
  vacant: number;
  room_type: string;
  room_type_display?: string;
  is_active: boolean;
  occupants?: RoomOccupant[];
}

export interface HostelStudent {
  id: number;
  student_name: string;
  enrollment_no: string;
  email?: string;
  father_name?: string;
  gender: 'M' | 'F';
  phone?: string;
  guardian_phone?: string;
  emergency_contact?: string;
  room_allotted: boolean;
  hostel?: number;
  hostel_name?: string;
  room?: number;
  room_no?: string;
  room_number?: string;
  room_detail?: { id: number; no: string; name: string } | null;
  bed_number?: string;
  no_dues?: boolean;
}

export interface HostelOutsideStudent {
  id: number;
  name: string;
  usn: string;
  gender: string;
  phone: string;
  outside_college_name: string;
  outside_course_name: string;
  outside_year?: string;
  hostel?: number | null;
  room?: number | null;
  room_no?: string;
  room_allotted: boolean;
  dues_cleared?: boolean;
}

export interface HostelWarden {
  id: number;
  name: string;
  phone: string;
  email?: string;
  designation?: string;
  experience_years?: number;
  experience?: string;
}

export interface HostelCaretaker {
  id: number;
  name: string;
  phone: string;
  email?: string;
  shift?: string;
  experience?: string;
}

export interface MealType {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  time_from?: string;
  time_to?: string;
  description?: string;
}

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  is_veg: boolean;
  vegetarian?: boolean;
  description?: string;
}

export interface Menu {
  id: number;
  day_of_week: number | string;
  meal_type: number;
  meal_type_name?: string;
  items: MenuItem[];
  items_detail?: MenuItem[];
}

export interface HostelIssue {
  id: number;
  student_name: string;
  enrollment_no: string;
  hostel?: number;
  hostel_id?: number;
  hostel_name: string;
  room_no: string;
  category: string;
  title: string;
  description: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string;
  status: 'pending' | 'in_progress' | 'waiting_for_workers' | 'completed' | 'resolved';
  created_at: string;
}

export type IssueTicket = HostelIssue;

export interface GatePassRequest {
  id: number;
  token?: string;
  student_name: string;
  enrollment_no: string;
  hostel?: number;
  hostel_id?: number;
  hostel_name: string;
  room_no: string;
  pass_type: 'day_out' | 'night_out' | 'home' | 'DAY_OUT' | 'NIGHT_OUT' | 'HOME_VISIT' | 'EMERGENCY' | string;
  purpose?: string;
  reason?: string;
  out_date: string;
  out_time?: string;
  return_date?: string;
  expected_return_date?: string;
  expected_return_time?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | string;
  created_at: string;
  destination?: string;
  actual_exit_time?: string | null;
  actual_entry_time?: string | null;
  actual_out_time?: string | null;
  actual_in_time?: string | null;
  approved_by_name?: string | null;
  action_note?: string;
  actioned_at?: string;
}

export interface VisitorLog {
  id: number;
  visitor_name: string;
  visitor_phone?: string;
  mobile_number?: string;
  student?: number;
  student_name: string;
  student_room?: string;
  enrollment_no?: string;
  hostel?: number;
  hostel_id?: number;
  hostel_name?: string;
  relation?: string;
  purpose: string;
  entry_time?: string;
  exit_time?: string | null;
  check_in_time?: string;
  check_out_time?: string | null;
  status?: 'CHECKED_IN' | 'CHECKED_OUT';
}
