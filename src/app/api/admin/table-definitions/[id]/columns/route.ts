import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST: カラム追加
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id: tableId } = await params;
  const body = await req.json();
  const { columnName, columnNameJa, dataType, keyType, nullable, defaultValue, constants, description } = body;

  if (!columnName || !dataType) {
    return NextResponse.json(
      { error: "columnName と dataType は必須です" },
      { status: 400 }
    );
  }

  const maxSort = await prisma.columnDefinition.aggregate({
    where: { tableId },
    _max: { sortOrder: true },
  });

  const column = await prisma.columnDefinition.create({
    data: {
      tableId,
      sortOrder: (maxSort._max.sortOrder || 0) + 1,
      columnName,
      columnNameJa: columnNameJa || null,
      dataType,
      keyType: keyType || null,
      nullable: nullable ?? true,
      defaultValue: defaultValue || null,
      constants: constants || null,
      description: description || null,
    },
  });

  return NextResponse.json(column, { status: 201 });
}
