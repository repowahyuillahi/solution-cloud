import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer Portal — Web UI Absensi",
  description: "Portal pelanggan untuk registrasi, billing, dan manajemen lisensi",
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
