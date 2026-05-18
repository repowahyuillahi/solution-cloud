"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Machine {
  id: number;
  kodeDealer: string;
  namaDealer: string;
  serialNumber: string;
  connectionStatus: string;
  lastDownloadAt: string | null;
}

type DialogMode = "create" | "edit" | "delete" | null;

export default function MachinesPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dialog state
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  // Form state
  const [formKodeDealer, setFormKodeDealer] = useState("");
  const [formNamaDealer, setFormNamaDealer] = useState("");
  const [formSerialNumber, setFormSerialNumber] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const fetchMachines = useCallback(async () => {
    try {
      const res = await fetch(`/api/${slug}/machines`);
      if (res.ok) {
        const data = await res.json();
        setMachines(Array.isArray(data) ? data : data.machines ?? []);
      } else {
        setError("Gagal memuat data mesin.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  function openCreate() {
    setFormKodeDealer("");
    setFormNamaDealer("");
    setFormSerialNumber("");
    setFormPassword("");
    setFormError("");
    setSelectedMachine(null);
    setDialogMode("create");
  }

  function openEdit(machine: Machine) {
    setFormKodeDealer(machine.kodeDealer);
    setFormNamaDealer(machine.namaDealer);
    setFormSerialNumber(machine.serialNumber);
    setFormPassword("");
    setFormError("");
    setSelectedMachine(machine);
    setDialogMode("edit");
  }

  function openDelete(machine: Machine) {
    setSelectedMachine(machine);
    setFormError("");
    setDialogMode("delete");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedMachine(null);
    setFormError("");
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "connected":
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Connected
          </span>
        );
      case "disconnected":
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            Disconnected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
            Unknown
          </span>
        );
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      const res = await fetch(`/api/${slug}/machines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kodeDealer: formKodeDealer,
          namaDealer: formNamaDealer,
          serialNumber: formSerialNumber,
          password: formPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.message || "Gagal menambahkan mesin.");
        return;
      }

      closeDialog();
      await fetchMachines();
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMachine) return;
    setFormError("");
    setFormLoading(true);

    try {
      const body: Record<string, string> = {
        kodeDealer: formKodeDealer,
        namaDealer: formNamaDealer,
      };
      if (formPassword) {
        body.password = formPassword;
      }

      const res = await fetch(`/api/${slug}/machines/${selectedMachine.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.message || "Gagal mengubah mesin.");
        return;
      }

      closeDialog();
      await fetchMachines();
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedMachine) return;
    setFormLoading(true);

    try {
      const res = await fetch(`/api/${slug}/machines/${selectedMachine.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.message || "Gagal menghapus mesin.");
        return;
      }

      closeDialog();
      await fetchMachines();
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Memuat data mesin...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Manajemen Mesin</h1>
        <Button onClick={openCreate}>Tambah Mesin</Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kode Dealer</TableHead>
            <TableHead>Nama Dealer</TableHead>
            <TableHead>Serial Number</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Download</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {machines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Belum ada mesin terdaftar.
              </TableCell>
            </TableRow>
          ) : (
            machines.map((machine) => (
              <TableRow key={machine.id}>
                <TableCell>{machine.kodeDealer}</TableCell>
                <TableCell>{machine.namaDealer}</TableCell>
                <TableCell>{machine.serialNumber}</TableCell>
                <TableCell>{getStatusBadge(machine.connectionStatus)}</TableCell>
                <TableCell>
                  {machine.lastDownloadAt
                    ? new Date(machine.lastDownloadAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(machine)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => openDelete(machine)}
                    >
                      Hapus
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onOpenChange={(open) => { if (!open) closeDialog(); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Tambah Mesin Baru" : "Edit Mesin"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? "Isi form di bawah untuk menambahkan mesin baru."
                : "Ubah data mesin."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={dialogMode === "create" ? handleCreate : handleEdit}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="form-kode-dealer">Kode Dealer</Label>
              <Input
                id="form-kode-dealer"
                type="text"
                value={formKodeDealer}
                onChange={(e) => setFormKodeDealer(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="form-nama-dealer">Nama Dealer</Label>
              <Input
                id="form-nama-dealer"
                type="text"
                value={formNamaDealer}
                onChange={(e) => setFormNamaDealer(e.target.value)}
                required
              />
            </div>
            {dialogMode === "create" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="form-serial-number">Serial Number</Label>
                <Input
                  id="form-serial-number"
                  type="text"
                  value={formSerialNumber}
                  onChange={(e) => setFormSerialNumber(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="form-password">
                {dialogMode === "create" ? "Password" : "Password Baru (kosongkan jika tidak diubah)"}
              </Label>
              <Input
                id="form-password"
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                required={dialogMode === "create"}
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Memproses..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={dialogMode === "delete"}
        onOpenChange={(open) => { if (!open) closeDialog(); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Mesin</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus mesin &quot;{selectedMachine?.namaDealer}&quot; ({selectedMachine?.serialNumber})?
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={formLoading}
            >
              {formLoading ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
