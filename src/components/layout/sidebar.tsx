"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { TenantRole, Feature } from "@/types";

interface NavItem {
  label: string;
  href: string;
  feature: Feature;
}

const ROLE_PERMISSIONS: Record<TenantRole, Feature[]> = {
  Superadmin: [
    "user-management",
    "machine-management",
    "employee-management",
    "bulk-download",
    "report",
    "dashboard",
    "branch-schedule",
    "company-profile",
    "domain-settings",
  ],
  HRD: ["employee-management", "bulk-download", "report", "dashboard"],
  Resepsionis: ["report", "dashboard"],
};

interface SidebarProps {
  slug: string;
  role: TenantRole;
  username: string;
  onLogout: () => void;
}

export function Sidebar({ slug, role, username, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { label: "Dashboard", href: `/${slug}`, feature: "dashboard" },
    { label: "Mesin", href: `/${slug}/machines`, feature: "machine-management" },
    { label: "Karyawan", href: `/${slug}/employees`, feature: "employee-management" },
    { label: "Users", href: `/${slug}/users`, feature: "user-management" },
    { label: "Download", href: `/${slug}/download`, feature: "bulk-download" },
    { label: "Laporan", href: `/${slug}/reports`, feature: "report" },
    { label: "Jadwal", href: `/${slug}/settings`, feature: "branch-schedule" },
  ];

  const visibleNavItems = navItems.filter((item) =>
    ROLE_PERMISSIONS[role]?.includes(item.feature)
  );

  return (
    <aside className="w-56 border-r bg-muted/30 p-4 flex flex-col gap-2">
      <h2 className="text-sm font-semibold mb-1">Absensi Dashboard</h2>
      <p className="text-xs text-muted-foreground mb-4">
        {username} ({role})
      </p>
      <nav className="flex flex-col gap-1">
        {visibleNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
              pathname === item.href
                ? "bg-muted font-medium"
                : "text-muted-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto">
        <button
          onClick={onLogout}
          className="w-full rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          Keluar
        </button>
      </div>
    </aside>
  );
}
