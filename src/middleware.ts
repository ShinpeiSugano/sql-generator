import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  // ✅ Prisma / Auth を middleware(Edge) で動かさない
  // 認証チェックは各ページ(Server Component) or API(Route Handler)側で行う
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/generate/:path*",
    "/history/:path*",
    "/admin/:path*",
    "/api/generate/:path*",
    "/api/admin/:path*",
    "/api/audit/:path*",
    "/api/history/:path*",
  ],
};
