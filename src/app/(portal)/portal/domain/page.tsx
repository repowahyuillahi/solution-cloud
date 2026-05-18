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

interface DomainInfo {
  slug: string;
  customDomain: string | null;
}

export default function PortalDomainPage() {
  const [domain, setDomain] = useState<DomainInfo | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/portal/domain")
      .then((res) => res.json())
      .then((data) => {
        setDomain(data);
        setNewDomain(data.customDomain || "");
      })
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setSaving(true);

    try {
      const res = await fetch("/api/portal/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customDomain: newDomain }),
      });

      if (res.ok) {
        const data = await res.json();
        setDomain(data);
        setMessage("Domain berhasil disimpan.");
      } else {
        const data = await res.json();
        setMessage(data.message || "Gagal menyimpan domain.");
      }
    } catch {
      setMessage("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  }

  if (!domain) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Memuat pengaturan domain...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pengaturan Domain</h1>
        <p className="text-sm text-muted-foreground">
          Konfigurasi domain kustom untuk dashboard Anda.
        </p>
      </div>

      {/* Current URL */}
      <Card>
        <CardHeader>
          <CardTitle>URL Saat Ini</CardTitle>
          <CardDescription>
            Dashboard Anda dapat diakses melalui URL berikut.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/50 px-3 py-2">
            <code className="text-sm font-mono">wflab.web.id/{domain.slug}/</code>
          </div>
          {domain.customDomain && (
            <div className="mt-2 rounded-md border bg-muted/50 px-3 py-2">
              <code className="text-sm font-mono">{domain.customDomain}</code>
              <span className="ml-2 text-xs text-green-600">(Custom Domain)</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Domain Form */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Domain</CardTitle>
          <CardDescription>
            Hubungkan domain Anda sendiri ke dashboard absensi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customDomain">Domain</Label>
              <Input
                id="customDomain"
                placeholder="absensi.perusahaan.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
              />
            </div>

            {message && (
              <p className={`text-sm ${message.includes("berhasil") ? "text-green-600" : "text-destructive"}`}>
                {message}
              </p>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Domain"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* DNS Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instruksi DNS</CardTitle>
          <CardDescription>
            Tambahkan record DNS berikut di panel domain Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Type</th>
                  <th className="py-2 text-left font-medium">Name</th>
                  <th className="py-2 text-left font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 font-mono">CNAME</td>
                  <td className="py-2 font-mono">
                    {newDomain ? newDomain.split(".")[0] : "subdomain"}
                  </td>
                  <td className="py-2 font-mono">wflab.web.id</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">TXT</td>
                  <td className="py-2 font-mono">_verification</td>
                  <td className="py-2 font-mono">wflab-verify={domain.slug}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Propagasi DNS biasanya membutuhkan waktu 24-48 jam. Setelah DNS aktif,
            domain kustom Anda akan otomatis terhubung.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
