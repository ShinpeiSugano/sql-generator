import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PUT: フィードバック編集（管理者）
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  const body = await req.json();
  const { rating, correctedSql, comment } = body;

  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  const updated = await prisma.feedback.update({
    where: { id },
    data: {
      ...(rating !== undefined && { rating }),
      ...(correctedSql !== undefined && { correctedSql }),
      ...(comment !== undefined && { comment }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE: フィードバック削除（管理者）
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  await prisma.feedback.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
