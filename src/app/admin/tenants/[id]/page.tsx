"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TenantDetail {
  id: number;
  companyName: string;
  slug: string;
  adminEmail: string;
  subscriptionStatus: string;
  trialStartedAt: string;
  subscriptionExpiresAt: string;
  isActivated: boolean;
  lastActivityAt: string;
  createdAt: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  customDomain: string | null;
  payments: Array<{
    id: number;
    planType: string;
    amountIdr: number;
    paidAt: string;
    validUntil: string;
  }>;
}

type ActionType = "suspend" | "activate" | "restore" | null;

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [durationDays, setDurationDays] = useState(30);

  useEffect(() => {
    fetch(`/api/admin/tenants/${params.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTenant(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleAction() {
    if (!actionType || !tenant) return;
    setActionLoading(true);
    setActionError("");

    const url = `/api/admin/tenants/${tenant.id}/${actionType}`;
    const body =
      actionType === "activate" ? JSON.stringify({ durationDays }) : undefined;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });

      if (res.ok) {
        setActionType(null);
        // Refresh tenant data
        const refreshRes = await fetch(`/api/admin/tenants/${tenant.id}`);
        if (refreshRes.ok) {
          setTenant(await refreshRes.json());
        }
      } else {
        const data = await res.json();
        setActionError(data.error?.message || "Aksi gagal.");
      }
    } catch {
      setActionError("Terjadi kesalahan jaringan.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Memuat detail tenant...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-muted-foreground">Tenant tidak ditemukan.</p>
        <Button variant="outline" onClick={() => router.push("/admin/tenants")}>
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{tenant.companyName}</h1>
          <p className="text-sm text-muted-foreground">{tenant.slug}</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/admin/tenants")}>
          Kembali
        </Button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informasi Tenant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label="Email" value={tenant.adminEmail} />
            <InfoRow label="Status" value={tenant.subscriptionStatus} />
            <InfoRow
              label="Expires"
              value={new Date(tenant.subscriptionExpiresAt).toLocaleDateString("id-ID")}
            />
            <InfoRow label="Activated" value={tenant.isActivated ? "Ya" : "Belum"} />
            <InfoRow
              label="Registered"
              value={new Date(tenant.createdAt).toLocaleDateString("id-ID")}
            />
            <InfoRow
              label="Last Activity"
              value={new Date(tenant.lastActivityAt).toLocaleDateString("id-ID")}
            />
            {tenant.customDomain && (
              <InfoRow label="Custom Domain" value={tenant.customDomain} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aksi</CardTitle>
            <CardDescription>Kelola status tenant ini.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {tenant.subscriptionStatus !== "suspended" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setActionType("suspend");
                  setActionError("");
                }}
              >
                Suspend
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setActionType("activate");
                setActionError("");
                setDurationDays(30);
              }}
            >
              Aktifkan / Perpanjang
            </Button>
            {tenant.subscriptionStatus === "archived" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionType("restore");
                  setActionError("");
                }}
              >
                Restore
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      {tenant.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat Pembayaran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tenant.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between text-sm border-b pb-2"
                >
                  <span>
                    {p.planType} — Rp {p.amountIdr.toLocaleString("id-ID")}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(p.paidAt).toLocaleDateString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={(open) => { if (!open) setActionType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "suspend" && "Suspend Tenant"}
              {actionType === "activate" && "Aktifkan / Perpanjang"}
              {actionType === "restore" && "Restore Tenant"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "suspend" &&
                `Apakah Anda yakin ingin men-suspend "${tenant.companyName}"? Tenant tidak akan bisa mengakses dashboard.`}
              {actionType === "activate" &&
                `Aktifkan atau perpanjang subscription untuk "${tenant.companyName}".`}
              {actionType === "restore" &&
                `Restore data yang telah diarsipkan untuk "${tenant.companyName}".`}
            </DialogDescription>
          </DialogHeader>

          {actionType === "activate" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="duration">Durasi (hari)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={365}
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value, 10) || 30)}
              />
            </div>
          )}

          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setActionType(null)}>
              Batal
            </Button>
            <Button
              variant={actionType === "suspend" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={actionLoading}
            >
              {actionLoading ? "Memproses..." : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
