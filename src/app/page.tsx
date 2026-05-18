// Customer Portal landing/login is implemented in Task 4.4 at src/app/(portal)/page.tsx.
// This root page exists only to keep the build green during initial scaffolding.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Web UI Absensi</h1>
      <p className="text-sm text-muted-foreground">
        Multi-tenant SaaS platform untuk manajemen absensi fingerprint.
      </p>
    </main>
  );
}
