"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TenantRow {
  id: number;
  companyName: string;
  slug: string;
  adminEmail: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string;
  isActivated: boolean;
  createdAt: string;
}

export default function AdminTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/admin/tenants")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTenants(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredTenants =
    statusFilter === "all"
      ? tenants
      : tenants.filter((t) => t.subscriptionStatus === statusFilter);

  function getStatusBadge(status: string) {
    const colors: Record<string, string> = {
      trial: "bg-blue-100 text-blue-800",
      active: "bg-green-100 text-green-800",
      expiring_soon: "bg-yellow-100 text-yellow-800",
      expired: "bg-orange-100 text-orange-800",
      suspended: "bg-red-100 text-red-800",
      archived: "bg-gray-100 text-gray-800",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          colors[status] ?? "bg-gray-100 text-gray-800"
        }`}
      >
        {status}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Memuat data tenant...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Manajemen Tenant</h1>
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Perusahaan</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Activated</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTenants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Tidak ada tenant.
              </TableCell>
            </TableRow>
          ) : (
            filteredTenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">{tenant.companyName}</TableCell>
                <TableCell>{tenant.slug}</TableCell>
                <TableCell>{tenant.adminEmail}</TableCell>
                <TableCell>{getStatusBadge(tenant.subscriptionStatus)}</TableCell>
                <TableCell>
                  {new Date(tenant.subscriptionExpiresAt).toLocaleDateString("id-ID")}
                </TableCell>
                <TableCell>
                  {tenant.isActivated ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                  >
                    Detail
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
