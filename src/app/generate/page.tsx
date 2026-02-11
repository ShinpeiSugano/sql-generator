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
                        if (item.generatedSql) {
                          setResult({
                            sql: item.generatedSql,
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
