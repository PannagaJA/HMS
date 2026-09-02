# HMS System Login Credentials

This document lists the pre-configured credentials for all 4 primary application roles across the Hostel Management System (HMS), powered by Supabase Authentication & Row-Level Security (RLS).

---

## 🌐 Application Access URL
* **Frontend Portal:** [http://localhost:5173/login](http://localhost:5173/login)

---

## 🔑 Role Accounts & Credentials

| Role | Email | Password | Assigned Scope & Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@amc.edu` | `amc@2026` | **Full System Access**<br>• Create/decommission rooms & resize capacities<br>• View all hostels, operational stats, and audit logs<br>• Direct database governance & user management |
| **Warden** | `warden@amc.edu` | `amc@2026` | **Aryabhata Bhavan (Boys Hostel)**<br>• View rooms, beds & resident directory for assigned hostel<br>• Approve or reject gate passes<br>• Allocate & vacate resident rooms<br>• Update maintenance tickets |
| **Security Guard**| `security@amc.edu` | `amc@2026` | **Main Campus Gate Checkpoint**<br>• Check in and check out visitors<br>• Scan QR / token identifiers for gate movements<br>• Log physical EXIT and ENTRY timestamps |
| **Student Resident**| `student@amc.edu` | `amc@2026` | **Rahul Sharma (Room A-101, Bed 1)**<br>• Apply for DAY_OUT / NIGHT_OUT gate passes<br>• Report room/facility maintenance tickets<br>• View dining schedules & request meal skips<br>• Update self-service profile information |

---

## 🛡️ Security Boundaries Verified Under RLS

1. **Hostel Isolation (Warden):**
   * The Warden (`warden@amc.edu`) is assigned to **Aryabhata Bhavan**.
   * Any attempt by this warden to view or allocate rooms in **Kalpana Chawla Bhavan** will be automatically blocked by the database RLS policies.

2. **Student Privacy:**
   * Student (`student@amc.edu`) can **only** see their own tickets, meal skips, and gate passes.
   * Direct manipulation of room numbers or student institutional records (e.g. `enrollment_no`, `status`) is rejected at the database level.

3. **Gate Movement Enforcement:**
   * Only the Security role (`security@amc.edu`) and Admin can log `EXIT` or `ENTRY` movements.
   * `ENTRY` cannot be stamped before `EXIT`.
   * Passes returning after the expected deadline are automatically stamped with `is_late = TRUE`.

---

## 💡 Notes
* Passwords for test accounts can also be reset or updated directly in the Supabase Dashboard under **Authentication** $\rightarrow$ **Users**.
* All role permissions are authoritative in the `public.profiles` table and enforced via PostgreSQL Row-Level Security.
