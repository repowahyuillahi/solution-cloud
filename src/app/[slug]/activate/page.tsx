"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
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

export default function TenantActivatePage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [licenseCode, setLicenseCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/${slug}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseCode }),
      });

      if (!res.ok) {
        setError("License code tidak valid");
        return;
      }

      router.push(`/${slug}/login`);
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
            Masukkan license code yang Anda terima saat registrasi untuk mengaktifkan dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="licenseCode">License Code</Label>
              <Input
                id="licenseCode"
                type="text"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={licenseCode}
                onChange={(e) => setLicenseCode(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Memproses..." : "Aktivasi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
