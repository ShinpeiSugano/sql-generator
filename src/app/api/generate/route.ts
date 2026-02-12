import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth-helpers";
import { generateSql, GoldSqlExample } from "@/lib/llm";
import { rateLimit } from "@/lib/rate-limit";
import { DbType } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    // 認証チェック
    const session = await requireAuth();
    if (!session) {
      return unauthorizedResponse();
    }

    // Rate Limit チェック（1分あたり10回）
    const rl = rateLimit(`generate:${session.user.id}`, 10, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "リクエスト回数の上限に達しました。しばらく待ってから再試行してください。" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { question, dbType } = body as {
      question: string;
      dbType: string;
    };

    // バリデーション
    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: "質問を入力してください" },
        { status: 400 }
      );
    }

    if (!["mysql", "bigquery", "postgres"].includes(dbType)) {
      return NextResponse.json(
        { error: "無効なDB種別です" },
        { status: 400 }
      );
    }

    const dbTypeEnum = dbType as DbType;

    // 1. アクティブなスキーマドキュメントを取得
    const schemaDoc = await prisma.schemaDocument.findFirst({
      where: { dbType, isActive: true },
    });

    // 2. ゴールドSQLを検索（全文検索 + dbType）
    const goldSqls = await prisma.goldSql.findMany({
      where: {
        dbType: dbTypeEnum,
        isActive: true,
        OR: [
          { title: { contains: question } },
          { description: { contains: question } },
        ],
      },
      take: 3,
      orderBy: { updatedAt: "desc" },
    });

    // マッチしない場合は最新のゴールドSQLを取得
    const finalGoldSqls =
      goldSqls.length > 0
        ? goldSqls
        : await prisma.goldSql.findMany({
            where: { dbType: dbTypeEnum, isActive: true },
            take: 3,
            orderBy: { updatedAt: "desc" },
          });

    const goldSqlExamples: GoldSqlExample[] = finalGoldSqls.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      sql: g.sql,
      tags: Array.isArray(g.tags) ? (g.tags as string[]) : [],
    }));

    // 3. LLMでSQL生成
    let result;
    let errorMessage: string | null = null;

    try {
      result = await generateSql({
        userQuestion: question,
        dbType,
        schemaText: schemaDoc?.content || "",
        goldSqlExamples,
      });
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "SQL生成に失敗しました";
    }

    // 4. 監査ログを保存（成功・失敗どちらも）
    const auditLog = await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email || "",
        role: session.user.role || "member",
        userQuestion: question,
        dbType,
        goldSqlIds: JSON.stringify(finalGoldSqls.map((g) => g.id)),
        schemaDocumentId: schemaDoc?.id || null,
        schemaVersion: schemaDoc?.version || null,
        promptVersion: result?.promptVersion || "v1.0",
        modelMetadata: result
          ? JSON.stringify({ model: result.model, temperature: result.temperature })
          : null,
        generatedSql: result?.sql || null,
        error: errorMessage,
      },
    });

    if (errorMessage) {
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    return NextResponse.json({
      sql: result!.sql,
      auditLogId: auditLog.id,
      goldSqlsUsed: finalGoldSqls.map((g) => ({
        id: g.id,
        title: g.title,
      })),
      schemaVersion: schemaDoc?.version || null,
    });
  } catch (error) {
    console.error("SQL生成エラー:", error);
    return NextResponse.json(
      { error: "内部エラーが発生しました" },
      { status: 500 }
    );
  }
}
