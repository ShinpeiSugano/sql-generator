"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/navigation";

interface HistoryItem {
  id: string;
  createdAt: string;
  userQuestion: string;
  dbType: string;
  generatedSql: string | null;
  error: string | null;
}

interface GenerateResult {
  sql: string;
  auditLogId: string;
  goldSqlsUsed: { id: string; title: string }[];
  schemaVersion: string | null;
}

export default function GeneratePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [dbType, setDbType] = useState("mysql");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<"good" | "bad" | null>(null);
  const [correctedSql, setCorrectedSql] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchHistory();
    }
  }, [session]);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/history?limit=5");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {
      // ignore
    }
  };

  const handleGenerate = async () => {
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, dbType }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "エラーが発生しました");
      } else {
        setResult(data);
        fetchHistory();
        // フィードバックダイアログをリセットして開く
        setFeedbackRating(null);
        setCorrectedSql("");
        setFeedbackComment("");
        setFeedbackDone(false);
        setFeedbackOpen(true);
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (result?.sql) {
      await navigator.clipboard.writeText(result.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackRating || !result?.auditLogId) return;
    if (feedbackRating === "bad" && !correctedSql.trim()) return;

    setFeedbackSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditLogId: result.auditLogId,
          rating: feedbackRating,
          correctedSql: feedbackRating === "bad" ? correctedSql : null,
          comment: feedbackComment || null,
        }),
      });
      if (res.ok) {
        setFeedbackDone(true);
        setTimeout(() => {
          setFeedbackOpen(false);
        }, 1500);
      }
    } catch {
      // ignore
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* メインエリア */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                SQL生成
              </h2>

              {/* DB種別選択 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  DB種別
                </label>
                <div className="flex gap-3">
                  {[
                    { value: "mysql", label: "MySQL" },
                    { value: "bigquery", label: "BigQuery" },
                    { value: "postgres", label: "PostgreSQL" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDbType(opt.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        dbType === opt.value
                          ? "bg-primary text-white shadow-sm"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 質問入力 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  日本語で質問を入力
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="例: 2025年に登録した25歳以上のユーザーの平均LTVを教えて"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none text-gray-900 placeholder-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleGenerate();
                    }
                  }}
                />
              </div>

              {/* 生成ボタン */}
              <button
                onClick={handleGenerate}
                disabled={loading || !question.trim()}
                className="w-full py-3 px-6 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    生成中...
                  </>
                ) : (
                  "SQL生成（Ctrl+Enter）"
                )}
              </button>
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* 生成結果 */}
            {result && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    生成SQL
                  </h3>
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {copied ? "コピー済み!" : "コピー"}
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
                  {result.sql}
                </pre>

                {/* 参照されたゴールドSQL */}
                {result.goldSqlsUsed.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">
                      参照されたゴールドSQL:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.goldSqlsUsed.map((g) => (
                        <span
                          key={g.id}
                          className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-md border border-amber-200"
                        >
                          {g.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.schemaVersion && (
                  <p className="mt-2 text-xs text-gray-400">
                    スキーマバージョン: {result.schemaVersion}
                  </p>
                )}

                {/* フィードバック済み表示 or 再評価ボタン */}
                {!feedbackOpen && feedbackDone && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                    <span className="text-sm text-green-600">フィードバック送信済み</span>
                    <button
                      onClick={() => {
                        setFeedbackDone(false);
                        setFeedbackOpen(true);
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      再評価
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* フィードバックダイアログ */}
            {feedbackOpen && result && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {feedbackDone ? (
                  <div className="text-center py-4">
                    <p className="text-lg font-medium text-green-600">
                      フィードバックを送信しました
                    </p>
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      生成SQLの評価
                    </h3>

                    {/* Good / Bad 選択 */}
                    <div className="flex gap-3 mb-4">
                      <button
                        onClick={() => setFeedbackRating("good")}
                        className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                          feedbackRating === "good"
                            ? "border-green-500 bg-green-50 text-green-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <span className="text-lg">&#128077;</span>
                        Good
                      </button>
                      <button
                        onClick={() => setFeedbackRating("bad")}
                        className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                          feedbackRating === "bad"
                            ? "border-red-500 bg-red-50 text-red-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <span className="text-lg">&#128078;</span>
                        Bad
                      </button>
                    </div>

                    {/* Badの場合: 正しいSQL入力（必須） */}
                    {feedbackRating === "bad" && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          正しいSQL（必須）
                        </label>
                        <textarea
                          value={correctedSql}
                          onChange={(e) => setCorrectedSql(e.target.value)}
                          placeholder="正しいSQLを入力してください..."
                          rows={6}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none text-gray-900 placeholder-gray-400 font-mono text-sm"
                        />
                        {!correctedSql.trim() && (
                          <p className="mt-1 text-xs text-red-500">
                            Badの場合は正しいSQLの入力が必須です
                          </p>
                        )}
                      </div>
                    )}

                    {/* コメント（任意） */}
                    {feedbackRating && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          コメント（任意）
                        </label>
                        <textarea
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          placeholder="補足があれば..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none text-gray-900 placeholder-gray-400 text-sm"
                        />
                      </div>
                    )}

                    {/* 送信ボタン */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleFeedbackSubmit}
                        disabled={
                          !feedbackRating ||
                          (feedbackRating === "bad" && !correctedSql.trim()) ||
                          feedbackSubmitting
                        }
                        className="flex-1 py-2 px-4 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                      >
                        {feedbackSubmitting ? "送信中..." : "フィードバックを送信"}
                      </button>
                      <button
                        onClick={() => setFeedbackOpen(false)}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        スキップ
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* サイドバー: 直近の履歴 */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                直近の生成履歴
              </h3>
              {history.length === 0 ? (
                <p className="text-sm text-gray-400">まだ履歴がありません</p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => {
                        setQuestion(item.userQuestion);
                        setDbType(item.dbType);
                        setFeedbackOpen(false);
                        setFeedbackDone(false);
                        if (item.generatedSql) {
                          setResult({
                            sql: item.generatedSql,
                            auditLogId: item.id,
                            goldSqlsUsed: [],
                            schemaVersion: null,
                          });
                        }
                      }}
                    >
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {item.userQuestion}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                          {item.dbType}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(item.createdAt).toLocaleString("ja-JP")}
                        </span>
                        {item.error && (
                          <span className="text-xs text-red-500">エラー</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
