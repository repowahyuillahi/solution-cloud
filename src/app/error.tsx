"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Terjadi Kesalahan</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        Sistem mengalami kesalahan yang tidak terduga. Silakan coba muat ulang
        halaman atau hubungi administrator jika masalah berlanjut.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset}>Coba Lagi</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Kembali ke Beranda
        </Button>
      </div>
    </div>
  );
}
