# Graph Report - HMS  (2026-09-03)

## Corpus Check
- 174 files · ~75,218 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 528 nodes · 1114 edges · 52 communities (13 shown, 17 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 29
- Community 30
- Community 31

## God Nodes (most connected - your core abstractions)
1. `react` - 31 edges
2. `TimeStampedModel` - 23 edges
3. `apiClient` - 22 edges
4. `compilerOptions` - 19 edges
5. `Hostel` - 17 edges
6. `HostelStudent` - 16 edges
7. `HostelRoom` - 15 edges
8. `SelectTrigger` - 15 edges
9. `SelectContent` - 15 edges
10. `SelectItem` - 15 edges

## Surprising Connections (you probably didn't know these)
- `HostelStudentSerializer` --uses--> `HostelStudent`  [INFERRED]
  backend/apps/student/serializers.py → backend/apps/student/models.py
- `HostelStudentViewSet` --uses--> `HostelStudent`  [INFERRED]
  backend/apps/student/views.py → backend/apps/student/models.py
- `CustomTokenObtainPairView` --uses--> `CustomTokenObtainPairSerializer`  [INFERRED]
  backend/apps/authentication/views.py → backend/apps/authentication/serializers.py
- `CurrentUserProfileView` --uses--> `UserSerializer`  [INFERRED]
  backend/apps/authentication/views.py → backend/apps/authentication/serializers.py
- `Hostel` --inherits--> `TimeStampedModel`  [EXTRACTED]
  backend/apps/hms_admin/models.py → backend/apps/core/models.py

## Import Cycles
- None detected.

## Communities (52 total, 17 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (43): AdminDashboard(), HMSProfile(), HostelManagement(), IssueTracking(), DAYS, MenuManagement(), RoomManagement(), StudentManagement() (+35 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (51): App(), StaffManagement(), Header(), HeaderProps, Sidebar(), SidebarProps, ProtectedRoute(), ProtectedRouteProps (+43 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (28): Meta, TimeStampedModel, MealType, Menu, MenuItem, MessBilling, Meta, StudentMealSkip (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (30): Hostel, HostelCaretaker, HostelCourse, HostelRoom, HostelWarden, Meta, HostelCaretakerSerializer, HostelCourseSerializer (+22 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (45): autoprefixer, axios, class-variance-authority, clsx, date-fns, dependencies, autoprefixer, axios (+37 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (34): devDependencies, jsdom, oxlint, @tailwindcss/postcss, @testing-library/jest-dom, @testing-library/react, @types/node, @types/react (+26 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (12): HostelIssue, IssueUpdate, HostelIssueSerializer, IssueUpdateSerializer, Meta, get_warden_hostels(), HostelIssueViewSet, action (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (13): IsHMSAdmin, IsSecurity, IsStudent, IsWarden, HostelOutsideStudent, HostelOutsideStudentSerializer, HostelStudentSerializer, Meta (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (24): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+16 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.18
Nodes (9): CustomTokenObtainPairSerializer, Meta, UserSerializer, CurrentUserProfileView, CustomTokenObtainPairView, LogoutView, APIView, TokenObtainPairSerializer (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (8): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, typescript, warn

### Community 13 - "Community 13"
Cohesion: 0.50
Nodes (3): buildCommand, outputDirectory, rewrites

## Knowledge Gaps
- **123 isolated node(s):** `C:\Users\Dell\miniconda3\python.exe`, `crg-session-start.sh script`, `crg-update.sh script`, `C:\Users\Dell\miniconda3\python.exe`, `C:\Users\Dell\miniconda3\python.exe` (+118 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 214 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HostelStudent` connect `Community 2` to `Community 10`, `Community 3`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 4` to `Community 5`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `react` connect `Community 0` to `Community 1`, `Community 11`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `C:\Users\Dell\miniconda3\python.exe`, `crg-session-start.sh script`, `crg-update.sh script` to the rest of the system?**
  _123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10890269151138716 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06648575305291723 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0742447516641065 - nodes in this community are weakly interconnected._