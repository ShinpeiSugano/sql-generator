import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";
import { DbType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

// GET: スキーマドキュメント詳細
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  const schema = await prisma.schemaDocument.findUnique({ where: { id } });
  if (!schema) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  return NextResponse.json(schema);
}

// PUT: スキーマドキュメント更新
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  const body = await req.json();
  const { dbType, version, content, isActive } = body;

  // isActive=true にする場合、同じdbTypeの他のスキーマを非アクティブに
  if (isActive) {
    const current = await prisma.schemaDocument.findUnique({ where: { id } });
    if (current) {
      await prisma.schemaDocument.updateMany({
        where: {
          dbType: dbType ? (dbType as DbType) : current.dbType,
          isActive: true,
          NOT: { id },
        },
        data: { isActive: false },
      });
    }
  }

  const schema = await prisma.schemaDocument.update({
    where: { id },
    data: {
      ...(dbType !== undefined && { dbType: dbType as DbType }),
      ...(version !== undefined && { version }),
      ...(content !== undefined && { content }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json(schema);
}

// DELETE: スキーマドキュメント削除
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { id } = await params;
  await prisma.schemaDocument.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
