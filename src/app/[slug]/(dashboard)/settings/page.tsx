"use client";

import { useEffect, useState, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface BranchSchedule {
  id: number;
  kodeDealer: string;
  namaDealer: string;
  jamMasuk: string;
  toleranceMinutes: number;
  workDays: string;
}

const DAY_LABELS: Record<number, string> = {
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
  7: "Minggu",
};

export default function SettingsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [schedules, setSchedules] = useState<BranchSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit dialog state
  const [editSchedule, setEditSchedule] = useState<BranchSchedule | null>(null);
  const [formJamMasuk, setFormJamMasuk] = useState("");
  const [formTolerance, setFormTolerance] = useState(5);
  const [formWorkDays, setFormWorkDays] = useState<number[]>([]);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch(`/api/${slug}/settings/schedule`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      } else {
        setError("Gagal memuat jadwal.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  function openEdit(schedule: BranchSchedule) {
    setEditSchedule(schedule);
    setFormJamMasuk(schedule.jamMasuk);
    setFormTolerance(schedule.toleranceMinutes);
    setFormWorkDays(
      schedule.workDays
        .split(",")
        .map((d) => parseInt(d.trim(), 10))
        .filter((n) => !isNaN(n))
    );
    setFormError("");
  }

  function closeEdit() {
    setEditSchedule(null);
    setFormError("");
  }

  function toggleDay(day: number) {
    setFormWorkDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editSchedule) return;
    setFormError("");
    setFormLoading(true);

    try {
      const res = await fetch(
        `/api/${slug}/settings/schedule/${editSchedule.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jamMasuk: formJamMasuk,
            toleranceMinutes: formTolerance,
            workDays: formWorkDays.join(","),
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error?.message || "Gagal menyimpan jadwal.");
        return;
      }

      closeEdit();
      await fetchSchedules();
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  }

  function formatWorkDays(workDays: string): string {
    return workDays
      .split(",")
      .map((d) => DAY_LABELS[parseInt(d.trim(), 10)] ?? d)
      .join(", ");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Memuat jadwal...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Pengaturan Jadwal Cabang</h1>
      <p className="text-sm text-muted-foreground">
        Atur jam masuk, toleransi keterlambatan, dan hari kerja untuk setiap
        cabang.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Belum ada cabang terdaftar. Tambahkan mesin terlebih dahulu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {schedule.namaDealer}
                    </CardTitle>
                    <CardDescription>{schedule.kodeDealer}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(schedule)}
                  >
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Jam Masuk</p>
                    <p className="font-medium">{schedule.jamMasuk}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Toleransi</p>
                    <p className="font-medium">
                      {schedule.toleranceMinutes} menit
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Hari Kerja</p>
                    <p className="font-medium">
                      {formatWorkDays(schedule.workDays)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editSchedule} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Jadwal - {editSchedule?.namaDealer}</DialogTitle>
            <DialogDescription>
              Ubah pengaturan jadwal untuk cabang ini.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jam-masuk">Jam Masuk</Label>
              <Input
                id="jam-masuk"
                type="time"
                value={formJamMasuk}
                onChange={(e) => setFormJamMasuk(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tolerance">Toleransi (menit)</Label>
              <Input
                id="tolerance"
                type="number"
                min={0}
                max={60}
                value={formTolerance}
                onChange={(e) => setFormTolerance(parseInt(e.target.value, 10) || 0)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Hari Kerja</Label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                      formWorkDays.includes(day)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-input hover:bg-muted"
                    }`}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
            </div>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
