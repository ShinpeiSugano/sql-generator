import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  requireAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth-helpers";
import { DbType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// GET: ゴールドSQL一覧取得
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return forbiddenResponse();
  }

  const { searchParams } = new URL(req.url);
  const dbType = searchParams.get("dbType") as DbType | null;

  const where: Record<string, unknown> = {};
  if (dbType && ["mysql", "bigquery", "postgres"].includes(dbType)) {
    where.dbType = dbType;
  }

  const goldSqls = await prisma.goldSql.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(goldSqls);
}

// POST: ゴールドSQL追加
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return forbiddenResponse();
  }

  const body = await req.json();
  const { title, description, dbType, sql, tags, isActive } = body;

  if (!title || !dbType || !sql) {
    return NextResponse.json(
      { error: "title, dbType, sql は必須です" },
      { status: 400 }
    );
  }

  if (!["mysql", "bigquery", "postgres"].includes(dbType)) {
    return NextResponse.json(
      { error: "無効なDB種別です" },
      { status: 400 }
    );
  }

  const goldSql = await prisma.goldSql.create({
    data: {
      title,
      description: description || null,
      dbType: dbType as DbType,
      sql,
      tags: tags || [],
      isActive: isActive ?? true,
    },
  });

  return NextResponse.json(goldSql, { status: 201 });
}
