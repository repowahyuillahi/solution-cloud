"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface BillingInfo {
  subscriptionStatus: string;
  subscriptionExpiresAt: string;
  daysRemaining: number;
  planType: string | null;
}

const plans = [
  {
    id: "monthly",
    name: "Bulanan",
    price: "Rp 35.000",
    priceNum: 35000,
    duration: "30 hari",
    description: "Cocok untuk trial atau penggunaan jangka pendek.",
  },
  {
    id: "yearly",
    name: "Tahunan",
    price: "Rp 350.000",
    priceNum: 350000,
    duration: "365 hari",
    description: "Hemat ~17% dibanding bulanan. Rekomendasi untuk penggunaan jangka panjang.",
    discount: true,
  },
];

export default function PortalBillingPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/portal/billing")
      .then((res) => res.json())
      .then((data) => setBilling(data))
      .catch(() => {});
  }, []);

  async function handleSubscribe(planType: string) {
    setMessage("");
    setSubscribing(true);

    try {
      const res = await fetch("/api/portal/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });

      if (res.ok) {
        const data = await res.json();
        setBilling(data);
        setMessage("Langganan berhasil diperpanjang!");
      } else {
        const data = await res.json();
        setMessage(data.message || "Gagal berlangganan.");
      }
    } catch {
      setMessage("Terjadi kesalahan jaringan.");
    } finally {
      setSubscribing(false);
    }
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

  if (!billing) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Memuat data billing...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Manajemen Langganan</h1>
        <p className="text-sm text-muted-foreground">
          Kelola paket langganan platform absensi Anda.
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status Saat Ini</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className="text-sm font-medium">
              {getStatusLabel(billing.subscriptionStatus)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Sisa Hari</span>
            <span className="text-sm font-medium">
              {billing.daysRemaining > 0 ? `${billing.daysRemaining} hari` : "Berakhir"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Berakhir Pada</span>
            <span className="text-sm">
              {new Date(billing.subscriptionExpiresAt).toLocaleDateString("id-ID")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Pilih Paket</CardTitle>
          <CardDescription>
            Perpanjang langganan Anda dengan memilih paket di bawah.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div>
                  <h3 className="font-medium">{plan.name}</h3>
                  <p className="text-2xl font-bold">{plan.price}</p>
                  <p className="text-xs text-muted-foreground">/ {plan.duration}</p>
                </div>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
                {plan.discount && (
                  <span className="inline-block w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    Hemat 17%
                  </span>
                )}
                <Button
                  size="sm"
                  disabled={subscribing}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {subscribing ? "Memproses..." : "Berlangganan"}
                </Button>
              </div>
            ))}
          </div>
          {message && (
            <p className={`mt-4 text-sm ${message.includes("berhasil") ? "text-green-600" : "text-destructive"}`}>
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
