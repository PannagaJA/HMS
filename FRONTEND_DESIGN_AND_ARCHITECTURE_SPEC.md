# FRONTEND_DESIGN_AND_ARCHITECTURE_SPEC.md
# Master Frontend Specification for Hostel Management System (HMS)

> **MANDATORY INSTRUCTION FOR ALL AGENTS & DEVELOPERS:**
> Any and all frontend implementation (UI components, pages, design tokens, color palettes, layouts, state management, and API integrations) for this project **MUST STRICTLY REFER TO AND ADHERE TO THIS DOCUMENT**. No arbitrary styles, dark themes, or AI-generated generic templates are permitted.
>
> **CRITICAL COMPONENT RULE: STRICT USAGE OF SHADCN / RADIX UI**
> All interactive dropdowns, selects, dialogs, sheets, popovers, calendars, date-pickers, tooltips, and tabs across the entire application **MUST STRICTLY USE SHADCN / RADIX UI PRIMITIVES**. Do NOT use raw HTML `<select>`, unstyled native date inputs `<input type="date">`, or ad-hoc custom dropdowns.

---

## 1. Design Philosophy & Visual Identity

The UI follows a **Modern Enterprise Soft-Pastel Light Theme** inspired by human-crafted SaaS dashboards with soft rounded geometry, clear visual hierarchy, and spacious breathing room.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  (H) HostelDesk     [ 🔍 Search student, room, pass... ]         [👤 Admin Profile]  │
├──────────────┬───────────────────────────────────────────────────────────────────────────┤
│ MAIN MENU    │  Welcome Admin!                                         [ + New Action ]  │
│ ┌──────────┐ │                                                                           │
│ │📊Dashboard│ │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│ └──────────┘ │  │   Lime Card  │ │   Teal Card  │ │   Pink Card  │ │ Lavender Card│     │
│ 🏢 Hostels   │  │ Total Hostels│ │Occupancy Rate│ │Pending Passes│ │Active Tickets│     │
│ 🛏️ Rooms     │  │  12 Hostels  │ │ 88.4% (745)  │ │  37 Requests │ │ 158 Solved   │     │
│ 👥 Residents │  │   [||||||]   │ │   [||||||]   │ │   [||||||]   │ │   [||||||]   │     │
│              │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘     │
│ OPERATIONS   │                                                                           │
│ 🎫 Gate Pass │  ┌──────────────────────────────┐  ┌────────────────────────────────────┐ │
│ 🍽️ Mess Menu  │  │ Donut Graph Report           │  │ Total Movement Overview (Bar Chart)│ │
│ 🔧 Issues    │  │       ( 755K Total )         │  │    [|||] [|||] [|||] [|||] [|||]   │ │
│              │  └──────────────────────────────┘  └────────────────────────────────────┘ │
│ SETTINGS     │  Recent Activity & Requests                                               │
│ ⚙️ System    │  ┌──────────────────────────────────────────────────────────────────────┐ │
│              │  │ [Avatar] Liam Evans    Room A108   Out: 19:15   [ 🟡 PENDING ] [...]  │ │
│              │  │ [Avatar] Sarah Chen    Room B211   Out: 19:05   [ 🟢 APPROVED ] [...] │ │
│              │  └──────────────────────────────────────────────────────────────────────┘ │
└──────────────┴───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Design Tokens & Styling Rules

### 2.1 Color Palette
| Token Name | Hex Code | Tailwind / CSS Equivalent | Purpose |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `#F0FDF9` / `#F8FAFC` | `bg-slate-50` / `bg-emerald-50/20` | Main application background |
| **Surface White** | `#FFFFFF` | `bg-white` | White rounded panels, cards, modals |
| **Sidebar Active Item** | `#0D3833` / `#064E3B` | `bg-[#0D3833] text-white` | Active pill navigation state |
| **Sidebar Inactive** | `#64748B` | `text-slate-500 hover:bg-slate-100` | Inactive menu links |
| **Inactive Icon Bubble**| `#F1F5F9` | `bg-slate-100 text-slate-600` | Circular container for menu icons |
| **Stat Card 1 (Lime)** | `#E8F8CE` | `bg-[#E8F8CE] text-emerald-950` | Primary metric (Total Hostels, Rooms) |
| **Stat Card 2 (Teal)** | `#D1F2EA` | `bg-[#D1F2EA] text-teal-950` | Secondary metric (Occupancy %, Residents) |
| **Stat Card 3 (Pink)** | `#FCE2E1` | `bg-[#FCE2E1] text-rose-950` | Action required (Pending Passes, Leaves) |
| **Stat Card 4 (Lavender)**| `#E0E7FF` | `bg-[#E0E7FF] text-indigo-950` | Operational metric (Issues, Billing) |
| **Border Neutral** | `#E2E8F0` | `border-slate-200` | Card borders, dividers, table lines |
| **Text Primary** | `#0F172A` | `text-slate-900` | High-contrast headings and bold text |
| **Text Secondary** | `#64748B` | `text-slate-500` | Subtitles, labels, timestamps |

### 2.2 Geometry & Rounded Corners
* **Main Panels & Dashboard Cards:** `rounded-3xl` (`24px`) or `rounded-2xl` (`16px`).
* **Active Navigation Pills:** `rounded-full` or `rounded-xl` with horizontal padding (`px-4 py-3`).
* **Buttons & Search Inputs:** Pill-shaped `rounded-full` with subtle borders (`border border-slate-200 bg-white`).
* **Avatars & Icon Badges:** `rounded-full`.

### 2.3 Typography
* **Primary Font:** `Inter`, `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
* **Weights:** `font-normal` (400) for body, `font-medium` (500) for labels, `font-semibold` (600) for cards, `font-bold` (700) for metrics/titles.
* **Heading Size Scale:**
  - Welcome / Hero Title: `text-2xl font-bold text-slate-900`
  - Section Title: `text-lg font-semibold text-slate-800`
  - Stat Numbers: `text-3xl font-bold text-slate-900`
  - Small Label / Badge: `text-xs font-medium`

---

## 3. Strict Component Guidelines: Shadcn UI Architecture

> **MANDATORY REQUIREMENT FOR ALL FORM CONTROLS & INTERACTIVE OVERLAYS**

1. **Dropdowns & Select Menus (`Select`, `SelectTrigger`, `SelectContent`, `SelectItem`):**
   - **MUST** use Shadcn Select / Radix Select component primitives.
   - Native HTML `<select>` elements are strictly forbidden.
   - Styled with soft rounded pill boundaries, clean chevron indicators, and subtle focus rings.

2. **Date & Calendar Pickers (`DatePicker`, `Calendar`, `Popover`):**
   - **MUST** use Shadcn `Calendar` and `Popover` combinations with `date-fns` formatting.
   - Raw `<input type="date">` or `<input type="month">` are strictly forbidden.
   - Support single date, date-range selections, and month selectors with modern interactive calendar popovers.

3. **Dialogs & Modals (`Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`):**
   - **MUST** use Shadcn Dialog / Radix Dialog primitives.
   - Backdrop blur (`backdrop-blur-sm bg-black/40`), smooth zoom animations, and accessible keyboard escape handling.

4. **Tabs & Segmented Switches (`Tabs`, `TabsList`, `TabsTrigger`):**
   - **MUST** use Shadcn Tabs for switching views, filters, and role tabs.

5. **Tooltips, Popovers & Context Menus (`Tooltip`, `Popover`, `DropdownMenu`):**
   - **MUST** use Shadcn primitives for contextual menus (such as 3-dot action buttons on cards and tables).

---

## 4. Core UI Components & Standards

### 4.1 Sidebar Navigation (`Sidebar.tsx`)
* Top brand logo with rounded icon and bold title (`HostelDesk` or `HMS Portal`).
* Categorized section labels (`MAIN MENU`, `HOSTEL & RESIDENTS`, `DINING & OPERATIONS`).
* Active link rendered as solid dark-teal pill (`bg-[#0D3833] text-white shadow-sm`).
* Inactive links rendered with circular icon bubbles and smooth hover transitions.

### 4.2 Top Header (`Header.tsx`)
* Rounded search input pill with magnifying glass icon and placeholder (`Search student, room, pass...`).
* Language selector / Notification bell with circular pill count badge.
* User profile summary with circular avatar, user name, role subtitle, and dropdown chevron.

### 4.3 Pastel Stat Metric Cards (`StatCard.tsx`)
* Four distinct pastel backgrounds (`#E8F8CE`, `#D1F2EA`, `#FCE2E1`, `#E0E7FF`).
* Top bar within card showing small icon bubble, title label, and 3-dot options button (`...`).
* Main large metric value (e.g., `88.4%`, `12 Hostels`, `37 Pending`).
* Bottom row showing mini vertical bar indicator and monthly change badge (e.g., `+2.5% This Month`).

### 4.4 Data Tables & Lists (`DataTable.tsx`)
* Pure white container with `rounded-2xl border border-slate-200 shadow-sm`.
* Clean header row with subtle background (`bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider`).
* Rows with smooth hover effect (`hover:bg-slate-50/80 transition-colors`).
* Status tags:
  - **Approved / Active / Occupied:** `bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 text-xs font-semibold`
  - **Pending / In-Review:** `bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1 text-xs font-semibold`
  - **Rejected / Expired / Dues:** `bg-rose-50 text-rose-700 border border-rose-200 rounded-full px-3 py-1 text-xs font-semibold`
  - **In Progress / Maintenance:** `bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-xs font-semibold`

---

## 5. Security & Token Architecture

1. **Authentication Flow:**
   - Dual-token JWT architecture (`access` and `refresh` tokens).
   - Unique device fingerprinting (`hms_device_id` via `crypto.randomUUID()`) sent with `X-Device-ID`.
   - Mutex-locked token refresh in `authService.ts` to prevent race conditions.
   - Server-side token blacklisting on logout via `POST /api/auth/logout/`.

2. **Role-Based Protected Routes:**
   - Role boundaries enforced at the router layer via `ProtectedRoute.tsx`.
   - Unauthorized navigation attempts automatically redirect to the user's home dashboard.

---

## 6. Verification Checklist
- [x] Soft light-mint background `#F0FDF9` across all screens.
- [x] Dark-teal `#0D3833` active pills.
- [x] 4 signature pastel cards (Lime, Mint/Teal, Coral/Pink, Lavender).
- [x] **Strict requirement:** Shadcn UI components for all Select dropdowns, DatePickers, Dialogs, Popovers, and Tabs.
- [x] Full RBAC separation (HMS Admin, Warden, Security, Student).
