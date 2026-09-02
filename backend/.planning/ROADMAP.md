# Backend Execution Roadmap

## Phase 1: Authentication, Permissions & Base API Hardening
**Goal:** Verify and secure core JWT authentication flows, session handling, and RBAC guards.
- [ ] Task 1.1: Audit DRF permission classes against all domain apps.
- [ ] Task 1.2: Add unit and integration tests for JWT login, refresh, blacklist, and multi-device sessions.
- [ ] Task 1.3: Validate token expiry handling and custom user model constraints.

## Phase 2: Domain Logic & Workflow API Completeness
**Goal:** Complete, test, and optimize core business modules (Admin, Student, Warden, Security, Mess).
- [ ] Task 2.1: Verify room allocation state machine and capacity constraints in `hms_admin`.
- [ ] Task 2.2: Ensure pass approval/rejection and issue lifecycle tracking in `warden` and `security`.
- [ ] Task 2.3: Finalize mess menu scheduling, meal-skip logic, and monthly billing calculations in `mess`.

## Phase 3: Query Optimization, Indexing & Performance
**Goal:** Profile queries, eliminate N+1 issues, and verify index performance.
- [ ] Task 3.1: Profile viewsets with Django Debug Toolbar / Silk or test queries using `assertNumQueries`.
- [ ] Task 3.2: Optimize foreign key and relation fetches using `select_related` and `prefetch_related`.
- [ ] Task 3.3: Add database indexes for query-heavy search fields (e.g. roll numbers, dates, statuses).

## Phase 4: Full Test Suite & CI Verification
**Goal:** Achieve high test coverage with an automated pytest suite.
- [ ] Task 4.1: Build end-to-end API test suites for all 4 role personas.
- [ ] Task 4.2: Configure automated test runners and verify seamless test execution.
