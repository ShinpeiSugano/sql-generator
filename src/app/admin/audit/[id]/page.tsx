"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/navigation";
import Link from "next/link";

interface AuditLogDetail {
  id: string;
  createdAt: string;
  userId: string;
  userEmail: string;
  role: string;
  userQuestion: string;
  dbType: string;
  goldSqlIds: string[];
  schemaDocumentId: string | null;
  schemaVersion: string | null;
  promptVersion: string;
  modelMetadata: { model: string; temperature: number } | null;
  generatedSql: string | null;
  error: string | null;
  user: { name: string; email: string; image: string | null };
  schemaDocument: { id: string; dbType: string; version: string } | null;
  goldSqls: { id: string; title: string }[];
}

export default function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [log, setLog] = useState<AuditLogDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session && session.user.role !== "admin") {
      router.push("/generate");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session && session.user.role === "admin" && id) {
      fetchDetail();
    }
  }, [session, id]);

  const fetchDetail = async () => {
    try {
      const res = await fetch(`/api/audit/${id}`);
      if (res.ok) {
        const data = await res.json();
        setLog(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!session || session.user.role !== "admin" || !log) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/admin/audit"
            className="text-primary hover:text-primary-hover text-sm"
          >
            ← 監査ログ一覧に戻る
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          監査ログ詳細
        </h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          {/* 基本情報 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500">ユーザー</label>
              <p className="mt-1 text-sm text-gray-900 font-medium">
                {log.user?.name || log.userEmail}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500">メール</label>
              <p className="mt-1 text-sm text-gray-900">{log.userEmail}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">ロール</label>
              <p className="mt-1 text-sm text-gray-900">{log.role}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">日時</label>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(log.createdAt).toLocaleString("ja-JP")}
              </p>
            </div>
          </div>

          {/* 入力文 */}
          <div>
            <label className="text-xs text-gray-500">入力文（ユーザーの質問）</label>
            <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-4 rounded-lg">
              {log.userQuestion}
            </p>
          </div>

          {/* 生成SQL */}
          {log.generatedSql && (
            <div>
              <label className="text-xs text-gray-500">生成SQL</label>
              <pre className="mt-1 bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
                {log.generatedSql}
              </pre>
            </div>
          )}

          {/* エラー */}
          {log.error && (
            <div>
              <label className="text-xs text-gray-500">エラー</label>
              <p className="mt-1 text-sm text-red-600 bg-red-50 p-4 rounded-lg">
                {log.error}
              </p>
            </div>
          )}

          {/* メタ情報 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
            <div>
              <label className="text-xs text-gray-500">DB種別</label>
              <p className="mt-1 text-sm text-gray-900">{log.dbType}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">スキーマバージョン</label>
              <p className="mt-1 text-sm text-gray-900">
                {log.schemaVersion || "N/A"}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500">プロンプトバージョン</label>
              <p className="mt-1 text-sm text-gray-900">{log.promptVersion}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">モデル</label>
              <p className="mt-1 text-sm text-gray-900">
                {log.modelMetadata?.model || "N/A"}
              </p>
            </div>
          </div>

          {/* 参照ゴールドSQL */}
          {log.goldSqls && log.goldSqls.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <label className="text-xs text-gray-500">参照ゴールドSQL</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {log.goldSqls.map((g) => (
                  <span
                    key={g.id}
                    className="px-3 py-1 bg-amber-50 text-amber-700 text-sm rounded-md border border-amber-200"
                  >
                    {g.title} ({g.id.slice(0, 8)})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 使用スキーマ */}
          {log.schemaDocument && (
            <div className="pt-4 border-t border-gray-100">
              <label className="text-xs text-gray-500">使用スキーマドキュメント</label>
              <p className="mt-1 text-sm text-gray-900">
                {log.schemaDocument.dbType} - v{log.schemaDocument.version} (
                {log.schemaDocument.id.slice(0, 8)})
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
