"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CompanyProfile {
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  logoUrl: string | null;
}

export default function CompanyProfilePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [profile, setProfile] = useState<CompanyProfile>({
    companyName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    logoUrl: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch(`/api/portal/profile`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setProfile({
            companyName: data.companyName ?? "",
            contactEmail: data.contactEmail ?? "",
            contactPhone: data.contactPhone ?? "",
            address: data.address ?? "",
            logoUrl: data.logoUrl ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const res = await fetch(`/api/portal/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (res.ok) {
        setSuccess("Profil berhasil disimpan.");
      } else {
        const data = await res.json();
        setError(data.error?.message || "Gagal menyimpan profil.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran file maksimal 2MB.");
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setError("Format file harus PNG, JPG, atau SVG.");
      return;
    }

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await fetch(`/api/portal/profile/logo`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setProfile((prev) => ({ ...prev, logoUrl: data.logoUrl }));
        setSuccess("Logo berhasil diupload.");
      } else {
        const data = await res.json();
        setError(data.error?.message || "Gagal mengupload logo.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Memuat profil...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Profil Perusahaan</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo Perusahaan</CardTitle>
          <CardDescription>
            Upload logo perusahaan (PNG/JPG/SVG, maks 2MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {profile.logoUrl && (
              <Image
                src={profile.logoUrl}
                alt="Logo"
                width={64}
                height={64}
                className="h-16 w-16 rounded object-contain border"
                unoptimized
              />
            )}
            <Input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={handleLogoUpload}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informasi Perusahaan</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-name">Nama Perusahaan</Label>
              <Input
                id="company-name"
                value={profile.companyName}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, companyName: e.target.value }))
                }
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-email">Email Kontak</Label>
              <Input
                id="contact-email"
                type="email"
                value={profile.contactEmail}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, contactEmail: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-phone">Telepon</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={profile.contactPhone}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, contactPhone: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address">Alamat</Label>
              <Input
                id="address"
                value={profile.address}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, address: e.target.value }))
                }
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
