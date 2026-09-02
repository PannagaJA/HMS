# HostelDesk Backend - Project Context & Scope

## Overview
Enterprise Django REST Framework (DRF) + PostgreSQL backend for the Hostel Management System (HostelDesk). It delivers role-based access control (RBAC), JWT authentication with token blacklisting, robust API endpoints for Admin, Warden, Security, Student, and Mess domains.

## Architecture & Tech Stack
- **Framework:** Python 3.10+, Django 4.2+ / 5.x, Django REST Framework (DRF)
- **Database:** PostgreSQL (with `psycopg2-binary`)
- **Authentication:** JWT via `djangorestframework-simplejwt` (Token rotation, server-side blacklisting, device fingerprinting)
- **Domain Apps:**
  - `authentication`: User management, custom authentication models & JWT endpoints
  - `core`: Base timestamped models, shared RBAC permissions, common utilities
  - `hms_admin`: Hostels, rooms, staff allocations (wardens/caretakers), overall system administration
  - `student`: Hostel resident profiles, room assignment details, student records
  - `warden`: Issue tracking, maintenance complaints, pass approvals queue
  - `security`: Gate pass validation, live entry/exit logging, visitor logs
  - `mess`: Meal planning, menu schedules, meal skipping & mess rebate billing

## Key Milestones & Goals
1. **API Robustness & Validation:** Ensure strict input sanitization, error responses, and boundary validations across all endpoints.
2. **Automated Test Coverage:** Establish comprehensive Pytest / Django TestCase suites covering model constraints, permission guards, and API views.
3. **Performance & Optimization:** Database query optimization with `select_related` / `prefetch_related`, indexing on frequent filter keys.
4. **Integration & Production Readiness:** Background jobs, audit trails, and reliable database migration strategies.
