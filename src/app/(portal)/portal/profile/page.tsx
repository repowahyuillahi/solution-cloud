"use client";

import { useEffect, useState } from "react";
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

interface ProfileData {
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  logoUrl: string | null;
}

export default function PortalProfilePage() {
  const [profile, setProfile] = useState<ProfileData>({
    companyName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    logoUrl: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/portal/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfile({
          companyName: data.companyName || "",
          contactEmail: data.contactEmail || "",
          contactPhone: data.contactPhone || "",
          address: data.address || "",
          logoUrl: data.logoUrl || null,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setSaving(true);

    try {
      const res = await fetch("/api/portal/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (res.ok) {
        setMessage("Profil berhasil disimpan.");
      } else {
        const data = await res.json();
        setMessage(data.error?.message || "Gagal menyimpan profil.");
      }
    } catch {
      setMessage("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Memuat profil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Profil Perusahaan</h1>
        <p className="text-sm text-muted-foreground">
          Kelola informasi perusahaan Anda.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Perusahaan</CardTitle>
          <CardDescription>
            Data ini akan ditampilkan di laporan dan dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companyName">Nama Perusahaan</Label>
              <Input
                id="companyName"
                value={profile.companyName}
                onChange={(e) =>
                  setProfile({ ...profile, companyName: e.target.value })
                }
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactEmail">Email Kontak</Label>
              <Input
                id="contactEmail"
                type="email"
                value={profile.contactEmail}
                onChange={(e) =>
                  setProfile({ ...profile, contactEmail: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactPhone">Telepon</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={profile.contactPhone}
                onChange={(e) =>
                  setProfile({ ...profile, contactPhone: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address">Alamat</Label>
              <Input
                id="address"
                value={profile.address}
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
              />
            </div>

            {/* Logo upload area */}
            <div className="flex flex-col gap-1.5">
              <Label>Logo Perusahaan</Label>
              <div className="flex items-center gap-4">
                {profile.logoUrl ? (
                  <img
                    src={profile.logoUrl}
                    alt="Logo"
                    className="h-16 w-16 rounded-md border object-contain"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-muted">
                    <span className="text-xs text-muted-foreground">Logo</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  <p>Upload logo (PNG, JPG, SVG, maks 2MB)</p>
                  <p>Fitur upload akan tersedia segera.</p>
                </div>
              </div>
            </div>

            {message && (
              <p className={`text-sm ${message.includes("berhasil") ? "text-green-600" : "text-destructive"}`}>
                {message}
              </p>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Profil"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
