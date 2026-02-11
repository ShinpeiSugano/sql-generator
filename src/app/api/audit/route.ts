import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  unauthorizedResponse,
} from "@/lib/auth-helpers";
import { DbType, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// GET: 監査ログ一覧
// admin: 全件（検索/フィルタ対応）
// member: 自分のログのみ
export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const email = searchParams.get("email");
  const dbType = searchParams.get("dbType") as DbType | null;
  const keyword = searchParams.get("keyword");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: Prisma.AuditLogWhereInput = {};

  // memberは自分のログのみ
  if (session.user.role !== "admin") {
    where.userId = session.user.id;
  } else {
    // adminのフィルタ
    if (email) {
      where.userEmail = { contains: email };
    }
  }

  if (dbType && ["mysql", "bigquery", "postgres"].includes(dbType)) {
    where.dbType = dbType;
  }

  if (keyword) {
    where.OR = [
      { userQuestion: { contains: keyword } },
      { generatedSql: { contains: keyword } },
    ];
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      (where.createdAt as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    }
    if (dateTo) {
      (where.createdAt as Prisma.DateTimeFilter).lte = new Date(
        dateTo + "T23:59:59.999Z"
      );
    }
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { name: true, image: true } },
      },
    }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}
