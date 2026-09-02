# 🏢 HostelDesk - Modular Enterprise Hostel Management System (HMS)

**HostelDesk** is an enterprise-grade, role-based Hostel Management System engineered with a decoupled **Django REST Framework + PostgreSQL** backend and a high-performance **React 18 + TypeScript + Vite + Tailwind CSS + Shadcn UI** frontend.

The UI strictly implements a modern **Soft-Pastel Light Theme** specification (`#F0FDF9` canvas, `#0D3833` dark-teal active navigation, and signature pastel metric cards) with complete RBAC separation across **4 primary stakeholders**:
- 👑 **HMS Admin** (Master configurations, room allocation matrix, resident records, dining planner, monthly billing)
- 🛡️ **Hostel Warden** (Gate pass authorization queue, student leaves, block supervision, maintenance tickets)
- 🚪 **Security Guard** (QR code & enrollment token scanner terminal, live entry/exit logging, visitor register)
- 🎓 **Hostel Student** (Roommate details, digital QR pass, dining meal-skip deduction toggle, complaint lodge)

---

## 🚀 Tech Stack

### 🐍 Backend
- **Framework:** Python 3.10+, Django 4.2+ / 5.x, Django REST Framework (DRF)
- **Database:** PostgreSQL (`psycopg2-binary`)
- **Authentication:** JWT via `djangorestframework-simplejwt` with server-side token rotation & blacklisting
- **CORS & Filters:** `django-cors-headers`, `django-filter`
- **Environment Management:** Conda (`hms`) / `python-dotenv`

### ⚛️ Frontend
- **Framework:** React 18, TypeScript (`verbatimModuleSyntax` strict mode)
- **Build Tool:** Vite
- **UI & Design:** Tailwind CSS + Radix UI / Shadcn UI Primitives (`@radix-ui/react-select`, `@radix-ui/react-dialog`, `@radix-ui/react-popover`)
- **Icons:** `lucide-react`
- **HTTP Client:** Axios with in-memory token fallback, mutex-locked silent refresh, and device fingerprinting (`X-Device-ID`)
- **Routing:** React Router DOM v6 with route-level authorization guards (`<ProtectedRoute>`)

---

## 📁 Repository Structure

```
HMS/
├── FRONTEND_DESIGN_AND_ARCHITECTURE_SPEC.md   # Master UI/UX Design System & Rules
├── README.md                                  # Complete Project Documentation
├── .gitignore                                 # Production Git ignore rules
│
├── backend/                                   # Django REST Backend
│   ├── manage.py                              # Django management CLI
│   ├── seed_data.py                           # Database seeder (Hostels, Rooms, Menus, Users)
│   ├── requirements.txt                       # Python dependencies
│   ├── .env.example                           # Template environment configuration
│   ├── hms_project/                           # Project settings, WSGI, ASGI, Root URLs
│   └── apps/                                  # Domain-Driven Modular Apps
│       ├── authentication/                    # Custom User model, JWT views, Blacklisting
│       ├── core/                              # TimeStampedModel, RBAC permission classes
│       ├── hms_admin/                         # Hostel, HostelRoom, Warden, Caretaker models
│       ├── student/                           # HostelStudent & HostelOutsideStudent models
│       ├── warden/                            # HostelIssue & IssueUpdate timeline
│       ├── security/                          # GatePassRequest, Movement, VisitorLog
│       └── mess/                              # MealType, MenuItem, Menu, MessBilling
│
└── frontend/                                  # React 18 + TS Vite Frontend
    ├── index.html                             # Root HTML with custom brand favicon
    ├── package.json                           # Frontend scripts & dependencies
    ├── tailwind.config.js                     # Pastel color tokens & geometry
    └── src/
        ├── api/                               # Unified apiClient with interceptors
        ├── context/                           # AuthContext (JWT session management)
        ├── types/                             # TypeScript model interfaces
        ├── utils/                             # authService (Mutex refresh, device tracking)
        ├── components/
        │   ├── ui/                            # Shadcn UI (Select, DatePicker, Popover)
        │   ├── common/                        # Sidebar, Header, StatCard, StatusBadge
        │   ├── layout/                        # ProtectedRoute role authorization wrapper
        │   ├── auth/                          # Production Login page
        │   ├── admin/                         # 10 HMS Admin Management Screens
        │   ├── warden/                        # Warden Pass Review & Approval Queue
        │   ├── security/                      # Gate Scanner Terminal (Enter ID / Scan QR)
        │   └── student/                       # Resident Portal (My Room, Menu, Pass)
        ├── App.tsx                            # React Router Route Definitions
        └── main.tsx                           # Application Bootstrap
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- [Miniconda / Anaconda](https://docs.conda.io/en/latest/miniconda.html)
- [Node.js (v18+)](https://nodejs.org/) & `npm`
- [PostgreSQL](https://www.postgresql.org/) (Running on `localhost:5432`)

---

### 2. Backend Setup & Database Migration

1. **Activate the Conda Environment:**
   ```powershell
   conda activate hms
   ```

2. **Navigate to the Backend Directory:**
   ```powershell
   cd d:\HMS\backend
   ```

3. **Install Dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables (`.env`):**
   Ensure `backend/.env` exists with your local PostgreSQL credentials:
   ```ini
   SECRET_KEY=hms-modular-production-grade-secret-key-2026-antigravity
   DEBUG=True
   ALLOWED_HOSTS=localhost,127.0.0.1,192.168.31.32
   DB_NAME=hms_db
   DB_USER=postgres
   DB_PASSWORD=password
   DB_HOST=127.0.0.1
   DB_PORT=5432
   CORS_ALLOW_ALL_ORIGINS=True
   ```

5. **Apply Migrations & Seed Sample Data:**
   ```powershell
   python manage.py migrate
   python seed_data.py
   ```

6. **Start the Django Development Server:**
   ```powershell
   python manage.py runserver
   ```
   *Backend will run at:* `http://127.0.0.1:8000/`

---

### 3. Frontend Setup

1. **Open a new terminal and navigate to the Frontend:**
   ```powershell
   cd d:\HMS\frontend
   ```

2. **Install Node Dependencies:**
   ```powershell
   npm install
   ```

3. **Start Vite Development Server:**
   ```powershell
   npm run dev
   ```
   *Frontend will open at:* `http://localhost:5173/`

---

## 🔐 Demo Credentials

All test accounts use the password: **`password123`**

| Role | Username | Email | Portal Dashboard |
| :--- | :--- | :--- | :--- |
| **👑 HMS Admin** | `admin` | `admin@hms.local` | `/admin/dashboard` |
| **🛡️ Hostel Warden** | `warden` | `warden@hms.local` | `/warden/dashboard` |
| **🚪 Security Guard** | `security` | `security@hms.local` | `/security/scanner` |
| **🎓 Student Resident** | `student` | `student@hms.local` | `/student/dashboard` |

---

## 🌟 Key Features & Module Workflows

### 👑 1. HMS Admin Suite
- **Executive Telemetry:** Occupancy rates, capacity breakdown, residence donut distribution, and weekly gate pass trends.
- **Hostel & Block Management:** Add/Edit residential buildings with Boys/Girls/Co-ed rules, floor counts, and staff assignments.
- **Room & Bed Matrix:** Real-time occupancy grid with single/double/triple bed slots and allocation drawers.
- **Student Directory & Outside Residents:** Filter by allotment status, allocate beds, vacate residents, and register guest interns/researchers.
- **Dining Menu Planner:** Interactive 7-day recurring timetable (Monday–Sunday) with Breakfast, Lunch, Snacks, Dinner pastel cards.
- **Automated Mess Billing:** Monthly invoice calculations with automatic deductions for meals skipped by students.
- **Issue Tracker:** Maintenance ticket board (Plumbing, Electrical, Wi-Fi) with resolution status workflows.
- **Visitor Logbook:** Campus guest check-in / check-out audit register.

### 🛡️ 2. Warden Portal
- **Gate Pass Review Queue:** Filter by Pending, Approved, or Rejected requests.
- **1-Click Approvals:** Approve or reject outpasses with custom warden remarks.
- **Hostel Oversight:** Real-time resident directory and block room vacancy monitoring.

### 🚪 3. Security Terminal
- **Gate Pass Verification:** Search by Enrollment USN or scan QR tokens.
- **Active Pass Validation:** Instant green validity banner showing student details, room, and destination.
- **Timestamped Movement Logging:** Single-click `[Mark Gate Exit]` and `[Mark Gate Entry]` recording exact server timestamps and curfew delays.

### 🎓 4. Student Resident Portal
- **My Room Details:** Building, room number, allocated bed slot, and roommate contact cards.
- **Digital Outpass:** Live approved pass with verification QR token code.
- **Today's Dining Menu & Meal Skip:** Live dining schedule with `[Skip Dinner]` deduction toggle.
- **Apply for Gate Pass:** Instant pass application modal for Day Out, Night Out, or Home Visits.

---

## 🎨 Design System & Specification

All visual styles strictly adhere to [`FRONTEND_DESIGN_AND_ARCHITECTURE_SPEC.md`](./FRONTEND_DESIGN_AND_ARCHITECTURE_SPEC.md):
- **Base Canvas:** Soft Mint `#F0FDF9`
- **Active Navigation Pill:** Dark Teal `#0D3833`
- **Stat Cards:** Lime `#E8F8CE`, Mint/Teal `#D1F2EA`, Soft Coral `#FCE2E1`, Lavender `#E0E7FF`
- **Form Controls:** Shadcn UI Select, DatePicker, Popover, and Dialogs.

---

## 📄 License
Internal Enterprise Software — Developed for Hostel Operations.
