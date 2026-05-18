"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { TenantRole, Feature } from "@/types";

interface SessionInfo {
  userId: number;
  username: string;
  role: TenantRole;
  tenantSlug: string;
}

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

function hasPermission(role: TenantRole, feature: Feature): boolean {
  return ROLE_PERMISSIONS[role].includes(feature);
}

export default function TenantDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`/api/${slug}/auth/session`)
      .then((res) => {
        if (!res.ok) {
          setAuthenticated(false);
          router.push(`/${slug}/login`);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setSession(data);
          setAuthenticated(true);
        }
      })
      .catch(() => {
        setAuthenticated(false);
        router.push(`/${slug}/login`);
      });
  }, [slug, router]);

  async function handleLogout() {
    await fetch(`/api/${slug}/auth/logout`, { method: "POST" });
    router.push(`/${slug}/login`);
  }

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Memuat...</p>
      </div>
    );
  }

  if (!authenticated || !session) {
    return null;
  }

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
    hasPermission(session.role, item.feature)
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-muted/30 p-4 flex flex-col gap-2">
        <h2 className="text-sm font-semibold mb-1">Absensi Dashboard</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {session.username} ({session.role})
        </p>
        <nav className="flex flex-col gap-1">
          {visibleNavItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
                pathname === item.href
                  ? "bg-muted font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto">
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full">
            Keluar
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
