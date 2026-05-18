"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface RegistrationResult {
  tenantId: number;
  slug: string;
  licenseCode: string;
  trialExpiresAt: string;
}

interface FieldError {
  field?: string;
  message: string;
}

export default function RegisterPage() {
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FieldError | null>(null);
  const [result, setResult] = useState<RegistrationResult | null>(null);

  function handleCompanyNameChange(value: string) {
    setCompanyName(value);
    // Auto-generate slug from company name
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);
    setCompanySlug(slug);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/portal/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          companySlug,
          adminEmail,
          adminUsername,
          adminPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError({ field: data.field, message: data.message || "Registrasi gagal." });
        return;
      }

      setResult(data as RegistrationResult);
    } catch {
      setError({ message: "Terjadi kesalahan jaringan. Coba lagi." });
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Registrasi Berhasil!</CardTitle>
            <CardDescription>
              Perusahaan Anda telah terdaftar. Simpan license code berikut.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground mb-1">License Code</p>
              <p className="font-mono text-lg font-semibold break-all">
                {result.licenseCode}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>URL Dashboard: <span className="font-mono">wflab.web.id/{result.slug}/</span></p>
              <p>Trial berakhir: {new Date(result.trialExpiresAt).toLocaleDateString("id-ID")}</p>
            </div>
            <div className="flex flex-col gap-2">
              <a href={`/${result.slug}/activate`}>
                <Button className="w-full">Aktivasi Dashboard</Button>
              </a>
              <a href="/">
                <Button variant="outline" className="w-full">Kembali ke Login</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Daftar Perusahaan Baru</CardTitle>
          <CardDescription>
            Buat akun untuk mulai menggunakan platform absensi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companyName">Nama Perusahaan</Label>
              <Input
                id="companyName"
                placeholder="PT Contoh Indonesia"
                value={companyName}
                onChange={(e) => handleCompanyNameChange(e.target.value)}
                required
              />
              {error?.field === "companyName" && (
                <p className="text-xs text-destructive">{error.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companySlug">Slug (URL)</Label>
              <Input
                id="companySlug"
                placeholder="contoh-indonesia"
                value={companySlug}
                onChange={(e) => setCompanySlug(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                URL: <span className="font-mono">wflab.web.id/{companySlug || "..."}/</span>
              </p>
              {error?.field === "companySlug" && (
                <p className="text-xs text-destructive">{error.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adminEmail">Email Admin</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@perusahaan.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
              {error?.field === "adminEmail" && (
                <p className="text-xs text-destructive">{error.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adminUsername">Username Admin</Label>
              <Input
                id="adminUsername"
                placeholder="admin"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                required
              />
              {error?.field === "adminUsername" && (
                <p className="text-xs text-destructive">{error.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adminPassword">Password Admin</Label>
              <Input
                id="adminPassword"
                type="password"
                placeholder="Minimal 8 karakter"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
              {error?.field === "adminPassword" && (
                <p className="text-xs text-destructive">{error.message}</p>
              )}
            </div>

            {error && !error.field && (
              <p className="text-sm text-destructive">{error.message}</p>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? "Mendaftar..." : "Daftar"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-4 text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <a href="/" className="text-primary underline underline-offset-4">
          Masuk
        </a>
      </p>
    </main>
  );
}
