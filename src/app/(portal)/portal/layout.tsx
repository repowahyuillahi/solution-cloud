"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", href: "/portal" },
  { label: "Profil", href: "/portal/profile" },
  { label: "Billing", href: "/portal/billing" },
  { label: "Domain", href: "/portal/domain" },
];

export default function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user is authenticated by calling session endpoint
    fetch("/api/portal/license")
      .then((res) => {
        if (!res.ok) {
          setAuthenticated(false);
          router.push("/");
        } else {
          setAuthenticated(true);
        }
      })
      .catch(() => {
        setAuthenticated(false);
        router.push("/");
      });
  }, [router]);

  async function handleLogout() {
    await fetch("/api/portal/login", { method: "DELETE" });
    router.push("/");
  }

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Memuat...</p>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-muted/30 p-4 flex flex-col gap-2">
        <h2 className="text-sm font-semibold mb-4">Customer Portal</h2>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
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
