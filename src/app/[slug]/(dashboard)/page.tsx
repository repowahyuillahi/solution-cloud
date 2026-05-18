"use client";

import { useParams } from "next/navigation";

export default function TenantDashboardPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Selamat datang di dashboard absensi <strong>{slug}</strong>.
      </p>
    </div>
  );
}
