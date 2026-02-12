import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET: タグ一覧
export async function GET() {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(tags);
}

// POST: タグ作成
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const body = await req.json();
  const name = (body.name as string)?.trim();

  if (!name) {
    return NextResponse.json(
      { error: "タグ名を入力してください" },
      { status: 400 }
    );
  }

  // 重複チェック（大文字小文字区別なし）
  const existing = await prisma.tag.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "同じ名前のタグが既に存在します" },
      { status: 409 }
    );
  }

  const tag = await prisma.tag.create({
    data: { name },
  });

  return NextResponse.json(tag, { status: 201 });
}
