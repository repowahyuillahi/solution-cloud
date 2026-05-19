"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin panel error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <h2 className="text-lg font-semibold">Terjadi Kesalahan</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Tidak dapat memuat halaman admin. Coba muat ulang.
      </p>
      <Button onClick={reset}>Coba Lagi</Button>
    </div>
  );
}
