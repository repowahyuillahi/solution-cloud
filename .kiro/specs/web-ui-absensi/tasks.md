# Implementation Plan: Web UI Absensi (Multi-Tenant SaaS)

## Overview

Implementasi platform SaaS multi-tenant untuk manajemen absensi berbasis fingerprint menggunakan Next.js 14 (App Router), Prisma ORM, SQLite (database per tenant), shadcn/ui + Tailwind CSS, dan iron-session. Platform terdiri dari tiga portal: Customer Portal, Application Dashboard, dan Platform Owner Admin. Deployment menggunakan Docker.

## Tasks

- [x] 1. Project setup dan core infrastructure
  - [x] 1.1 Initialize Next.js 14 project dengan TypeScript, Tailwind CSS, dan shadcn/ui
    - Create Next.js 14 app with App Router
    - Install dependencies: prisma, @prisma/client, iron-session, axios, exceljs, pdfmake, zod, bcrypt, shadcn/ui
    - Configure tailwind.config.ts dan tsconfig.json
    - Setup directory structure sesuai design (src/app, src/lib, src/services, src/components, src/types)
    - _Requirements: 18.1_

  - [x] 1.2 Create Prisma schemas (master + tenant) dan generate clients
    - Create prisma/schema-master.prisma with Tenant, PlatformOwner, PaymentHistory models
    - Create prisma/schema-tenant.prisma with User, Machine, Employee, BranchAssignment, BranchSchedule, DownloadHistory models
    - Configure separate generator outputs (src/generated/master, src/generated/tenant)
    - Run prisma generate for both schemas
    - _Requirements: 12.1, 18.4_

  - [x] 1.3 Implement database connection services (master + tenant pool)
    - Create src/lib/db-master.ts — singleton PrismaClient for master.sqlite
    - Create src/lib/db-tenant.ts — LRU connection pool (max 20) with idle timeout
    - Implement getTenantDb(slug), provisionDatabase(slug), archiveDatabase(slug), restoreDatabase(slug)
    - Create databases/ directory structure
    - _Requirements: 12.1, 12.2_

  - [x] 1.4 Implement validation schemas (Zod)
    - Create src/lib/validation.ts with all Zod schemas from design
    - registrationSchema, loginSchema, createUserSchema, createMachineSchema, createEmployeeSchema
    - reportFilterSchema, branchScheduleSchema, companyProfileSchema, customDomainSchema
    - _Requirements: 10.7, 1.1, 2.1, 3.1, 4.1, 4.7_

  - [x] 1.5 Implement shared types and error handling
    - Create src/types/index.ts with all TypeScript interfaces from design
    - Create src/lib/errors.ts with ApiError interface and error code constants
    - Implement createErrorResponse helper function
    - _Requirements: 1.2, 9.4_

  - [x]* 1.6 Write property tests for validation schemas
    - **Property 4: Whitespace and empty input rejection**
    - **Property 19: Registration input validation**
    - **Validates: Requirements 3.6, 4.7, 10.7**

- [x] 2. Authentication dan RBAC system
  - [x] 2.1 Implement iron-session auth module (tenant-aware)
    - Create src/lib/auth.ts with SessionData interface
    - Implement loginTenantUser, loginPortalUser, loginOwner, logout, getSession
    - Implement incrementFailedAttempts, isAccountLocked, resetFailedAttempts
    - Configure session with 30-minute inactivity timeout
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Implement RBAC module with role permissions
    - Create src/lib/rbac.ts with ROLE_PERMISSIONS map
    - Implement hasPermission(role, feature), requireRole(allowedRoles), requireOwner(), requirePortalAuth()
    - Define Feature type and TenantRole type
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 2.3 Implement tenant routing middleware
    - Create src/middleware.ts — Next.js middleware
    - Extract slug from URL path, resolve tenant, check subscription status
    - Handle reserved paths: /admin/, /portal/, /api/portal/, /api/admin/
    - Inject tenant context into request headers
    - _Requirements: 12.2, 12.3, 12.4_

  - [x] 2.4 Implement tenant resolver service
    - Create src/lib/tenant-resolver.ts
    - Implement resolveBySlug(slug), resolveByCustomDomain(domain)
    - Implement isSlugReserved(slug), validateSlug(slug)
    - Check subscription status and block expired/suspended tenants
    - _Requirements: 10.8, 12.2, 14.6, 13.3_

  - [x]* 2.5 Write property tests for password hashing and RBAC
    - **Property 1: Password hashing round-trip**
    - **Property 2: RBAC enforcement**
    - **Validates: Requirements 1.1, 1.2, 2.4, 2.8, 9.1-9.4**

- [x] 3. Checkpoint - Ensure core infrastructure tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Customer Portal (Registration, License, Billing)
  - [x] 4.1 Implement registration service and API
    - Create src/services/registration.ts with register(), activateDashboard(), validateSlug()
    - Create src/app/api/portal/register/route.ts — POST handler
    - Generate unique license code, create tenant record, provision database
    - Start 14-day free trial on registration
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.8_

  - [x] 4.2 Implement subscription manager service
    - Create src/services/subscription-manager.ts
    - Implement createTrial, checkStatus, extendSubscription, getDaysRemaining
    - Implement shouldShowWarning (< 7 days), archiveExpiredTenant, restoreTenant
    - Implement generateLicenseCode, regenerateLicenseCode
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9_

  - [x] 4.3 Implement Customer Portal API routes
    - Create src/app/api/portal/login/route.ts — POST portal login
    - Create src/app/api/portal/license/route.ts — GET license info, POST regenerate
    - Create src/app/api/portal/billing/route.ts — GET status, POST subscribe
    - Create src/app/api/portal/profile/route.ts — GET/PUT company profile, POST logo upload
    - Create src/app/api/portal/domain/route.ts — GET/POST custom domain
    - _Requirements: 11.1, 11.2, 11.3, 14.1, 14.5, 14.9, 14.10, 15.1, 15.2_

  - [x] 4.4 Implement Customer Portal UI pages
    - Create src/app/(portal)/page.tsx — Landing/Login page
    - Create src/app/(portal)/register/page.tsx — Registration form
    - Create src/app/(portal)/portal/page.tsx — Portal dashboard (license, billing overview)
    - Create src/app/(portal)/portal/profile/page.tsx — Company profile settings
    - Create src/app/(portal)/portal/billing/page.tsx — Subscription management
    - Create src/app/(portal)/portal/domain/page.tsx — Custom domain settings
    - Create src/app/(portal)/activate/page.tsx — License activation page
    - _Requirements: 10.1, 10.4, 11.1, 14.1, 14.2, 15.1_

  - [x]* 4.5 Write property tests for registration and subscription
    - **Property 19: Registration input validation**
    - **Property 20: License code uniqueness**
    - **Property 23: Trial days remaining calculation**
    - **Validates: Requirements 10.2, 10.7, 14.2**

- [x] 5. Tenant Application — Auth dan User Management
  - [x] 5.1 Implement tenant auth API routes
    - Create src/app/api/[slug]/auth/login/route.ts — POST login
    - Create src/app/api/[slug]/auth/logout/route.ts — POST logout
    - Create src/app/api/[slug]/auth/session/route.ts — GET session
    - Create src/app/api/[slug]/activate/route.ts — POST activate with license code
    - Handle account locking (5 failed attempts → 15 min lock)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 10.4, 10.5_

  - [x] 5.2 Implement User Management API (CRUD)
    - Create src/app/api/[slug]/users/route.ts — GET list, POST create
    - Create src/app/api/[slug]/users/[id]/route.ts — PUT update, DELETE remove
    - Enforce Superadmin-only access via RBAC middleware
    - Validate input with Zod schemas, hash passwords with bcrypt
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [x] 5.3 Implement tenant auth and user management UI
    - Create src/app/[slug]/(auth)/login/page.tsx — Login form
    - Create src/app/[slug]/activate/page.tsx — License code entry
    - Create src/app/[slug]/(dashboard)/users/page.tsx — User list + CRUD forms
    - Implement role-based navigation hiding
    - _Requirements: 1.1, 2.1, 2.3, 9.5, 10.4_

  - [x]* 5.4 Write property tests for uniqueness and tenant isolation
    - **Property 3: Uniqueness constraint enforcement**
    - **Property 21: Tenant data isolation**
    - **Property 22: Subscription/suspension status enforcement**
    - **Validates: Requirements 2.2, 3.5, 4.6, 10.6, 12.2-12.5, 13.3, 14.6**

- [ ] 6. Tenant Application — Machine Management
  - [~] 6.1 Implement Machine Management API (CRUD)
    - Create src/app/api/[slug]/machines/route.ts — GET list, POST create
    - Create src/app/api/[slug]/machines/[id]/route.ts — PUT update, DELETE remove
    - Enforce Superadmin-only access, validate with Zod
    - Handle unique serial number and kode dealer constraints
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [~] 6.2 Implement Machine Management UI
    - Create src/app/[slug]/(dashboard)/machines/page.tsx
    - Machine list table with connection status indicators
    - Add/Edit/Delete machine forms with confirmation dialog
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 7. Tenant Application — Employee Management
  - [~] 7.1 Implement Employee Management API (CRUD + Import)
    - Create src/app/api/[slug]/employees/route.ts — GET list (with filter), POST create
    - Create src/app/api/[slug]/employees/[id]/route.ts — PUT update, DELETE remove
    - Create src/app/api/[slug]/employees/import/route.ts — POST bulk import from Excel
    - Enforce Superadmin/HRD access, handle branch assignments
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_

  - [~] 7.2 Implement Employee Import service
    - Create src/services/employee-import.ts
    - Parse Excel (.xlsx/.xls) with exceljs
    - Validate rows, skip duplicates, collect errors
    - Return ImportResult summary (total, success, skipped, failed)
    - _Requirements: 4.8, 4.9, 4.10_

  - [~] 7.3 Implement Employee Management UI
    - Create src/app/[slug]/(dashboard)/employees/page.tsx
    - Employee list with branch filter dropdown
    - Add/Edit/Delete forms with branch assignment multi-select
    - Excel import upload with progress and summary display
    - _Requirements: 4.1, 4.2, 4.3, 4.8, 4.9_

  - [ ]* 7.4 Write property tests for employee operations
    - **Property 5: Employee list sorting invariant**
    - **Property 6: Employee branch filter correctness**
    - **Property 7: Bulk operation summary consistency (import)**
    - **Property 8: Bulk import duplicate skipping**
    - **Validates: Requirements 4.2, 4.3, 4.9, 4.10**

- [~] 8. Checkpoint - Ensure CRUD and auth tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Bulk Attendance Download
  - [~] 9.1 Implement file storage service (tenant-isolated)
    - Create src/services/file-storage.ts
    - Implement saveAttLogFile, getLatestFile, cleanupOldFiles (keep 3), listFiles
    - Implement archiveTenantFiles, restoreTenantFiles
    - File path pattern: data/{tenantSlug}/{namaDealer}/{namaDealer}-{DD}-{MM}-{YYYY}.dat
    - _Requirements: 5.2, 5.3, 12.5_

  - [~] 9.2 Implement attendance downloader service
    - Create src/services/attendance-downloader.ts
    - Login to solutioncloud.co.id (POST sc_pro.asp with sn + pass)
    - Download att_log.dat (GET download.asp with session cookie)
    - Process machines with concurrency limit of 5
    - 15-second timeout per machine, mark failed and continue
    - _Requirements: 5.1, 5.8, 5.10_

  - [~] 9.3 Implement bulk download API with SSE progress
    - Create src/app/api/[slug]/download/bulk/route.ts — POST (SSE stream)
    - Create src/app/api/[slug]/download/status/route.ts — GET status
    - Prevent concurrent downloads per tenant
    - Send progress events per machine, final summary event
    - _Requirements: 5.6, 5.7, 5.9, 5.11, 5.12_

  - [~] 9.4 Implement Download UI with real-time progress
    - Create src/app/[slug]/(dashboard)/download/page.tsx
    - SSE client for real-time progress display
    - Progress bar per machine, success/fail indicators
    - Disable button during download, show summary on complete
    - _Requirements: 5.6, 5.7, 5.9, 5.11_

  - [ ]* 9.5 Write property tests for file operations and download
    - **Property 9: att_log.dat parsing round-trip**
    - **Property 10: File naming convention**
    - **Property 11: File retention limit**
    - **Property 12: Latest file selection**
    - **Property 7: Bulk operation summary consistency (download)**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.9**

- [ ] 10. Attendance Report Generation
  - [~] 10.1 Implement att_log.dat parser
    - Create parsing logic in src/services/report-generator.ts
    - Parse tab-separated format: ID\tYYYY-MM-DD HH:MM:SS\tStatus1\tStatus2\tStatus3
    - Handle corrupted lines gracefully (skip invalid, log error)
    - _Requirements: 5.4, 5.5_

  - [~] 10.2 Implement report generator service
    - Implement generateReport(tenantSlug, filter) — match IDs to employees, compute jam masuk/pulang
    - Implement determineStatus(jamMasuk, scheduleJamMasuk, toleranceMinutes)
    - Handle unmatched IDs with "Tidak Ditemukan" label
    - Apply default schedule fallback (08:00, 5 min tolerance, Mon-Sun)
    - Sort results by kodeDealer → tanggal → namaKaryawan
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.8, 6.10, 6.11, 6.12, 7.6_

  - [~] 10.3 Implement report export (Excel + PDF)
    - Implement exportToExcel using exceljs — columns: Kode Dealer, Nama Dealer, Tanggal, Kode Karyawan, Nama Karyawan, Jam Masuk, Jam Pulang, Total Tap, Status
    - Implement exportToPdf using pdfmake — same columns, formatted layout
    - Include tenant company name and logo in exports
    - _Requirements: 6.6, 6.7_

  - [~] 10.4 Implement report API routes
    - Create src/app/api/[slug]/reports/route.ts — GET with date range + kodeDealer filter
    - Create src/app/api/[slug]/reports/export/xlsx/route.ts — GET Excel download
    - Create src/app/api/[slug]/reports/export/pdf/route.ts — GET PDF download
    - Allow all authenticated roles access
    - _Requirements: 6.4, 6.5, 6.6, 6.7, 6.9, 6.13_

  - [~] 10.5 Implement Report UI
    - Create src/app/[slug]/(dashboard)/reports/page.tsx
    - Date range picker and branch filter
    - Attendance table with status color coding (Tepat Waktu=green, Telat=yellow, Tidak Masuk=red)
    - Export buttons (Excel, PDF)
    - Empty state message when no data available
    - _Requirements: 6.4, 6.5, 6.6, 6.7, 6.9_

  - [ ]* 10.6 Write property tests for report generation
    - **Property 13: Attendance record tap time computation**
    - **Property 14: Attendance status determination**
    - **Property 15: Report sorting invariant**
    - **Property 16: Report filter correctness**
    - **Property 17: Unmatched employee ID labeling**
    - **Property 18: Default schedule fallback**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.8, 6.10, 6.11, 6.12, 7.6**

- [ ] 11. Branch Schedule Settings
  - [~] 11.1 Implement branch schedule API
    - Create src/app/api/[slug]/settings/schedule/route.ts — GET list all schedules
    - Create src/app/api/[slug]/settings/schedule/[id]/route.ts — PUT update
    - Auto-create default schedule for branches without custom config
    - Enforce Superadmin-only access
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [~] 11.2 Implement Branch Schedule UI
    - Create src/app/[slug]/(dashboard)/settings/page.tsx
    - Display schedule per branch: jam masuk, tolerance, work days
    - Edit form with time picker, number input, day checkboxes
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 12. Dashboard
  - [~] 12.1 Implement dashboard API
    - Create src/app/api/[slug]/dashboard/route.ts — GET stats
    - Return: total machines, total employees, last download info
    - Return: latest download summary (total, success, failed, logs)
    - Handle case when no download history exists
    - _Requirements: 8.1, 8.2, 8.3_

  - [~] 12.2 Implement Dashboard UI
    - Create src/app/[slug]/(dashboard)/page.tsx
    - Stats cards: total machines, total employees, last download date
    - Latest download summary section
    - Empty state for no download history
    - _Requirements: 8.1, 8.2, 8.3_

- [~] 13. Checkpoint - Ensure all tenant features pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Platform Owner Admin Panel
  - [~] 14.1 Implement Platform Admin API routes
    - Create src/app/api/admin/login/route.ts — POST owner login
    - Create src/app/api/admin/tenants/route.ts — GET list all tenants
    - Create src/app/api/admin/tenants/[id]/route.ts — GET tenant detail
    - Create src/app/api/admin/tenants/[id]/suspend/route.ts — POST suspend
    - Create src/app/api/admin/tenants/[id]/activate/route.ts — POST activate/extend
    - Create src/app/api/admin/tenants/[id]/restore/route.ts — POST restore archived
    - Create src/app/api/admin/stats/route.ts — GET platform statistics
    - Enforce Platform Owner auth on all endpoints
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [~] 14.2 Implement Platform Admin UI
    - Create src/app/admin/layout.tsx — Admin layout with owner auth check
    - Create src/app/admin/page.tsx — Admin dashboard (stats overview)
    - Create src/app/admin/tenants/page.tsx — Tenant list with status filters
    - Create src/app/admin/tenants/[id]/page.tsx — Tenant detail + actions
    - Suspend/Activate/Restore action buttons with confirmation
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.6_

- [ ] 15. Tenant Dashboard Layout dan Navigation
  - [~] 15.1 Implement shared layout components
    - Create src/app/[slug]/(dashboard)/layout.tsx — Authenticated layout wrapper
    - Create src/components/layout/sidebar.tsx — Role-based navigation menu
    - Create src/components/layout/header.tsx — Tenant logo, company name, user info
    - Hide menu items based on user role (RBAC)
    - Display subscription warning banner when < 7 days remaining
    - _Requirements: 9.5, 11.4, 14.3_

  - [~] 15.2 Implement Company Profile settings UI (tenant)
    - Create src/app/[slug]/(dashboard)/settings/profile/page.tsx (or integrate into settings)
    - Logo upload (PNG/JPG/SVG, max 2MB)
    - Company name, contact email, phone, address fields
    - Superadmin-only access
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 16. Scheduled Auto-Download dan Notification Channels
  - [~] 16.1 Implement schedule and notification settings API
    - Create src/app/api/[slug]/settings/auto-download/route.ts — GET/PUT schedule config
    - Create src/app/api/[slug]/settings/notifications/route.ts — GET/PUT notification channels
    - Store config in tenant DB (new model or JSON field)
    - Validate WA/Email/Telegram settings, send test message on save
    - _Requirements: 16.1, 16.2, 16.6, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

  - [~] 16.2 Implement notification delivery service
    - Create src/services/notification-service.ts
    - Implement sendWhatsApp(recipients, file, apiConfig)
    - Implement sendEmail(recipients, file, smtpConfig)
    - Implement sendTelegram(recipients, file, botConfig)
    - Log delivery status per channel per recipient
    - _Requirements: 17.7, 17.8_

  - [~] 16.3 Implement cron scheduler for auto-download
    - Create src/services/cron-scheduler.ts (or separate cron process)
    - Check all tenants with auto-download enabled at their scheduled time
    - Trigger bulk download → generate report → send to notification channels
    - Handle partial failures (some machines fail, still send report)
    - _Requirements: 16.2, 16.3, 16.4, 16.5_

  - [~] 16.4 Implement Schedule and Notification Settings UI
    - Create settings page for auto-download toggle + time picker
    - Create notification channel configuration forms (WA, Email, Telegram)
    - Enable/disable each channel independently
    - Test message button per channel
    - Notification history/log display
    - _Requirements: 16.1, 16.6, 17.1, 17.5, 17.6, 17.9_

- [~] 17. Checkpoint - Ensure all features integrated
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Seed Data dan Database Migrations
  - [~] 18.1 Create master database seed script
    - Create prisma/seed-master.ts
    - Seed PlatformOwner account (configurable via env vars)
    - Seed first tenant: CV TJAHAJA BARU (slug: tjahaja-baru)
    - Generate license code, set trial period
    - _Requirements: 18.4, 18.5_

  - [~] 18.2 Create tenant seed script from Fingerprint Excel
    - Create prisma/seed-tenant-tjahaja.ts
    - Parse "Fingerprint (Update 04 Juni 2022).xlsx" for machine and employee data
    - Seed machines with kode dealer, nama dealer, serial number, password
    - Seed employees with kode karyawan, nama karyawan, branch assignments
    - Create default Superadmin user for the tenant
    - Create default BranchSchedule records
    - _Requirements: 3.1, 4.1, 7.6_

  - [~] 18.3 Create Prisma migration scripts
    - Generate migration for master schema: npx prisma migrate dev --schema=prisma/schema-master.prisma
    - Generate migration for tenant schema: npx prisma migrate dev --schema=prisma/schema-tenant.prisma
    - Create migration runner that applies tenant schema to new databases
    - _Requirements: 18.4_

- [ ] 19. Docker Containerization
  - [~] 19.1 Create Dockerfile (multi-stage build)
    - Build stage: install deps, generate Prisma clients, build Next.js
    - Production stage: minimal image with only production artifacts
    - Include prisma migration and seed scripts in image
    - _Requirements: 18.1, 18.8_

  - [~] 19.2 Create docker-compose.yml
    - Define app service with volume mounts (databases/, data/, backups/, uploads/)
    - Define cron service for scheduled auto-download
    - Configure environment variables (PORT, SESSION_SECRET, OWNER_USERNAME, OWNER_PASSWORD, BACKUP_PATH)
    - Add health check endpoint configuration
    - _Requirements: 18.2, 18.3, 18.5_

  - [~] 19.3 Implement health check endpoint and startup scripts
    - Create src/app/api/health/route.ts — GET health status
    - Create docker-entrypoint.sh — run migrations, seed if needed, start app
    - Ensure databases/ and data/ directories exist on startup
    - _Requirements: 18.4, 18.6, 18.7_

- [ ] 20. Custom Domain Support (wiring)
  - [~] 20.1 Implement custom domain resolution in middleware
    - Update src/middleware.ts to check Host header for custom domains
    - Query master DB for tenant by customDomain field
    - Route to correct tenant context when custom domain matches
    - Maintain original path URL access alongside custom domain
    - _Requirements: 15.3, 15.4_

  - [ ]* 20.2 Write property test for custom domain dual access
    - **Property 24: Custom domain and original URL dual access**
    - **Validates: Requirements 15.4**

- [ ] 21. Final integration and wiring
  - [~] 21.1 Wire all components together and verify routing
    - Ensure all API routes are properly connected to services
    - Verify middleware chain: tenant resolution → auth → RBAC → handler
    - Verify portal, admin, and tenant app routing coexist correctly
    - Test subscription warning banner integration
    - _Requirements: 12.2, 12.3, 12.4, 14.3_

  - [ ]* 21.2 Write integration tests for end-to-end flows
    - Test: Registration → License activation → Login → Download → Report
    - Test: Subscription expiry → Block access → Owner restore
    - Test: Multi-tenant isolation (2 tenants, verify no cross-contamination)
    - _Requirements: 10.1-10.5, 12.2-12.5, 14.6-14.8_

- [~] 22. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (24 properties)
- Unit tests validate specific examples and edge cases
- The first tenant (CV TJAHAJA BARU, slug: tjahaja-baru) is seeded from the existing Fingerprint Excel file
- Technology stack: Next.js 14, TypeScript, Prisma, SQLite, iron-session, shadcn/ui, Tailwind CSS
- All API responses use consistent error format defined in src/lib/errors.ts
- Database per tenant ensures complete data isolation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.3", "1.6"] },
    { "id": 3, "tasks": ["2.1", "2.2"] },
    { "id": 4, "tasks": ["2.3", "2.4", "2.5"] },
    { "id": 5, "tasks": ["4.1", "4.2"] },
    { "id": 6, "tasks": ["4.3", "4.4", "5.1"] },
    { "id": 7, "tasks": ["4.5", "5.2", "5.3"] },
    { "id": 8, "tasks": ["5.4", "6.1", "7.1"] },
    { "id": 9, "tasks": ["6.2", "7.2"] },
    { "id": 10, "tasks": ["7.3", "7.4"] },
    { "id": 11, "tasks": ["9.1", "10.1"] },
    { "id": 12, "tasks": ["9.2", "10.2"] },
    { "id": 13, "tasks": ["9.3", "10.3"] },
    { "id": 14, "tasks": ["9.4", "9.5", "10.4"] },
    { "id": 15, "tasks": ["10.5", "10.6", "11.1"] },
    { "id": 16, "tasks": ["11.2", "12.1"] },
    { "id": 17, "tasks": ["12.2", "14.1"] },
    { "id": 18, "tasks": ["14.2", "15.1"] },
    { "id": 19, "tasks": ["15.2", "16.1"] },
    { "id": 20, "tasks": ["16.2", "16.3"] },
    { "id": 21, "tasks": ["16.4", "18.1"] },
    { "id": 22, "tasks": ["18.2", "18.3"] },
    { "id": 23, "tasks": ["19.1", "19.2"] },
    { "id": 24, "tasks": ["19.3", "20.1"] },
    { "id": 25, "tasks": ["20.2", "21.1"] },
    { "id": 26, "tasks": ["21.2"] }
  ]
}
```
