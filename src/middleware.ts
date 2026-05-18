import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Middleware — Tenant Routing
 *
 * Runs in Edge Runtime. Extracts the tenant slug from the URL path and
 * injects it as a custom request header (`x-tenant-slug`) so that
 * downstream route handlers / layouts can resolve the tenant without
 * repeating path parsing logic.
 *
 * Heavy operations (DB lookup, subscription check) are intentionally
 * NOT performed here to keep the middleware lightweight and compatible
 * with the Edge Runtime (no Node.js APIs, no Prisma).
 *
 * Routing rules:
 *  - /admin/*            → Platform Owner (pass through)
 *  - /portal/*           → Customer Portal (pass through)
 *  - / or /register      → Customer Portal (pass through)
 *  - /api/portal/*       → Portal API (pass through)
 *  - /api/admin/*        → Admin API (pass through)
 *  - /_next/* /static/*  → Static assets (pass through)
 *  - Files with ext      → Static assets (pass through)
 *  - /api/[slug]/*       → Tenant API route (extract slug, set header)
 *  - /[slug]/*           → Tenant page route (extract slug, set header)
 *
 * @see Requirements 12.2, 12.3, 12.4
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // -------------------------------------------------------------------------
  // 1. Static assets — pass through immediately
  // -------------------------------------------------------------------------
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static")
  ) {
    return NextResponse.next();
  }

  // Files with extensions (e.g. .ico, .png, .js, .css) — pass through
  const lastSegment = pathname.split("/").pop() ?? "";
  if (lastSegment.includes(".")) {
    return NextResponse.next();
  }

  // -------------------------------------------------------------------------
  // 2. Platform Owner admin routes — pass through
  // -------------------------------------------------------------------------
  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // -------------------------------------------------------------------------
  // 3. Customer Portal routes — pass through
  // -------------------------------------------------------------------------
  if (
    pathname.startsWith("/portal") ||
    pathname === "/" ||
    pathname === "/register"
  ) {
    return NextResponse.next();
  }

  // -------------------------------------------------------------------------
  // 4. API routes for portal and admin — pass through
  // -------------------------------------------------------------------------
  if (
    pathname.startsWith("/api/portal") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/health")
  ) {
    return NextResponse.next();
  }

  // -------------------------------------------------------------------------
  // 5. Tenant API routes — /api/[slug]/...
  // -------------------------------------------------------------------------
  if (pathname.startsWith("/api/")) {
    // Path: /api/{slug}/...
    const segments = pathname.split("/").filter(Boolean);
    // segments[0] = "api", segments[1] = slug
    const slug = segments[1];

    if (slug) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-tenant-slug", slug);

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }

    // No slug found in API path — pass through
    return NextResponse.next();
  }

  // -------------------------------------------------------------------------
  // 6. Tenant page routes — /[slug]/...
  // -------------------------------------------------------------------------
  const segments = pathname.split("/").filter(Boolean);
  const slug = segments[0];

  if (slug) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-tenant-slug", slug);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Fallback — pass through
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
