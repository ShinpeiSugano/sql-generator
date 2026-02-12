import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

// PUT: タグ名変更
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  const body = await req.json();
  const name = (body.name as string)?.trim();

  if (!name) {
    return NextResponse.json(
      { error: "タグ名を入力してください" },
      { status: 400 }
    );
  }

  const existing = await prisma.tag.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "同じ名前のタグが既に存在します" },
      { status: 409 }
    );
  }

  const tag = await prisma.tag.update({
    where: { id },
    data: { name },
  });

  return NextResponse.json(tag);
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
