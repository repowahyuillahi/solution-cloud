"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface AttendanceRecord {
  kodeDealer: string;
  namaDealer: string;
  tanggal: string;
  kodeKaryawan: string;
  namaKaryawan: string;
  jamMasuk: string | null;
  jamPulang: string | null;
  totalTap: number;
  status: "Tepat Waktu" | "Telat" | "Tidak Masuk";
}

interface Machine {
  id: number;
  kodeDealer: string;
  namaDealer: string;
}

export default function ReportsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filter state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [kodeDealer, setKodeDealer] = useState<string>("all");

  // Fetch machines for filter dropdown
  useEffect(() => {
    fetch(`/api/${slug}/machines`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setMachines(Array.isArray(data) ? data : data.machines ?? []);
      })
      .catch(() => {});
  }, [slug]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    if (kodeDealer && kodeDealer !== "all") {
      params.set("kodeDealer", kodeDealer);
    }

    try {
      const res = await fetch(`/api/${slug}/reports?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      } else {
        const data = await res.json();
        setError(data.error?.message || "Gagal memuat laporan.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }, [slug, startDate, endDate, kodeDealer]);

  function handleExport(format: "xlsx" | "pdf") {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });
    if (kodeDealer && kodeDealer !== "all") {
      params.set("kodeDealer", kodeDealer);
    }
    window.open(
      `/api/${slug}/reports/export/${format}?${params.toString()}`,
      "_blank"
    );
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "Tepat Waktu":
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Tepat Waktu
          </span>
        );
      case "Telat":
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
            Telat
          </span>
        );
      case "Tidak Masuk":
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            Tidak Masuk
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  }

  // Summary stats
  const tepatWaktu = records.filter((r) => r.status === "Tepat Waktu").length;
  const telat = records.filter((r) => r.status === "Telat").length;
  const tidakMasuk = records.filter((r) => r.status === "Tidak Masuk").length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Laporan Absensi</h1>

      {/* Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter Laporan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start-date">Tanggal Mulai</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end-date">Tanggal Akhir</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cabang</Label>
              <Select value={kodeDealer} onValueChange={(val) => setKodeDealer(val ?? "all")}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Cabang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Cabang</SelectItem>
                  {machines.map((m) => (
                    <SelectItem key={m.kodeDealer} value={m.kodeDealer}>
                      {m.namaDealer} ({m.kodeDealer})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchReport} disabled={loading}>
              {loading ? "Memuat..." : "Tampilkan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Summary Stats */}
      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-green-600">{tepatWaktu}</p>
              <p className="text-xs text-muted-foreground">Tepat Waktu</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{telat}</p>
              <p className="text-xs text-muted-foreground">Telat</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-red-600">{tidakMasuk}</p>
              <p className="text-xs text-muted-foreground">Tidak Masuk</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Export Buttons */}
      {records.length > 0 && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport("xlsx")}>
            Export Excel
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")}>
            Export PDF
          </Button>
        </div>
      )}

      {/* Report Table */}
      {records.length > 0 ? (
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode Dealer</TableHead>
                <TableHead>Nama Dealer</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kode Karyawan</TableHead>
                <TableHead>Nama Karyawan</TableHead>
                <TableHead>Jam Masuk</TableHead>
                <TableHead>Jam Pulang</TableHead>
                <TableHead>Total Tap</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record, idx) => (
                <TableRow key={idx}>
                  <TableCell>{record.kodeDealer}</TableCell>
                  <TableCell>{record.namaDealer}</TableCell>
                  <TableCell>
                    {record.tanggal.split("-").reverse().join("/")}
                  </TableCell>
                  <TableCell>{record.kodeKaryawan}</TableCell>
                  <TableCell>{record.namaKaryawan}</TableCell>
                  <TableCell>{record.jamMasuk ?? "-"}</TableCell>
                  <TableCell>{record.jamPulang ?? "-"}</TableCell>
                  <TableCell>{record.totalTap}</TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        !loading && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Tidak ada data absensi. Pilih rentang tanggal dan klik
                &quot;Tampilkan&quot; untuk melihat laporan.
              </p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
