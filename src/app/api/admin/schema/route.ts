import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";
import { DbType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// GET: スキーマドキュメント一覧
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { searchParams } = new URL(req.url);
  const dbType = searchParams.get("dbType") as DbType | null;

  const where: Record<string, unknown> = {};
  if (dbType && ["mysql", "bigquery", "postgres"].includes(dbType)) {
    where.dbType = dbType;
  }

  const schemas = await prisma.schemaDocument.findMany({
    where,
    orderBy: [{ dbType: "asc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(schemas);
}

// POST: スキーマドキュメント追加
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const body = await req.json();
  const { dbType, version, content, isActive } = body;

  if (!dbType || !version || !content) {
    return NextResponse.json(
      { error: "dbType, version, content は必須です" },
      { status: 400 }
    );
  }

  if (!["mysql", "bigquery", "postgres"].includes(dbType)) {
    return NextResponse.json(
      { error: "無効なDB種別です" },
      { status: 400 }
    );
  }

  // isActive=true にする場合、同じdbTypeの他のスキーマを非アクティブに
  if (isActive) {
    await prisma.schemaDocument.updateMany({
      where: { dbType: dbType as DbType, isActive: true },
      data: { isActive: false },
    });
  }

  const schema = await prisma.schemaDocument.create({
    data: {
      dbType: dbType as DbType,
      version,
      content,
      isActive: isActive ?? false,
    },
  });

  return NextResponse.json(schema, { status: 201 });
}
