import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// GET: 自分の生成履歴（直近）
export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "10");

  const logs = await prisma.auditLog.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      userQuestion: true,
      dbType: true,
      generatedSql: true,
      error: true,
    },
  });

  return NextResponse.json(logs);
}
