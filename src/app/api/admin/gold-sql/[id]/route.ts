import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";
import { DbType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const dynamicParams = true;

// GET: ゴールドSQL詳細
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  const goldSql = await prisma.goldSql.findUnique({ where: { id } });
  if (!goldSql) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  return NextResponse.json(goldSql);
}

// PUT: ゴールドSQL更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  const body = await req.json();
  const { title, description, dbType, sql, tags, isActive } = body;

  const goldSql = await prisma.goldSql.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(dbType !== undefined && { dbType: dbType as DbType }),
      ...(sql !== undefined && { sql }),
      ...(tags !== undefined && { tags }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json(goldSql);
}

// DELETE: ゴールドSQL削除
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  await prisma.goldSql.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
