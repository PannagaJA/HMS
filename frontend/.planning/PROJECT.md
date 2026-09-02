# HostelDesk Frontend - Project Context & Scope

## Overview
High-performance React 18 + TypeScript + Vite + Tailwind CSS + Shadcn UI frontend for the Hostel Management System (HostelDesk). Enforces a distinct **Soft-Pastel Light Theme** design system with distinct role-based UI flows for HMS Admin, Warden, Security Guard, and Student.

## Architecture & Tech Stack
- **Framework & Build:** React 18, TypeScript (`verbatimModuleSyntax` strict mode), Vite
- **Styling & Components:** Tailwind CSS, Radix UI / Shadcn UI Primitives, Lucide Icons
- **Design Tokens:** Soft-pastel theme (`#F0FDF9` canvas, `#0D3833` active dark-teal accents, pastel card badges)
- **State & Networking:** React Context (`AuthContext`), Axios client with mutex-locked silent JWT refresh and device fingerprinting
- **Navigation & RBAC:** React Router v6 with `<ProtectedRoute>` guards per role

## Key Portals & Workspaces
- `admin/`: Complete management hub (Hostels, Rooms, Residents, Staff, Billing, Settings)
- `warden/`: Gate pass queue, leave approvals, maintenance tracking dashboard
- `security/`: Live scanner terminal (QR token verification, entry/exit logger, visitor registry)
- `student/`: Resident portal (Room/roommate overview, digital QR pass, mess menu & meal-skip toggle, complaint lodger)

## Key Milestones & Goals
1. **Design System Consistency:** Verify adherence to `FRONTEND_DESIGN_AND_ARCHITECTURE_SPEC.md` across all views.
2. **Component Robustness & Error Handling:** Polish form validations, loading skeletons, empty states, and toast notifications.
3. **State Management & Auth Guard Verification:** Audit silent token refresh, session persistence, and role redirect logic.
4. **End-to-End User Flow Verification:** Ensure seamless interaction from login to role-specific dashboard actions.
