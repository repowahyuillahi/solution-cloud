# Solution Cloud - SaaS Absensi Multi-Tenant

Platform SaaS multi-tenant untuk manajemen absensi berbasis fingerprint. Mengambil data dari mesin fingerprint via [solutioncloud.co.id](http://www.solutioncloud.co.id), mengolah data kehadiran, dan menghasilkan laporan lengkap dengan deteksi keterlambatan dan ketidakhadiran.

## Fitur Utama

- **Multi-Tenant** — Setiap perusahaan punya dashboard dan database terpisah
- **Kelola Mesin Fingerprint** — CRUD mesin dengan SN dan password solutioncloud
- **Kelola Karyawan** — CRUD + bulk import dari Excel, multi-cabang
- **Auto Download Absensi** — Tarik data att_log.dat dari semua mesin sekaligus
- **Laporan Absensi** — Jam masuk/pulang, status (Tepat Waktu/Telat/Tidak Masuk)
- **Export** — Excel (.xlsx) dan PDF
- **Notifikasi Otomatis** — Kirim laporan harian via WhatsApp, Email, atau Telegram
- **Scheduling** — Jadwalkan download + kirim laporan otomatis
- **Role-Based Access** — Superadmin, HRD, Resepsionis
- **Docker Ready** — Deploy dengan docker-compose

## Arsitektur

```
wflab.web.id/                    → Customer Portal (registrasi, billing, license)
wflab.web.id/{tenant-slug}/      → Dashboard Aplikasi Absensi per tenant
wflab.web.id/admin/              → Platform Owner Admin Panel
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + Backend | Next.js 14 (App Router) |
| UI | shadcn/ui + Tailwind CSS |
| Database | SQLite + Prisma ORM (1 DB per tenant) |
| Auth | iron-session |
| Validation | Zod |
| Export | exceljs + pdfmake |
| Containerization | Docker + docker-compose |

## Quick Start (Development)

```bash
# Clone
git clone https://github.com/repowahyuillahi/solution-cloud.git
cd solution-cloud

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

## Docker Deployment

```bash
# Build and run
docker-compose up -d

# Migrasi ke server baru
# 1. Copy volumes: databases/, data/, backups/, uploads/
# 2. docker-compose up -d
```

## Project Structure

```
├── prisma/                    # Database schemas (master + tenant)
├── src/
│   ├── app/
│   │   ├── (portal)/         # Customer Portal
│   │   ├── admin/            # Platform Owner Admin
│   │   ├── [slug]/           # Tenant Application Dashboard
│   │   └── api/              # API Routes
│   ├── lib/                  # Auth, DB, RBAC, validation
│   ├── services/             # Business logic
│   └── components/           # React components
├── data/                     # .dat files per tenant (gitignored)
├── databases/                # SQLite files (gitignored)
├── docker-compose.yml
├── Dockerfile
└── .kiro/specs/              # Requirements & Design docs
```

## Tenant Pertama

**CV TJAHAJA BARU** (slug: `tjahaja-baru`) — 34 cabang mesin fingerprint

## Status

🚧 **In Development** — Spec & design selesai, implementasi dimulai.

## License

Private - All rights reserved.
