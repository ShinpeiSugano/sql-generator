import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return tags.split(",").map((t) => t.trim()).filter(Boolean);
  }
}

// GoldSqlの全レコードからタグ名を除去
async function removeTagFromGoldSqls(tagName: string) {
  const goldSqls = await prisma.goldSql.findMany({
    where: { tags: { not: null } },
    select: { id: true, tags: true },
  });

  for (const gs of goldSqls) {
    const tags = parseTags(gs.tags);
    if (tags.includes(tagName)) {
      const updated = tags.filter((t) => t !== tagName);
      await prisma.goldSql.update({
        where: { id: gs.id },
        data: { tags: updated.length > 0 ? JSON.stringify(updated) : null },
      });
    }
  }
}

// GoldSqlの全レコードでタグ名をリネーム
async function renameTagInGoldSqls(oldName: string, newName: string) {
  const goldSqls = await prisma.goldSql.findMany({
    where: { tags: { not: null } },
    select: { id: true, tags: true },
  });

  for (const gs of goldSqls) {
    const tags = parseTags(gs.tags);
    if (tags.includes(oldName)) {
      const updated = tags.map((t) => (t === oldName ? newName : t));
      await prisma.goldSql.update({
        where: { id: gs.id },
        data: { tags: JSON.stringify(updated) },
      });
    }
  }
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

  // 旧タグ名を取得
  const oldTag = await prisma.tag.findUnique({ where: { id } });
  if (!oldTag) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  const tag = await prisma.tag.update({
    where: { id },
    data: { name },
  });

  // GoldSqlのタグも連動リネーム
  await renameTagInGoldSqls(oldTag.name, name);

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

  // 削除前にタグ名を取得
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  // GoldSqlからもタグを除去
  await removeTagFromGoldSqls(tag.name);

  await prisma.tag.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
