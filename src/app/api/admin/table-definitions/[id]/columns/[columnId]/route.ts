import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PUT: カラム更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { columnId } = await params;
  const body = await req.json();

  const column = await prisma.columnDefinition.update({
    where: { id: columnId },
    data: {
      ...(body.columnName !== undefined && { columnName: body.columnName }),
      ...(body.columnNameJa !== undefined && { columnNameJa: body.columnNameJa }),
      ...(body.dataType !== undefined && { dataType: body.dataType }),
      ...(body.keyType !== undefined && { keyType: body.keyType }),
      ...(body.nullable !== undefined && { nullable: body.nullable }),
      ...(body.defaultValue !== undefined && { defaultValue: body.defaultValue }),
      ...(body.constants !== undefined && { constants: body.constants }),
      ...(body.description !== undefined && { description: body.description }),
    },
  });

  return NextResponse.json(column);
}

// DELETE: カラム削除
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; columnId: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { columnId } = await params;
  await prisma.columnDefinition.delete({ where: { id: columnId } });

  return NextResponse.json({ success: true });
}
