"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PlatformStats {
  totalTenants: number;
  activeSubscriptions: number;
  trialsExpiringSoon: number;
  statusBreakdown: {
    trial: number;
    active: number;
    expired: number;
    suspended: number;
    archived: number;
  };
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Memuat statistik...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Platform Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tenants</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalTenants ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aktif / Trial</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {stats?.activeSubscriptions ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trial Segera Expired</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">
              {stats?.trialsExpiringSoon ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {stats?.statusBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatusItem label="Trial" value={stats.statusBreakdown.trial} color="text-blue-600" />
              <StatusItem label="Active" value={stats.statusBreakdown.active} color="text-green-600" />
              <StatusItem label="Expired" value={stats.statusBreakdown.expired} color="text-yellow-600" />
              <StatusItem label="Suspended" value={stats.statusBreakdown.suspended} color="text-red-600" />
              <StatusItem label="Archived" value={stats.statusBreakdown.archived} color="text-gray-600" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusItem({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
