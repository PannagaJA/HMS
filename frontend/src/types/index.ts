export type Role = 'ADMIN' | 'WARDEN' | 'SECURITY' | 'STUDENT';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  phone?: string;
  avatar_url?: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface HostelWarden {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  experience: number;
  address?: string;
}

export interface HostelCaretaker {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  experience: number;
  address?: string;
}

export interface HostelCourse {
  id: number;
  code: string;
  name?: string;
  room_type: string;
}

export interface Hostel {
  id: number;
  name: string;
  gender: 'M' | 'F' | 'C';
  floor_count: number;
  address?: string;
  total_rooms: number;
  total_capacity: number;
  occupied_beds: number;
  warden?: number;
  warden_detail?: HostelWarden;
  caretaker?: number;
  caretaker_detail?: HostelCaretaker;
}

export interface HostelRoom {
  id: number;
  hostel: number;
  hostel_name: string;
  no: string;
  name: string;
  room_type: 'S' | 'D' | 'T' | 'P' | 'B';
  floor: number;
  capacity: number;
  vacant: boolean;
  occupied_count: number;
}

export interface HostelStudent {
  id: number;
  student_name: string;
  father_name?: string;
  enrollment_no: string;
  gender: 'M' | 'F';
  room?: number;
  room_detail?: HostelRoom;
  hostel_name?: string;
  bed_number?: string;
  room_allotted: boolean;
  no_dues: boolean;
  guardian_phone?: string;
  emergency_contact?: string;
}

export interface HostelOutsideStudent {
  id: number;
  name: string;
  usn: string;
  outside_college_name: string;
  outside_course_name: string;
  outside_year?: string;
  phone: string;
  email?: string;
  gender: 'M' | 'F';
  hostel?: number;
  hostel_name?: string;
  room?: number;
  room_no?: string;
  bed_number?: string;
  room_allotted: boolean;
  no_dues: boolean;
  joining_date?: string;
}

export interface MealType {
  id: number;
  name: string;
  description?: string;
  time_from?: string;
  time_to?: string;
}

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  vegetarian: boolean;
  is_active: boolean;
}

export interface Menu {
  id: number;
  hostel: number;
  day_of_week: string;
  meal_type: number;
  meal_type_name?: string;
  items: number[];
  items_detail?: MenuItem[];
  is_recurring: boolean;
}

export interface MessBilling {
  id: number;
  student: number;
  student_name: string;
  enrollment_no: string;
  hostel: number;
  month: string;
  total_meals: number;
  meals_consumed: number;
  meals_skipped: number;
  rate_per_meal: string;
  total_cost: string;
  discounted_cost: string;
  paid: boolean;
}

export interface GatePassRequest {
  id: number;
  token: string;
  student: number;
  student_name: string;
  enrollment_no: string;
  hostel: number;
  hostel_name: string;
  room_no?: string;
  pass_type: 'DAY_OUT' | 'NIGHT_OUT' | 'HOME_VISIT' | 'EMERGENCY';
  reason: string;
  out_date: string;
  out_time: string;
  expected_return_date: string;
  expected_return_time: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'completed';
  approved_by_name?: string;
  action_note?: string;
  actual_exit_time?: string;
  actual_entry_time?: string;
  is_late: boolean;
  created_at: string;
}

export interface HostelIssue {
  id: number;
  student_name: string;
  enrollment_no: string;
  room_no: string;
  hostel_name: string;
  category: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'waiting_for_workers' | 'completed';
  created_at: string;
  updates?: Array<{
    id: number;
    old_status: string;
    new_status: string;
    note: string;
    updated_by_name: string;
    created_at: string;
  }>;
}

export interface VisitorLog {
  id: number;
  student: number;
  student_name: string;
  enrollment_no: string;
  hostel_name?: string;
  visitor_name: string;
  mobile_number: string;
  purpose: string;
  check_in_time: string;
  check_out_time?: string;
}

export interface DashboardStats {
  total_hostels: number;
  total_rooms: number;
  total_students: number;
  total_capacity: number;
  occupied_beds: number;
  vacant_beds: number;
  occupancy_rate: number;
  pending_gate_passes: number;
  active_issues: number;
}
