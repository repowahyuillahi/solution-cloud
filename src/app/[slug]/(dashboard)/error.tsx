"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <h2 className="text-lg font-semibold">Halaman Tidak Dapat Dimuat</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Terjadi kesalahan saat memuat halaman ini. Silakan coba lagi.
      </p>
      <Button onClick={reset}>Coba Lagi</Button>
    </div>
  );
}
