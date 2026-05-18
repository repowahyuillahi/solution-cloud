# Requirements Document

## Introduction

SaaS multi-tenant platform untuk manajemen absensi berbasis fingerprint. Platform ini dihosting di wflab.web.id dan memungkinkan perusahaan manapun mendaftar, mengkonfigurasi profil perusahaan (logo, nama, kontak), dan langsung menggunakan sistem absensi. Setiap tenant memiliki database terpisah untuk isolasi data penuh. Platform owner (wflab) memiliki admin panel untuk memonitor semua tenant. Sistem mengambil data absensi dari solutioncloud.co.id.

## Glossary

- **Platform**: SaaS multi-tenant yang dihosting di wflab.web.id
- **Platform_Owner**: Administrator platform (wflab) yang dapat melihat dan mengelola semua tenant
- **Tenant**: Satu perusahaan/organisasi yang terdaftar di platform, memiliki database sendiri dan data terisolasi
- **Tenant_Admin**: Pengguna pertama yang mendaftarkan tenant (otomatis menjadi Superadmin tenant tersebut)
- **Web_App**: Aplikasi web full-stack yang menyediakan antarmuka pengguna dan backend API untuk sistem absensi per tenant
- **Machine_Manager**: Modul yang mengelola data mesin fingerprint (CRUD) termasuk serial number, password, kode dealer, dan nama dealer
- **Employee_Manager**: Modul yang mengelola data karyawan (CRUD) termasuk kode karyawan, nama karyawan, dan asosiasi cabang
- **User_Manager**: Modul yang mengelola akun pengguna dan kredensial untuk mengakses Web_App dengan role-based access control
- **Attendance_Downloader**: Modul yang mengunduh log absensi dari solutioncloud.co.id berdasarkan daftar mesin yang terdaftar
- **Report_Generator**: Modul yang mengelompokkan raw log absensi menjadi laporan ringkasan (jam masuk, jam pulang, total tap) per karyawan per hari
- **Authenticated_User**: Pengguna yang telah berhasil login ke Web_App dengan salah satu role: Superadmin, HRD, atau Resepsionis
- **Superadmin**: Role tenant dengan akses penuh ke semua fitur termasuk kelola mesin, kelola user, kelola karyawan, download absensi, dan laporan
- **HRD**: Role tenant dengan akses ke kelola karyawan, download absensi, dan laporan
- **Resepsionis**: Role tenant dengan akses hanya untuk melihat laporan absensi
- **Machine**: Perangkat fingerprint di cabang yang terdaftar dengan serial number dan password untuk akses solutioncloud.co.id
- **Employee**: Data karyawan yang terdiri dari kode karyawan, nama karyawan, dan daftar cabang tempat karyawan terdaftar (bisa lebih dari satu cabang)
- **Branch_Assignment**: Relasi antara karyawan dan cabang/dealer, satu karyawan dapat terdaftar di beberapa cabang
- **Subscription**: Status langganan tenant (free trial, active, expired)
- **Free_Trial**: Periode percobaan gratis selama 14 hari setelah registrasi tenant
- **Branch_Assignment**: Relasi antara karyawan dan cabang/dealer, satu karyawan dapat terdaftar di beberapa cabang

## Requirements

### Requirement 1: User Authentication

**User Story:** As a system administrator, I want to login with username and password, so that only authorized users can access the attendance system.

#### Acceptance Criteria

1. WHEN a user submits a username (maximum 50 characters) and password (maximum 128 characters) that match a registered account, THE Web_App SHALL grant access to the dashboard within 3 seconds
2. IF a user submits credentials that do not match any registered account, THEN THE Web_App SHALL display an error message indicating invalid credentials and deny access to the dashboard
3. IF a user fails authentication 5 consecutive times for the same username, THEN THE Web_App SHALL lock the account for 15 minutes and display a message indicating the account is temporarily locked
4. WHILE a user session is active, THE Web_App SHALL allow access to all authorized features without re-authentication for a maximum session duration of 30 minutes of inactivity
5. IF a session expires due to inactivity or is invalidated, THEN THE Web_App SHALL redirect the user to the login page and require re-authentication before granting access to any feature

### Requirement 2: User Management (Kelola Username dan Password)

**User Story:** As a Superadmin, I want to manage user accounts with role assignments, so that I can control who has access to the system and what they can do.

#### Acceptance Criteria

1. WHEN a Superadmin submits a new user form with a username (3–30 alphanumeric characters), a password (8–128 characters), and a role (one of: Superadmin, HRD, or Resepsionis), THE User_Manager SHALL create the user account and display a confirmation indicating the account was created
2. IF a Superadmin submits a new user form with a username that already exists, THEN THE User_Manager SHALL reject the request and display an error message indicating the username is already taken
3. WHEN a Superadmin requests the user list, THE User_Manager SHALL display all registered users with their usernames and assigned roles
4. WHEN a Superadmin submits a new password (8–128 characters) for an existing user account, THE User_Manager SHALL save the new password in hashed form and display a confirmation indicating the password was updated
5. WHEN a Superadmin updates the role of an existing user account, THE User_Manager SHALL save the new role and display a confirmation indicating the role was updated
6. WHEN a Superadmin deletes an existing user account, THE User_Manager SHALL remove the account and display a confirmation indicating the account was deleted
7. IF a Superadmin attempts to update or delete a user account that does not exist, THEN THE User_Manager SHALL display an error message indicating the user was not found
8. THE User_Manager SHALL store all passwords using a secure one-way hashing algorithm
9. THE Web_App SHALL restrict access to the User Management feature to users with the Superadmin role only

### Requirement 3: Machine Management (Kelola Mesin)

**User Story:** As a Superadmin, I want to manage fingerprint machine data via the web interface, so that I no longer need to maintain an ODS/Excel file manually.

#### Acceptance Criteria

1. WHEN a Superadmin submits a new machine form with kode dealer (max 20 characters), nama dealer (max 100 characters), serial number (max 50 characters), and password (max 50 characters), THE Machine_Manager SHALL create the machine record and display a success confirmation within 2 seconds
2. WHEN a Superadmin requests the machine list, THE Machine_Manager SHALL display all registered machines with kode dealer, nama dealer, serial number, and connection status (one of: "connected", "disconnected", or "unknown")
3. WHEN a Superadmin updates a machine record's kode dealer, nama dealer, or password, THE Machine_Manager SHALL save the changes and display an update confirmation
4. WHEN a Superadmin requests deletion of a machine record, THE Machine_Manager SHALL prompt for confirmation, and upon confirmation remove the record and display a deletion confirmation
5. IF a Superadmin submits a serial number that already exists in the system, THEN THE Machine_Manager SHALL reject the submission and display an error message indicating the serial number is already registered
6. IF a Superadmin submits a machine form where any of kode dealer, nama dealer, serial number, or password is empty or contains only whitespace, THEN THE Machine_Manager SHALL reject the submission and display an error message indicating which fields are required
7. THE Web_App SHALL restrict access to the Machine Management feature to users with the Superadmin role only

### Requirement 4: Employee Data Management (Kelola Data Karyawan)

**User Story:** As a Superadmin or HRD, I want to manage employee data via the web interface with branch assignments, so that I no longer depend on Google Sheets and can track which employees belong to which branches.

#### Acceptance Criteria

1. WHEN a Superadmin or HRD submits a new employee form with kode karyawan, nama karyawan, and one or more branch assignments (kode dealer), THE Employee_Manager SHALL create the employee record and display a success message indicating the employee was created
2. WHEN a Superadmin or HRD requests the employee list, THE Employee_Manager SHALL display all registered employees with kode karyawan, nama karyawan, and assigned branches, sorted by kode karyawan in ascending order
3. WHEN a Superadmin or HRD requests the employee list, THE Employee_Manager SHALL allow filtering by branch (kode dealer)
4. WHEN a Superadmin or HRD updates an employee record, THE Employee_Manager SHALL save the changes and display a success message indicating the employee was updated
5. WHEN a Superadmin or HRD deletes an employee record, THE Employee_Manager SHALL display a confirmation prompt before removing the employee record and display a success message upon deletion
6. IF a Superadmin or HRD submits a kode karyawan that already exists, THEN THE Employee_Manager SHALL reject the submission and display an error message indicating the kode karyawan is already in use
7. IF a Superadmin or HRD submits the employee form with kode karyawan or nama karyawan empty or exceeding 100 characters, THEN THE Employee_Manager SHALL reject the submission and display an error message indicating which field is invalid
8. WHEN a Superadmin or HRD uploads an Excel file (.xlsx or .xls) for bulk import, THE Employee_Manager SHALL parse the file and create employee records for each valid row, associating them with the specified branch
9. WHEN a bulk import is processed, THE Employee_Manager SHALL display a summary showing total rows processed, successfully imported, skipped (duplicates), and failed (invalid data)
10. IF a bulk import file contains a kode karyawan that already exists, THEN THE Employee_Manager SHALL skip that row and include it in the skipped count without stopping the import process
11. THE Web_App SHALL restrict access to the Employee Management feature to users with the Superadmin or HRD role only

### Requirement 5: Bulk Attendance Download

**User Story:** As a Superadmin or HRD, I want to trigger bulk attendance download from the web interface, so that I can fetch att_log.dat files from all registered machines via solutioncloud.co.id.

#### Acceptance Criteria

1. WHEN a Superadmin or HRD triggers a bulk download, THE Attendance_Downloader SHALL login to solutioncloud.co.id using each machine's SN and password, then download the att_log.dat file from the download page (http://www.solutioncloud.co.id/download.asp)
2. WHEN a file is downloaded, THE Attendance_Downloader SHALL rename it to the format "{nama_dealer}-{DD}-{MM}-{YYYY}.dat" and store it in a folder named after the branch (nama_dealer)
3. THE Attendance_Downloader SHALL retain only the 3 most recent .dat files per branch and delete older files automatically
4. WHEN parsing the att_log.dat file, THE Attendance_Downloader SHALL read each line in the format "ID\tYYYY-MM-DD HH:MM:SS\tStatus1\tStatus2\tStatus3" where ID is the employee fingerprint code, followed by timestamp and status flags
5. THE Attendance_Downloader SHALL only process the most recent (latest date) .dat file for generating attendance data, as it contains the complete cumulative log
6. WHILE a bulk download is in progress, THE Web_App SHALL update the progress display at least once per machine processed, showing the current count of machines processed, successful, and failed
7. WHILE a bulk download is in progress, THE Web_App SHALL disable the bulk download trigger to prevent concurrent bulk download operations
8. WHEN a machine fails to respond within 15 seconds, THE Attendance_Downloader SHALL mark that machine as failed and continue processing remaining machines
9. WHEN the bulk download completes, THE Attendance_Downloader SHALL display a summary showing total machines processed, successful count, failed count, and total raw logs fetched
10. THE Attendance_Downloader SHALL process machines with a concurrency limit of 5 simultaneous requests
11. IF no machines are registered in the Machine_Manager when a bulk download is triggered, THEN THE Web_App SHALL display a message indicating no machines are available and shall not initiate the download process
12. THE Web_App SHALL restrict access to the Bulk Download feature to users with the Superadmin or HRD role only

### Requirement 6: Attendance Report Generation

**User Story:** As an Authenticated_User (any role), I want to view and export attendance reports with late and absence indicators, so that I can analyze employee attendance discipline per branch and per day.

#### Acceptance Criteria

1. WHEN attendance data is processed, THE Report_Generator SHALL match each ID in the att_log.dat with the corresponding employee record in the Employee_Manager based on kode karyawan
2. WHEN an employee has multiple taps on the same date, THE Report_Generator SHALL determine jam masuk (earliest tap) and jam pulang (latest tap)
3. WHEN an employee has only one tap recorded for a given date, THE Report_Generator SHALL set jam masuk to that tap time and jam pulang to "-"
4. WHEN an Authenticated_User requests the attendance report, THE Report_Generator SHALL display the report sorted by kode dealer, tanggal, and nama karyawan
5. WHEN an Authenticated_User requests the attendance report, THE Report_Generator SHALL allow filtering by date range and kode dealer
6. WHEN an Authenticated_User exports the report to Excel (.xlsx), THE Report_Generator SHALL generate a file with columns: Kode Dealer, Nama Dealer, Tanggal, Kode Karyawan, Nama Karyawan, Jam Masuk, Jam Pulang, Total Tap, Status
7. WHEN an Authenticated_User exports the report to PDF, THE Report_Generator SHALL generate a formatted PDF document with the same columns and data
8. IF an employee ID from att_log.dat is not found in the Employee_Manager, THEN THE Report_Generator SHALL display the ID with a "Tidak Ditemukan" label in the nama karyawan column
9. IF no attendance data is available when the report is requested, THEN THE Report_Generator SHALL display a message indicating that no data is available and that a bulk download should be performed
10. WHEN an employee's jam masuk exceeds the branch's configured jam masuk plus tolerance, THE Report_Generator SHALL mark the attendance status as "Telat"
11. WHEN an employee's jam masuk is within the branch's configured jam masuk plus tolerance, THE Report_Generator SHALL mark the attendance status as "Tepat Waktu"
12. WHEN an employee assigned to a branch has no tap record on a configured work day, THE Report_Generator SHALL mark that employee's status as "Tidak Masuk" for that date
13. THE Web_App SHALL allow all authenticated roles (Superadmin, HRD, Resepsionis) to view and export attendance reports

### Requirement 7: Branch Work Schedule Settings

**User Story:** As a Superadmin, I want to configure work schedule settings per branch, so that the system can accurately determine late arrivals and absences based on each branch's rules.

#### Acceptance Criteria

1. WHEN a Superadmin accesses the branch schedule settings, THE Web_App SHALL display the current jam masuk, tolerance (in minutes), and active work days for each registered branch (dealer)
2. WHEN a Superadmin updates a branch's jam masuk setting, THE Web_App SHALL save the new value and display a confirmation (default: 08:00)
3. WHEN a Superadmin updates a branch's tolerance setting, THE Web_App SHALL save the new value in minutes and display a confirmation (default: 5 minutes)
4. WHEN a Superadmin updates a branch's active work days, THE Web_App SHALL save the selected days (Monday through Sunday) and display a confirmation (default: Monday to Sunday)
5. THE Web_App SHALL restrict access to the Branch Work Schedule Settings to users with the Superadmin role only
6. IF a branch has no custom schedule configured, THEN THE Web_App SHALL use the default values: jam masuk 08:00, tolerance 5 minutes, work days Monday to Sunday

### Requirement 8: Dashboard

**User Story:** As an Authenticated_User (any role), I want a dashboard overview, so that I can quickly see the system status and recent activity.

#### Acceptance Criteria

1. WHEN an Authenticated_User accesses the dashboard, THE Web_App SHALL display the total number of registered machines, total employees, and the date and time of the last completed bulk download
2. WHEN an Authenticated_User accesses the dashboard, THE Web_App SHALL display a summary of the most recent bulk download result including total machines processed, success count, failure count, and total raw logs fetched
3. IF no bulk download has been performed yet, THEN THE Web_App SHALL display the machine and employee counts and indicate that no download history is available in place of the download summary

### Requirement 9: Role-Based Access Control

**User Story:** As a Superadmin, I want the system to enforce role-based permissions, so that each user can only access features appropriate to their role.

#### Acceptance Criteria

1. WHEN a user with the Superadmin role logs in, THE Web_App SHALL grant access to all features: User Management, Machine Management, Employee Management, Branch Schedule Settings, Bulk Download, Report, and Dashboard
2. WHEN a user with the HRD role logs in, THE Web_App SHALL grant access to Employee Management, Bulk Download, Report, and Dashboard only
3. WHEN a user with the Resepsionis role logs in, THE Web_App SHALL grant access to Report and Dashboard only
4. IF a user attempts to access a feature not permitted by their role, THEN THE Web_App SHALL deny access and display a message indicating insufficient permissions
5. THE Web_App SHALL hide navigation menu items for features that are not accessible to the current user's role

### Requirement 10: Tenant Registration and Onboarding

**User Story:** As a new company, I want to register on the platform portal and receive a license code, so that I can activate my attendance dashboard.

#### Acceptance Criteria

1. WHEN a new user visits wflab.web.id and submits the registration form with company name, company slug (URL path), admin email, admin username, and password, THE Platform SHALL create a new tenant account in the customer portal
2. WHEN a tenant account is created, THE Platform SHALL generate a unique license code (API key) and display it in the customer portal dashboard
3. WHEN a tenant is created, THE Platform SHALL activate a 14-day free trial period with a valid license code granting full access to the application dashboard
4. WHEN the Tenant_Admin first accesses wflab.web.id/{company-slug}/, THE Platform SHALL prompt for the license code to activate the application dashboard
5. WHEN a valid license code is entered, THE Platform SHALL provision the tenant's isolated database and activate the application dashboard at wflab.web.id/{company-slug}/
6. IF a registration is submitted with a company slug or username that already exists, THEN THE Platform SHALL reject the registration and display an appropriate error message
7. THE Platform SHALL validate that admin email is a valid email format, username is 3-30 alphanumeric characters, password is 8-128 characters, and company slug contains only lowercase letters, numbers, and hyphens (3-30 characters)
8. THE Platform SHALL reserve the slug "admin" for the Platform Owner admin panel and reject it during tenant registration

### Requirement 11: Tenant Profile Configuration

**User Story:** As a Tenant_Admin (Superadmin), I want to configure my company profile including logo, company name, and contact information, so that the system reflects my company's branding.

#### Acceptance Criteria

1. WHEN a Superadmin accesses the company profile settings, THE Web_App SHALL display the current company name, logo, contact email, phone number, and address
2. WHEN a Superadmin uploads a company logo (PNG, JPG, or SVG, max 2MB), THE Web_App SHALL save the logo and display it in the navigation header and reports
3. WHEN a Superadmin updates the company name, contact email, phone, or address, THE Web_App SHALL save the changes and display a confirmation
4. THE Web_App SHALL display the company logo and name in the navigation header for all authenticated users of that tenant
5. THE Web_App SHALL restrict access to the Company Profile settings to users with the Superadmin role only

### Requirement 12: Multi-Tenant Data Isolation

**User Story:** As a platform user, I want my company's data to be completely isolated from other companies, so that no other tenant can access my data.

#### Acceptance Criteria

1. THE Platform SHALL create a separate SQLite database file for each tenant upon registration
2. THE Platform SHALL route all data operations to the correct tenant database based on the URL path slug (e.g., wflab.web.id/{slug}/) in the request
3. IF a user attempts to access a URL belonging to a different tenant, THEN THE Platform SHALL deny access and display an error message
4. THE Platform SHALL ensure that no API endpoint can return data from a different tenant's database
5. THE Platform SHALL store tenant .dat files in separate directories per tenant, preventing cross-tenant file access

### Requirement 13: Platform Owner Admin Panel

**User Story:** As the Platform_Owner (wflab), I want an admin panel to view and manage all tenants, so that I can monitor platform usage and manage subscriptions.

#### Acceptance Criteria

1. WHEN the Platform_Owner accesses the owner admin panel at wflab.web.id/admin/, THE Platform SHALL display a list of all registered tenants with company name, slug, registration date, subscription status, and last activity date
2. WHEN the Platform_Owner selects a tenant, THE Platform SHALL display tenant details including number of machines, employees, users, and download history
3. WHEN the Platform_Owner suspends a tenant, THE Platform SHALL block all access to that tenant's dashboard and display a suspension notice to tenant users
4. WHEN the Platform_Owner activates or extends a tenant's subscription, THE Platform SHALL update the subscription status and restore full access
5. THE Platform SHALL restrict access to the owner admin panel to Platform_Owner credentials only
6. WHEN the Platform_Owner views the dashboard, THE Platform SHALL display total tenants, active subscriptions, trials expiring soon, and total platform usage statistics

### Requirement 14: Subscription and License Management

**User Story:** As a Tenant_Admin, I want to manage my license/subscription from the customer portal, so that I can continue using the platform after the free trial ends.

#### Acceptance Criteria

1. WHEN a Tenant_Admin accesses the customer portal at wflab.web.id, THE Platform SHALL display the current license status (free trial, active, expiring soon, expired), plan details, license code, and expiry date
2. WHEN a Tenant_Admin is on free trial, THE Platform SHALL display the number of remaining trial days in the customer portal
3. WHEN a license has fewer than 7 days remaining, THE Platform SHALL display a warning pop-up on the application dashboard reminding the user to renew, and indicate that data will be archived 7 days after expiration
4. THE Platform SHALL offer subscription plans: monthly (Rp 35.000/month) and yearly (with discount)
5. WHEN a Tenant_Admin selects a subscription plan and completes payment, THE Platform SHALL extend the license code validity and confirm activation
6. WHEN a license expires, THE Platform SHALL immediately block access to the application dashboard and display a message indicating the license has expired
7. WHEN a license has been expired for 7 days without renewal, THE Platform SHALL archive (backup) the tenant's database and .dat files to a backup server and remove them from the active system
8. WHEN a previously expired tenant requests reactivation, THE Platform_Owner SHALL be able to restore the archived data and issue a new license code
9. THE Platform SHALL allow the Tenant_Admin to view and regenerate their license code from the customer portal
10. THE Web_App SHALL restrict access to the Subscription Management page in the customer portal to the Tenant_Admin only

### Requirement 15: Custom Domain Support

**User Story:** As a Tenant_Admin, I want to optionally use my own custom domain for the attendance system, so that it looks professional under my company's branding.

#### Acceptance Criteria

1. WHEN a Superadmin accesses the domain settings, THE Web_App SHALL display the current tenant URL path (wflab.web.id/{slug}/) and option to add a custom domain
2. WHEN a Superadmin submits a custom domain, THE Platform SHALL provide DNS configuration instructions (CNAME record pointing to wflab.web.id)
3. WHEN the DNS is properly configured and verified, THE Platform SHALL activate the custom domain and route traffic to the correct tenant
4. THE Platform SHALL continue to support access via the original path URL (wflab.web.id/{slug}/) even after a custom domain is configured
5. THE Web_App SHALL restrict access to the Domain Settings to users with the Superadmin role only

### Requirement 16: Scheduled Auto-Download and Report Delivery

**User Story:** As a Superadmin, I want to schedule automatic daily attendance downloads and have the report sent to configured channels, so that I receive the attendance report without manual intervention.

#### Acceptance Criteria

1. WHEN a Superadmin accesses the schedule settings, THE Web_App SHALL display options to enable/disable auto-download and set the daily execution time (HH:MM format)
2. WHEN auto-download is enabled and the scheduled time is reached, THE Attendance_Downloader SHALL automatically trigger a bulk download from all registered machines without manual intervention
3. WHEN the scheduled bulk download completes, THE Report_Generator SHALL automatically generate the daily attendance report in the configured export format (Excel and/or PDF)
4. WHEN the report is generated, THE Platform SHALL send the report file to all configured notification channels (WhatsApp, Email, and/or Telegram)
5. IF a scheduled download fails for some machines, THE Platform SHALL still generate and send the report with available data and include a note about failed machines
6. WHEN a Superadmin updates the schedule time, THE Web_App SHALL save the new schedule and display a confirmation
7. THE Web_App SHALL restrict access to the Schedule Settings to users with the Superadmin role only

### Requirement 17: Notification Channel Configuration

**User Story:** As a Superadmin, I want to configure notification channels (WhatsApp, Email, Telegram) and recipients, so that the daily report is delivered to the right people via their preferred channels.

#### Acceptance Criteria

1. WHEN a Superadmin accesses the notification settings, THE Web_App SHALL display configuration options for WhatsApp, Email, and Telegram channels
2. WHEN a Superadmin configures WhatsApp delivery, THE Web_App SHALL allow entering one or more recipient phone numbers and the WA Gateway API endpoint/token
3. WHEN a Superadmin configures Email delivery, THE Web_App SHALL allow entering one or more recipient email addresses and SMTP settings (or email service API key)
4. WHEN a Superadmin configures Telegram delivery, THE Web_App SHALL allow entering one or more Telegram chat IDs and the Telegram Bot token
5. WHEN a Superadmin saves notification settings, THE Web_App SHALL validate the configuration by sending a test message to each configured channel and display success/failure per channel
6. THE Web_App SHALL allow enabling or disabling each channel independently (a tenant can use all three, any combination, or none)
7. WHEN a report is sent, THE Platform SHALL send to all enabled channels simultaneously and log the delivery status (success/failed) per channel per recipient
8. IF a notification delivery fails, THE Platform SHALL log the failure and display it in the notification history, but shall not retry automatically
9. THE Web_App SHALL restrict access to the Notification Settings to users with the Superadmin role only

### Requirement 18: Docker Containerization and Deployment

**User Story:** As a platform operator, I want the application to run in Docker containers, so that I can easily deploy, migrate, and manage the infrastructure on my Debian server.

#### Acceptance Criteria

1. THE Platform SHALL provide a Dockerfile that builds the Next.js application into a production-ready container image
2. THE Platform SHALL provide a docker-compose.yml that defines all required services (app, cron scheduler for auto-download) with proper volume mounts for persistent data
3. THE Platform SHALL use Docker volumes to persist SQLite databases (master + tenant databases), .dat files, uploaded logos, and backup data outside the container
4. WHEN the container is started, THE Platform SHALL automatically run database migrations (Prisma migrate) and seed the platform owner account if not already present
5. THE Platform SHALL support environment variables for configuration (port, session secret, platform owner credentials, backup path)
6. WHEN migrating to a new server, THE Platform SHALL allow migration by copying the Docker volumes (databases/, data/, backups/) and running docker-compose up on the new host
7. THE Platform SHALL include a health check endpoint (/api/health) that returns the application status for Docker health monitoring
8. THE Platform SHALL use a multi-stage Dockerfile to minimize the final image size (build stage + production stage)
