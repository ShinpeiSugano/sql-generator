import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

// GET: 監査ログ詳細
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const log = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, image: true } },
      schemaDocument: {
        select: { id: true, dbType: true, version: true },
      },
    },
  });

  if (!log) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  // memberは自分のログのみ閲覧可
  if (session.user.role !== "admin" && log.userId !== session.user.id) {
    return forbiddenResponse("このログを閲覧する権限がありません");
  }

  // ゴールドSQL情報を取得
  let goldSqls: { id: string; title: string }[] = [];
  if (log.goldSqlIds && Array.isArray(log.goldSqlIds) && log.goldSqlIds.length > 0) {
    goldSqls = await prisma.goldSql.findMany({
      where: { id: { in: log.goldSqlIds as string[] } },
      select: { id: true, title: true },
    });
  }

  return NextResponse.json({
    ...log,
    goldSqls,
  });
}
