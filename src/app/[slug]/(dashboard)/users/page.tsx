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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface User {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

type DialogMode = "create" | "edit" | "delete" | null;

export default function UsersPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dialog state
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form state
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("HRD");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`/api/${slug}/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? data);
      } else {
        setError("Gagal memuat data pengguna.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function openCreate() {
    setFormUsername("");
    setFormPassword("");
    setFormRole("HRD");
    setFormError("");
    setSelectedUser(null);
    setDialogMode("create");
  }

  function openEdit(user: User) {
    setFormUsername(user.username);
    setFormPassword("");
    setFormRole(user.role);
    setFormError("");
    setSelectedUser(user);
    setDialogMode("edit");
  }

  function openDelete(user: User) {
    setSelectedUser(user);
    setDialogMode("delete");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedUser(null);
    setFormError("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    try {
      const res = await fetch(`/api/${slug}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formUsername,
          password: formPassword,
          role: formRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error?.message || "Gagal membuat pengguna.");
        return;
      }

      closeDialog();
      await fetchUsers();
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError("");
    setFormLoading(true);

    try {
      const body: Record<string, string> = { role: formRole };
      if (formPassword) {
        body.password = formPassword;
      }

      const res = await fetch(`/api/${slug}/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error?.message || "Gagal mengubah pengguna.");
        return;
      }

      closeDialog();
      await fetchUsers();
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedUser) return;
    setFormLoading(true);

    try {
      const res = await fetch(`/api/${slug}/users/${selectedUser.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error?.message || "Gagal menghapus pengguna.");
        return;
      }

      closeDialog();
      await fetchUsers();
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Memuat data pengguna...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Manajemen Pengguna</h1>
        <Button onClick={openCreate}>Tambah User</Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Belum ada pengguna.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>
                  {new Date(user.createdAt).toLocaleDateString("id-ID")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => openDelete(user)}
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
              {dialogMode === "create" ? "Tambah User Baru" : "Edit User"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? "Isi form di bawah untuk menambahkan pengguna baru."
                : "Ubah password atau role pengguna."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={dialogMode === "create" ? handleCreate : handleEdit}
            className="flex flex-col gap-4"
          >
            {dialogMode === "create" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="form-username">Username</Label>
                <Input
                  id="form-username"
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
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
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={(value) => { if (value) setFormRole(value); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Superadmin">Superadmin</SelectItem>
                  <SelectItem value="HRD">HRD</SelectItem>
                  <SelectItem value="Resepsionis">Resepsionis</SelectItem>
                </SelectContent>
              </Select>
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
            <DialogTitle>Hapus User</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus user &quot;{selectedUser?.username}&quot;?
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
