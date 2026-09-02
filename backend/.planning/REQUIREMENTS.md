# Backend Requirements Specification

## 1. Authentication & RBAC (REQ-AUTH)
- [ ] `REQ-AUTH-01`: JWT login, token rotation, and refresh handling with secure blacklisting.
- [ ] `REQ-AUTH-02`: Role-based permission classes enforcing separation across ADMIN, WARDEN, SECURITY, and STUDENT.
- [ ] `REQ-AUTH-03`: Device ID tracking / fingerprint validation for multi-session auditing.

## 2. Admin & Infrastructure Management (REQ-ADMIN)
- [ ] `REQ-ADMIN-01`: Full CRUD for Hostels, Blocks, Floors, and Rooms with capacity tracking.
- [ ] `REQ-ADMIN-02`: Room allocation and de-allocation with occupancy state consistency.
- [ ] `REQ-ADMIN-03`: Staff management (Wardens, Caretakers, Security Guards) assignment to hostels.

## 3. Warden & Complaints (REQ-WARDEN)
- [ ] `REQ-WARDEN-01`: Gate pass review and approval/rejection workflow with remarks.
- [ ] `REQ-WARDEN-02`: Maintenance/Issue ticketing system with status updates and timeline history.
- [ ] `REQ-WARDEN-03`: Student leave tracking and curfew exception monitoring.

## 4. Security & Gate Pass Terminal (REQ-SEC)
- [ ] `REQ-SEC-01`: Verification API for student QR codes and pass tokens.
- [ ] `REQ-SEC-02`: Check-in / Check-out movement logging with timestamp and guard attribution.
- [ ] `REQ-SEC-03`: Visitor logging and verification against host student.

## 5. Mess & Dining Management (REQ-MESS)
- [ ] `REQ-MESS-01`: Weekly menu management by meal type (Breakfast, Lunch, Snacks, Dinner).
- [ ] `REQ-MESS-02`: Student meal-skip notification system with cutoff time enforcement.
- [ ] `REQ-MESS-03`: Automatic monthly mess billing and rebate calculations based on skipped meals.

## 6. Testing & Quality Assurance (REQ-QA)
- [ ] `REQ-QA-01`: Unit test coverage for all custom model methods, managers, and signals.
- [ ] `REQ-QA-02`: Integration test coverage for DRF API viewsets and RBAC permission checks.
