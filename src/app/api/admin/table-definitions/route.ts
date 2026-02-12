import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET: テーブル定義一覧
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { searchParams } = new URL(req.url);
  const dbType = searchParams.get("dbType");
  const includeColumns = searchParams.get("includeColumns") === "true";

  const where: Record<string, unknown> = {};
  if (dbType && ["mysql", "bigquery", "postgres"].includes(dbType)) {
    where.dbType = dbType;
  }

  const tables = await prisma.tableDefinition.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    include: includeColumns ? { columns: { orderBy: { sortOrder: "asc" } } } : undefined,
  });

  return NextResponse.json(tables);
}

// POST: テーブル定義を手動追加
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const body = await req.json();
  const { dbType, tableName, tableNameJa, description } = body;

  if (!dbType || !tableName) {
    return NextResponse.json(
      { error: "dbType と tableName は必須です" },
      { status: 400 }
    );
  }

  const existing = await prisma.tableDefinition.findUnique({
    where: { dbType_tableName: { dbType, tableName } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "同じDB種別・テーブル名が既に存在します" },
      { status: 409 }
    );
  }

  const maxSort = await prisma.tableDefinition.aggregate({
    where: { dbType },
    _max: { sortOrder: true },
  });

  const table = await prisma.tableDefinition.create({
    data: {
      dbType,
      tableName,
      tableNameJa: tableNameJa || null,
      description: description || null,
      sortOrder: (maxSort._max.sortOrder || 0) + 1,
    },
  });

  return NextResponse.json(table, { status: 201 });
}
