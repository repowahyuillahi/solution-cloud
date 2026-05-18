"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DashboardStats {
  totalMachines: number;
  totalEmployees: number;
  lastDownload: {
    id: number;
    totalMachines: number;
    successCount: number;
    failedCount: number;
    totalLogs: number;
    startedAt: string;
    completedAt: string;
    triggeredBy: string;
  } | null;
}

export default function TenantDashboardPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/${slug}/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Memuat dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Selamat datang di dashboard absensi <strong>{slug}</strong>.
      </p>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Mesin</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalMachines ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Karyawan</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalEmployees ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Download Terakhir</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {stats?.lastDownload
                ? new Date(stats.lastDownload.completedAt).toLocaleDateString(
                    "id-ID",
                    { day: "2-digit", month: "short", year: "numeric" }
                  )
                : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Last Download Summary */}
      {stats?.lastDownload ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ringkasan Download Terakhir</CardTitle>
            <CardDescription>
              Oleh {stats.lastDownload.triggeredBy} pada{" "}
              {new Date(stats.lastDownload.completedAt).toLocaleString("id-ID")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {stats.lastDownload.totalMachines}
                </p>
                <p className="text-xs text-muted-foreground">Total Mesin</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {stats.lastDownload.successCount}
                </p>
                <p className="text-xs text-muted-foreground">Berhasil</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {stats.lastDownload.failedCount}
                </p>
                <p className="text-xs text-muted-foreground">Gagal</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {stats.lastDownload.totalLogs}
                </p>
                <p className="text-xs text-muted-foreground">Total Log</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Belum ada riwayat download. Gunakan menu Download untuk mengunduh
              data absensi dari mesin fingerprint.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
