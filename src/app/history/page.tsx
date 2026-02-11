"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/navigation";

interface AuditLog {
  id: string;
  createdAt: string;
  userQuestion: string;
  dbType: string;
  generatedSql: string | null;
  error: string | null;
  user?: { name: string; image: string | null };
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface LogDetailData {
  id: string;
  createdAt: string;
  userQuestion: string;
  dbType: string;
  generatedSql: string | null;
  error: string | null;
  schemaVersion: string | null;
  promptVersion: string;
  goldSqls: { id: string; title: string }[];
}

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [logDetail, setLogDetail] = useState<LogDetailData | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchLogs();
    }
  }, [session, page]);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/audit?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setPagination(data.pagination);
      }
    } catch {
      // ignore
    }
  };

  const fetchLogDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/audit/${id}`);
      if (res.ok) {
        const data = await res.json();
        setLogDetail(data);
        setSelectedLog(id);
      }
    } catch {
      // ignore
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">生成履歴</h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  日時
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  質問
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  DB種別
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  状態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.createdAt).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {log.userQuestion}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                      {log.dbType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {log.error ? (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                        エラー
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                        成功
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => fetchLogDetail(log.id)}
                      className="text-primary hover:text-primary-hover text-sm"
                    >
                      詳細
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                全{pagination.total}件中 {(page - 1) * pagination.limit + 1}-
                {Math.min(page * pagination.limit, pagination.total)}件
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                >
                  前へ
                </button>
                <button
                  onClick={() =>
                    setPage(Math.min(pagination.totalPages, page + 1))
                  }
                  disabled={page === pagination.totalPages}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                >
                  次へ
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 詳細モーダル */}
        {selectedLog && logDetail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  監査ログ詳細
                </h2>
                <button
                  onClick={() => {
                    setSelectedLog(null);
                    setLogDetail(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500">入力文</label>
                  <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {logDetail.userQuestion}
                  </p>
                </div>

                {logDetail.generatedSql && (
                  <div>
                    <label className="text-xs text-gray-500">生成SQL</label>
                    <pre className="mt-1 bg-gray-900 text-green-400 p-3 rounded-lg text-sm overflow-x-auto">
                      {logDetail.generatedSql}
                    </pre>
                  </div>
                )}

                {logDetail.error && (
                  <div>
                    <label className="text-xs text-gray-500">エラー</label>
                    <p className="mt-1 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                      {logDetail.error}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">DB種別</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {logDetail.dbType}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">
                      スキーマバージョン
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {logDetail.schemaVersion || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">
                      プロンプトバージョン
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {logDetail.promptVersion}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">日時</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(logDetail.createdAt).toLocaleString("ja-JP")}
                    </p>
                  </div>
                </div>

                {logDetail.goldSqls && logDetail.goldSqls.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500">
                      参照ゴールドSQL
                    </label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {logDetail.goldSqls.map((g) => (
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
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
