"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BranchAssignment {
  kodeDealer: string;
}

interface Employee {
  id: number;
  kodeKaryawan: string;
  namaKaryawan: string;
  branchAssignments: BranchAssignment[];
}

interface Machine {
  id: number;
  kodeDealer: string;
  namaDealer: string;
}

interface ImportResult {
  total: number;
  success: number;
  skipped: number;
  failed: number;
}

type DialogMode = "create" | "edit" | "delete" | null;

export default function EmployeesPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter state
  const [filterBranch, setFilterBranch] = useState("");

  // Dialog state
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Form state
  const [formKodeKaryawan, setFormKodeKaryawan] = useState("");
  const [formNamaKaryawan, setFormNamaKaryawan] = useState("");
  const [formBranches, setFormBranches] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBranch, setImportBranch] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMachines = useCallback(async () => {
    try {
      const res = await fetch(`/api/${slug}/machines`);
      if (res.ok) {
        const data = await res.json();
        setMachines(Array.isArray(data) ? data : data.machines ?? []);
      }
    } catch {
      // silently fail for machines list
    }
  }, [slug]);

  const fetchEmployees = useCallback(async () => {
    try {
      const url = filterBranch
        ? `/api/${slug}/employees?kodeDealer=${encodeURIComponent(filterBranch)}`
        : `/api/${slug}/employees`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEmployees(Array.isArray(data) ? data : []);
      } else {
        setError("Gagal memuat data karyawan.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }, [slug, filterBranch]);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  useEffect(() => {
    setLoading(true);
    fetchEmployees();
  }, [fetchEmployees]);

  function openCreate() {
    setFormKodeKaryawan("");
    setFormNamaKaryawan("");
    setFormBranches([]);
    setFormError("");
    setSelectedEmployee(null);
    setDialogMode("create");
  }

  function openEdit(employee: Employee) {
    setFormKodeKaryawan(employee.kodeKaryawan);
    setFormNamaKaryawan(employee.namaKaryawan);
    setFormBranches(employee.branchAssignments.map((b) => b.kodeDealer));
    setFormError("");
    setSelectedEmployee(employee);
    setDialogMode("edit");
  }

  function openDelete(employee: Employee) {
    setSelectedEmployee(employee);
    setFormError("");
    setDialogMode("delete");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedEmployee(null);
    setFormError("");
  }

  function toggleBranch(kodeDealer: string) {
    setFormBranches((prev) =>
      prev.includes(kodeDealer)
        ? prev.filter((b) => b !== kodeDealer)
        : [...prev, kodeDealer]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      const res = await fetch(`/api/${slug}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kodeKaryawan: formKodeKaryawan,
          namaKaryawan: formNamaKaryawan,
          branches: formBranches,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.message || "Gagal menambahkan karyawan.");
        return;
      }

      closeDialog();
      await fetchEmployees();
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployee) return;
    setFormError("");
    setFormLoading(true);

    try {
      const res = await fetch(`/api/${slug}/employees/${selectedEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namaKaryawan: formNamaKaryawan,
          branches: formBranches,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.message || "Gagal mengubah karyawan.");
        return;
      }

      closeDialog();
      await fetchEmployees();
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedEmployee) return;
    setFormLoading(true);

    try {
      const res = await fetch(`/api/${slug}/employees/${selectedEmployee.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.message || "Gagal menghapus karyawan.");
        return;
      }

      closeDialog();
      await fetchEmployees();
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleImport() {
    if (!importFile || !importBranch) return;
    setImportLoading(true);
    setImportError("");
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("kodeDealer", importBranch);

      const res = await fetch(`/api/${slug}/employees/import`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setImportError(data.message || "Gagal mengimpor data.");
        return;
      }

      const result = await res.json();
      setImportResult(result);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await fetchEmployees();
    } catch {
      setImportError("Terjadi kesalahan jaringan.");
    } finally {
      setImportLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Memuat data karyawan...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Manajemen Karyawan</h1>
        <Button onClick={openCreate}>Tambah Karyawan</Button>
      </div>

      {/* Branch Filter */}
      <div className="flex items-center gap-3">
        <Label>Filter Cabang:</Label>
        <Select value={filterBranch} onValueChange={(value) => setFilterBranch(value ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="Semua Cabang" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Semua Cabang</SelectItem>
            {machines.map((m) => (
              <SelectItem key={m.kodeDealer} value={m.kodeDealer}>
                {m.kodeDealer} - {m.namaDealer}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Employees Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kode Karyawan</TableHead>
            <TableHead>Nama Karyawan</TableHead>
            <TableHead>Cabang</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Belum ada karyawan terdaftar.
              </TableCell>
            </TableRow>
          ) : (
            employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>{employee.kodeKaryawan}</TableCell>
                <TableCell>{employee.namaKaryawan}</TableCell>
                <TableCell>
                  {employee.branchAssignments.length > 0
                    ? employee.branchAssignments.map((b) => b.kodeDealer).join(", ")
                    : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(employee)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => openDelete(employee)}
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

      {/* Excel Import Section */}
      <div className="rounded-lg border p-4 flex flex-col gap-4">
        <h2 className="text-lg font-medium">Import Karyawan dari Excel</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-file">File Excel (.xlsx)</Label>
            <Input
              id="import-file"
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Cabang Tujuan</Label>
            <Select value={importBranch} onValueChange={(value) => setImportBranch(value ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Cabang" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.kodeDealer} value={m.kodeDealer}>
                    {m.kodeDealer} - {m.namaDealer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleImport}
            disabled={importLoading || !importFile || !importBranch}
          >
            {importLoading ? "Mengimpor..." : "Import"}
          </Button>
        </div>
        {importError && <p className="text-sm text-destructive">{importError}</p>}
        {importResult && (
          <div className="rounded-md bg-muted p-3 text-sm">
            <p><strong>Hasil Import:</strong></p>
            <p>Total: {importResult.total}</p>
            <p>Berhasil: {importResult.success}</p>
            <p>Dilewati: {importResult.skipped}</p>
            <p>Gagal: {importResult.failed}</p>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogMode === "create" || dialogMode === "edit"}
        onOpenChange={(open) => { if (!open) closeDialog(); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Tambah Karyawan Baru" : "Edit Karyawan"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? "Isi form di bawah untuk menambahkan karyawan baru."
                : "Ubah data karyawan."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={dialogMode === "create" ? handleCreate : handleEdit}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="form-kode-karyawan">Kode Karyawan</Label>
              <Input
                id="form-kode-karyawan"
                type="text"
                value={formKodeKaryawan}
                onChange={(e) => setFormKodeKaryawan(e.target.value)}
                required
                disabled={dialogMode === "edit"}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="form-nama-karyawan">Nama Karyawan</Label>
              <Input
                id="form-nama-karyawan"
                type="text"
                value={formNamaKaryawan}
                onChange={(e) => setFormNamaKaryawan(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cabang (Branch)</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border p-2 flex flex-col gap-2">
                {machines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada cabang tersedia.</p>
                ) : (
                  machines.map((m) => (
                    <label key={m.kodeDealer} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formBranches.includes(m.kodeDealer)}
                        onChange={() => toggleBranch(m.kodeDealer)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      {m.kodeDealer} - {m.namaDealer}
                    </label>
                  ))
                )}
              </div>
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
            <DialogTitle>Hapus Karyawan</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus karyawan &quot;{selectedEmployee?.namaKaryawan}&quot; ({selectedEmployee?.kodeKaryawan})?
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
