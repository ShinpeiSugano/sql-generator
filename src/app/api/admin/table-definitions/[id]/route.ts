import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET: テーブル定義詳細（カラム含む）
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  const table = await prisma.tableDefinition.findUnique({
    where: { id },
    include: { columns: { orderBy: { sortOrder: "asc" } } },
  });

  if (!table) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  return NextResponse.json(table);
}

// PUT: テーブル定義更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  const body = await req.json();
  const { tableName, tableNameJa, description, isActive } = body;

  const table = await prisma.tableDefinition.update({
    where: { id },
    data: {
      ...(tableName !== undefined && { tableName }),
      ...(tableNameJa !== undefined && { tableNameJa }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json(table);
}

// DELETE: テーブル定義削除（カラムもCascade削除）
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  await prisma.tableDefinition.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
