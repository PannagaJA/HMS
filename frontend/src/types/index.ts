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

export interface HostelRoom {
  id: number;
  hostel: number;
  hostel_name: string;
  no: string;
  name: string;
  floor: number;
  capacity: number;
  occupied_count: number;
  vacant: boolean;
  room_type: string;
  room_type_display?: string;
}

export interface HostelStudent {
  id: number;
  student_name: string;
  enrollment_no: string;
  gender: 'M' | 'F';
  father_name?: string;
  guardian_phone?: string;
  emergency_contact?: string;
  room_allotted: boolean;
  hostel_name?: string;
  room_detail?: { id: number; no: string; name: string } | null;
  bed_number?: string;
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
  day_of_week: number;
  meal_type: number;
  meal_type_name?: string;
  items: MenuItem[];
  items_detail?: MenuItem[];
}

export interface MessBilling {
  id: number;
  student_name: string;
  enrollment_no: string;
  month: string;
  base_mess_fee: number;
  meals_skipped_count: number;
  discount_per_skip: number;
  total_discount: number;
  final_amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  total_meals?: number;
  meals_skipped?: number;
  meals_consumed?: number;
  total_cost?: number;
  discounted_cost?: number;
  paid?: boolean;
}

export interface HostelIssue {
  id: number;
  student_name: string;
  enrollment_no: string;
  hostel_name: string;
  room_no: string;
  category: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'waiting_for_workers' | 'completed';
  created_at: string;
}

export interface GatePassRequest {
  id: number;
  student_name: string;
  enrollment_no: string;
  hostel_name: string;
  room_no: string;
  pass_type: 'day_out' | 'night_out' | 'home';
  purpose: string;
  reason?: string;
  out_date: string;
  out_time?: string;
  return_date: string;
  expected_return_date?: string;
  expected_return_time?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  created_at: string;
  destination?: string;
  actual_exit_time?: string;
  actual_entry_time?: string;
  actual_out_time?: string;
  actual_in_time?: string;
  approved_by_name?: string;
  action_note?: string;
}

export interface VisitorLog {
  id: number;
  visitor_name: string;
  visitor_phone?: string;
  mobile_number?: string;
  student_name: string;
  student_room?: string;
  enrollment_no?: string;
  relation: string;
  purpose: string;
  entry_time?: string;
  exit_time?: string | null;
  check_in_time?: string;
  check_out_time?: string | null;
  status: 'CHECKED_IN' | 'CHECKED_OUT';
}
