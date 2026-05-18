"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we're on the login page
    if (pathname === "/admin/login") {
      setAuthenticated(true); // Allow login page to render
      return;
    }

    // Verify admin session by checking stats endpoint
    fetch("/api/admin/stats")
      .then((res) => {
        if (res.ok) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
          router.push("/admin/login");
        }
      })
      .catch(() => {
        setAuthenticated(false);
        router.push("/admin/login");
      });
  }, [pathname, router]);

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Memuat...</p>
      </div>
    );
  }

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (!authenticated) {
    return null;
  }

  const navItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "Tenants", href: "/admin/tenants" },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-muted/30 p-4 flex flex-col gap-2">
        <h2 className="text-sm font-semibold mb-1">Platform Admin</h2>
        <p className="text-xs text-muted-foreground mb-4">Owner Panel</p>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
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
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => router.push("/")}
          >
            Kembali ke Portal
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
