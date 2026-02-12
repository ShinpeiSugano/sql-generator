"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/navigation";

interface FeedbackItem {
  id: string;
  auditLogId: string;
  userId: string;
  userEmail: string;
  rating: string;
  correctedSql: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  auditLog: {
    userQuestion: string;
    dbType: string;
    generatedSql: string | null;
    createdAt: string;
  };
}

export default function FeedbackAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ correctedSql: "", comment: "" });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRating) params.set("rating", filterRating);
      const res = await fetch(`/api/admin/feedback?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data.feedbacks);
        setTotal(data.total);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterRating]);

  useEffect(() => {
    if (session) {
      fetchFeedbacks();
    }
  }, [session, fetchFeedbacks]);

  const handleEdit = (fb: FeedbackItem) => {
    setEditingId(fb.id);
    setEditForm({
      correctedSql: fb.correctedSql || "",
      comment: fb.comment || "",
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/admin/feedback/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        fetchFeedbacks();
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このフィードバックを削除しますか？")) return;
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchFeedbacks();
      }
    } catch {
      // ignore
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-gray-500">読み込み中...</div>
        </main>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            フィードバック管理
          </h1>
          <span className="text-sm text-gray-500">{total}件</span>
        </div>

        {/* フィルター */}
        <div className="mb-4 flex gap-2">
          {[
            { value: "", label: "すべて" },
            { value: "good", label: "Good" },
            { value: "bad", label: "Bad" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterRating(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterRating === opt.value
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* フィードバック一覧 */}
        <div className="space-y-4">
          {feedbacks.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              フィードバックがまだありません
            </div>
          ) : (
            feedbacks.map((fb) => (
              <div
                key={fb.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                {/* ヘッダー */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        fb.rating === "good"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {fb.rating === "good" ? "Good" : "Bad"}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                      {fb.auditLog.dbType}
                    </span>
                    <span className="text-xs text-gray-400">
                      {fb.userEmail}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(fb.createdAt).toLocaleString("ja-JP")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(fb)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(fb.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      削除
                    </button>
                  </div>
                </div>

                {/* 質問 */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">ユーザーの質問:</p>
                  <p className="text-sm text-gray-800">
                    {fb.auditLog.userQuestion}
                  </p>
                </div>

                {/* 生成されたSQL */}
                {fb.auditLog.generatedSql && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">生成SQL:</p>
                    <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono leading-relaxed whitespace-pre-wrap break-all overflow-x-auto">
                      {fb.auditLog.generatedSql}
                    </pre>
                  </div>
                )}

                {/* 編集モード */}
                {editingId === fb.id ? (
                  <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        正しいSQL
                      </label>
                      <textarea
                        value={editForm.correctedSql}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            correctedSql: e.target.value,
                          })
                        }
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        コメント
                      </label>
                      <textarea
                        value={editForm.comment}
                        onChange={(e) =>
                          setEditForm({ ...editForm, comment: e.target.value })
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 正しいSQL（Badの場合） */}
                    {fb.correctedSql && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">
                          正しいSQL:
                        </p>
                        <pre className="bg-blue-950 text-blue-300 p-3 rounded-lg text-xs font-mono leading-relaxed whitespace-pre-wrap break-all overflow-x-auto">
                          {fb.correctedSql}
                        </pre>
                      </div>
                    )}

                    {/* コメント */}
                    {fb.comment && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">
                          コメント:
                        </p>
                        <p className="text-sm text-gray-700">{fb.comment}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
