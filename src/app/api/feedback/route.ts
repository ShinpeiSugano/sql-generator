import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST: フィードバック送信（一般ユーザー）
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return unauthorizedResponse();

  const body = await req.json();
  const { auditLogId, rating, correctedSql, comment } = body;

  if (!auditLogId || !rating) {
    return NextResponse.json(
      { error: "auditLogId と rating は必須です" },
      { status: 400 }
    );
  }

  if (!["good", "bad"].includes(rating)) {
    return NextResponse.json(
      { error: "rating は good または bad です" },
      { status: 400 }
    );
  }

  if (rating === "bad" && !correctedSql?.trim()) {
    return NextResponse.json(
      { error: "badの場合は正しいSQLを入力してください" },
      { status: 400 }
    );
  }

  // 該当のauditLogが自分のものか確認
  const auditLog = await prisma.auditLog.findFirst({
    where: { id: auditLogId, userId: session.user.id },
  });

  if (!auditLog) {
    return NextResponse.json(
      { error: "該当の生成履歴が見つかりません" },
      { status: 404 }
    );
  }

  // 既存フィードバックがあれば更新、なければ作成
  const existing = await prisma.feedback.findFirst({
    where: { auditLogId, userId: session.user.id },
  });

  let feedback;
  if (existing) {
    feedback = await prisma.feedback.update({
      where: { id: existing.id },
      data: {
        rating,
        correctedSql: rating === "bad" ? correctedSql : null,
        comment: comment || null,
      },
    });
  } else {
    feedback = await prisma.feedback.create({
      data: {
        auditLogId,
        userId: session.user.id,
        userEmail: session.user.email || "",
        rating,
        correctedSql: rating === "bad" ? correctedSql : null,
        comment: comment || null,
      },
    });
  }

  return NextResponse.json(feedback, { status: existing ? 200 : 201 });
}
