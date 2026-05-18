"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface MachineProgress {
  machineId: number;
  kodeDealer: string;
  namaDealer: string;
  status: "processing" | "success" | "failed";
  error?: string;
  logsCount?: number;
}

interface DownloadSummary {
  totalMachines: number;
  successCount: number;
  failedCount: number;
  totalLogs: number;
  startedAt: string;
  completedAt: string;
}

interface LastDownload {
  id: number;
  totalMachines: number;
  successCount: number;
  failedCount: number;
  totalLogs: number;
  startedAt: string;
  completedAt: string;
}

export default function DownloadPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<MachineProgress[]>([]);
  const [summary, setSummary] = useState<DownloadSummary | null>(null);
  const [lastDownload, setLastDownload] = useState<LastDownload | null>(null);
  const [error, setError] = useState("");
  const [totalMachines, setTotalMachines] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/${slug}/download/status`);
      if (res.ok) {
        const data = await res.json();
        setDownloading(data.inProgress);
        if (data.lastDownload) {
          setLastDownload(data.lastDownload);
        }
      }
    } catch {
      // ignore
    }
  }, [slug]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  function startDownload() {
    setError("");
    setProgress([]);
    setSummary(null);
    setDownloading(true);

    // Use fetch for POST SSE
    fetchSSE();
  }

  async function fetchSSE() {
    try {
      const res = await fetch(`/api/${slug}/download/bulk`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || "Gagal memulai download.");
        setDownloading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Tidak dapat membaca stream.");
        setDownloading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = "";

        let currentEvent = "";
        let currentData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6).trim();
          } else if (line === "" && currentEvent && currentData) {
            handleSSEEvent(currentEvent, currentData);
            currentEvent = "";
            currentData = "";
          } else if (line !== "") {
            // Incomplete line, put back in buffer
            buffer = line;
          }
        }

        // If we have a pending event without the trailing newline
        if (currentEvent && currentData) {
          handleSSEEvent(currentEvent, currentData);
        }
      }

      setDownloading(false);
      fetchStatus();
    } catch {
      setError("Koneksi terputus saat download.");
      setDownloading(false);
    }
  }

  function handleSSEEvent(event: string, data: string) {
    try {
      const parsed = JSON.parse(data);

      switch (event) {
        case "start":
          setTotalMachines(parsed.totalMachines);
          break;
        case "progress":
          setProgress((prev) => {
            const existing = prev.findIndex(
              (p) => p.machineId === parsed.machineId
            );
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = parsed;
              return updated;
            }
            return [...prev, parsed];
          });
          break;
        case "complete":
          setSummary(parsed);
          setDownloading(false);
          break;
        case "error":
          setError(parsed.message || "Terjadi kesalahan.");
          setDownloading(false);
          break;
      }
    } catch {
      // ignore parse errors
    }
  }

  const completedCount = progress.filter(
    (p) => p.status === "success" || p.status === "failed"
  ).length;
  const progressPercent =
    totalMachines > 0 ? Math.round((completedCount / totalMachines) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bulk Download Absensi</h1>
        <Button onClick={startDownload} disabled={downloading}>
          {downloading ? "Sedang Download..." : "Mulai Download"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Progress Section */}
      {downloading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress Download</CardTitle>
            <CardDescription>
              {completedCount} / {totalMachines} mesin selesai ({progressPercent}%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Overall progress bar */}
            <div className="w-full bg-muted rounded-full h-3 mb-4">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Per-machine progress */}
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {progress.map((p) => (
                <div
                  key={p.machineId}
                  className="flex items-center justify-between text-sm border rounded px-3 py-2"
                >
                  <div>
                    <span className="font-medium">{p.namaDealer}</span>
                    <span className="text-muted-foreground ml-2">
                      ({p.kodeDealer})
                    </span>
                  </div>
                  <div>{getStatusBadge(p)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Section */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hasil Download</CardTitle>
            <CardDescription>
              Selesai pada{" "}
              {new Date(summary.completedAt).toLocaleString("id-ID")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Mesin" value={summary.totalMachines} />
              <StatCard
                label="Berhasil"
                value={summary.successCount}
                className="text-green-600"
              />
              <StatCard
                label="Gagal"
                value={summary.failedCount}
                className="text-red-600"
              />
              <StatCard label="Total Log" value={summary.totalLogs} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Download History */}
      {!downloading && !summary && lastDownload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Download Terakhir</CardTitle>
            <CardDescription>
              {new Date(lastDownload.completedAt).toLocaleString("id-ID")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Mesin" value={lastDownload.totalMachines} />
              <StatCard
                label="Berhasil"
                value={lastDownload.successCount}
                className="text-green-600"
              />
              <StatCard
                label="Gagal"
                value={lastDownload.failedCount}
                className="text-red-600"
              />
              <StatCard label="Total Log" value={lastDownload.totalLogs} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!downloading && !summary && !lastDownload && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Belum ada riwayat download. Klik &quot;Mulai Download&quot; untuk
              mengunduh data absensi dari semua mesin.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getStatusBadge(p: MachineProgress) {
  switch (p.status) {
    case "processing":
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
          Downloading...
        </span>
      );
    case "success":
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          ✓ {p.logsCount ?? 0} log
        </span>
      );
    case "failed":
      return (
        <span
          className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
          title={p.error}
        >
          ✗ Gagal
        </span>
      );
  }
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${className ?? ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
