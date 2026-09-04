import type { Profile, UserRole } from '../types';

export interface User extends Profile {
  username?: string;
}

export type Role = UserRole;

export interface HostelWarden {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  designation?: string;
  experience?: string | number;
}

export interface HostelCaretaker {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  experience?: string | number;
}

export interface SecurityStaff {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  designation?: string;
  experience?: string | number;
}

export interface HostelStudent {
  id: number;
  student_name: string;
  enrollment_no: string;
  father_name?: string;
  gender: 'M' | 'F';
  phone?: string;
  guardian_phone?: string;
  emergency_contact?: string;
  no_dues: boolean;
  status: string;
  hostel_name?: string;
  room_detail?: any;
  bed_number?: any;
  room_no?: string;
  room_number?: string;
  room_allotted?: boolean;
  hostel?: any;
  allocations?: any[];
}

export interface GatePassRequest {
  id: number;
  token: string;
  student_id: number;
  hostel_id: number;
  room_id: number;
  pass_type: string;
  reason: string;
  out_date: string;
  out_time: string;
  expected_return_date: string;
  expected_return_time: string;
  status: string;
  student_name: string;
  enrollment_no: string;
  hostel_name: string;
  room_no?: string;
  purpose?: string;
  approved_by_name?: string;
  actual_exit_time?: string;
  actual_entry_time?: string;
  return_date?: string;
  hostel?: any;
  student?: any;
}

export interface IssueTicket {
  id: number;
  student_id: number;
  category: string;
  title: string;
  description: string;
  image_url?: string;
  status: string;
  hostel?: any;
  hostel_id?: number;
  hostel_name: string;
  room_no?: string;
  student_name: string;
  enrollment_no: string;
  updates?: any[];
  priority?: string;
  created_at: string;
  student?: any;
}

export interface HostelIssue extends IssueTicket {}
