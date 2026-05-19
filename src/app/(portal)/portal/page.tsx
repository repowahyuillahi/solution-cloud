"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface LicenseInfo {
  licenseCode: string;
  slug: string;
  companyName: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string;
  daysRemaining: number;
}

export default function PortalDashboardPage() {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/portal/license")
      .then((res) => res.json())
      .then((data) => setInfo(data))
      .catch(() => {});
  }, []);

  function copyLicenseCode() {
    if (!info) return;
    navigator.clipboard.writeText(info.licenseCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      trial: "Free Trial",
      active: "Aktif",
      expiring_soon: "Segera Berakhir",
      expired: "Kadaluarsa",
      suspended: "Ditangguhkan",
      archived: "Diarsipkan",
    };
    return labels[status] || status;
  }

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      trial: "text-blue-600",
      active: "text-green-600",
      expiring_soon: "text-yellow-600",
      expired: "text-red-600",
      suspended: "text-red-600",
      archived: "text-muted-foreground",
    };
    return colors[status] || "";
  }

  if (!info) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{info.companyName}</h1>
        <p className="text-sm text-muted-foreground">Portal Dashboard</p>
      </div>

      {/* License Code */}
      <Card>
        <CardHeader>
          <CardTitle>License Code</CardTitle>
          <CardDescription>
            Gunakan kode ini untuk mengaktifkan dashboard absensi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm break-all">
              {info.licenseCode}
            </code>
            <Button variant="outline" size="sm" onClick={copyLicenseCode}>
              {copied ? "Tersalin!" : "Salin"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status Langganan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className={`text-sm font-medium ${getStatusColor(info.subscriptionStatus)}`}>
              {getStatusLabel(info.subscriptionStatus)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Sisa Hari</span>
            <span className="text-sm font-medium">
              {info.daysRemaining > 0 ? `${info.daysRemaining} hari` : "Berakhir"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Berakhir Pada</span>
            <span className="text-sm">
              {new Date(info.subscriptionExpiresAt).toLocaleDateString("id-ID")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Akses Cepat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/portal/profile">
              <Button variant="outline" className="w-full">Profil Perusahaan</Button>
            </Link>
            <Link href="/portal/billing">
              <Button variant="outline" className="w-full">Billing</Button>
            </Link>
            <Link href="/portal/domain">
              <Button variant="outline" className="w-full">Pengaturan Domain</Button>
            </Link>
            <a href={`/${info.slug}/`} target="_blank" rel="noopener noreferrer">
              <Button className="w-full">Buka Dashboard</Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
