"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Portal error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">Terjadi Kesalahan</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Tidak dapat memuat halaman portal. Coba muat ulang atau kembali ke
        beranda.
      </p>
      <Button onClick={reset}>Coba Lagi</Button>
    </div>
  );
}
