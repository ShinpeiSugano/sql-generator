import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET: フィードバック一覧（管理者）
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return forbiddenResponse();

  const { searchParams } = new URL(req.url);
  const rating = searchParams.get("rating");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (rating && ["good", "bad"].includes(rating)) {
    where.rating = rating;
  }

  const [feedbacks, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        auditLog: {
          select: {
            userQuestion: true,
            dbType: true,
            generatedSql: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.feedback.count({ where }),
  ]);

  return NextResponse.json({ feedbacks, total, page, limit });
}
