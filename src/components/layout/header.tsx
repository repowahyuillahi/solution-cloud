"use client";

import Image from "next/image";

interface HeaderProps {
  companyName?: string;
  logoUrl?: string | null;
  username?: string;
  subscriptionWarning?: boolean;
  daysRemaining?: number;
}

export function Header({
  companyName,
  logoUrl,
  username,
  subscriptionWarning,
  daysRemaining,
}: HeaderProps) {
  return (
    <header className="border-b bg-background">
      {/* Subscription warning banner */}
      {subscriptionWarning && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center text-sm text-yellow-800">
          ⚠️ Langganan Anda akan berakhir dalam {daysRemaining} hari. Perpanjang
          sekarang untuk menghindari gangguan layanan.
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <Image
              src={logoUrl}
              alt={companyName ?? "Logo"}
              width={32}
              height={32}
              className="h-8 w-8 rounded object-contain"
              unoptimized
            />
          )}
          {companyName && (
            <span className="text-sm font-medium">{companyName}</span>
          )}
        </div>
        {username && (
          <span className="text-xs text-muted-foreground">{username}</span>
        )}
      </div>
    </header>
  );
}
