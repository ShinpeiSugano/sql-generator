import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

// DELETE: タグ削除
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  await prisma.tag.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
