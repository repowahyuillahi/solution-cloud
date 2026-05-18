"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function ActivatePage() {
  const router = useRouter();
  const [licenseCode, setLicenseCode] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!slug.trim()) {
      setError("Slug perusahaan harus diisi.");
      setLoading(false);
      return;
    }

    if (!licenseCode.trim()) {
      setError("License code harus diisi.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/${slug}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || "Aktivasi gagal. Periksa license code Anda.");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/${slug}/login`);
      }, 2000);
    } catch {
      setError("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aktivasi Dashboard</CardTitle>
          <CardDescription>
            Masukkan slug perusahaan dan license code untuk mengaktifkan dashboard absensi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">Slug Perusahaan</Label>
              <Input
                id="slug"
                placeholder="contoh-indonesia"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Slug yang Anda daftarkan saat registrasi.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="licenseCode">License Code</Label>
              <Input
                id="licenseCode"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={licenseCode}
                onChange={(e) => setLicenseCode(e.target.value)}
                className="font-mono"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {success && (
              <p className="text-sm text-green-600">
                Aktivasi berhasil! Mengalihkan ke halaman login...
              </p>
            )}

            <Button type="submit" disabled={loading || success}>
              {loading ? "Memproses..." : "Aktivasi"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="mt-4 text-sm text-muted-foreground">
        <a href="/" className="text-primary underline underline-offset-4">
          Kembali ke halaman utama
        </a>
      </p>
    </main>
  );
}
