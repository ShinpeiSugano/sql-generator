"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/navigation";

interface SchemaDoc {
  id: string;
  dbType: string;
  version: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = {
  dbType: "mysql",
  version: "",
  content: "",
  isActive: false,
};

export default function AdminSchemaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [schemas, setSchemas] = useState<SchemaDoc[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterDbType, setFilterDbType] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session && session.user.role !== "admin") {
      router.push("/generate");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session && session.user.role === "admin") {
      fetchSchemas();
    }
  }, [session, filterDbType]);

  const fetchSchemas = async () => {
    const params = filterDbType ? `?dbType=${filterDbType}` : "";
    try {
      const res = await fetch(`/api/admin/schema${params}`);
      if (res.ok) {
        const data = await res.json();
        setSchemas(data);
      }
    } catch {
      // ignore
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/schema/${editingId}`
        : "/api/admin/schema";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        fetchSchemas();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (schema: SchemaDoc) => {
    setEditingId(schema.id);
    setForm({
      dbType: schema.dbType,
      version: schema.version,
      content: schema.content,
      isActive: schema.isActive,
    });
    setShowForm(true);
  };

  const handleActivate = async (schema: SchemaDoc) => {
    try {
      await fetch(`/api/admin/schema/${schema.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      fetchSchemas();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("本当に削除しますか？")) return;
    try {
      await fetch(`/api/admin/schema/${id}`, { method: "DELETE" });
      fetchSchemas();
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

  if (!session || session.user.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            DB定義書（スキーマ）管理
          </h1>
          <button
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover"
          >
            新規追加
          </button>
        </div>

        {/* フィルタ */}
        <div className="mb-4">
          <select
            value={filterDbType}
            onChange={(e) => setFilterDbType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">全DB種別</option>
            <option value="mysql">MySQL</option>
            <option value="bigquery">BigQuery</option>
            <option value="postgres">PostgreSQL</option>
          </select>
        </div>

        {/* 一覧 */}
        <div className="space-y-4">
          {schemas.map((schema) => (
            <div
              key={schema.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {schema.dbType} - v{schema.version}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        schema.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {schema.isActive ? "アクティブ" : "非アクティブ"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">
                    更新: {new Date(schema.updatedAt).toLocaleString("ja-JP")}
                  </p>

                  {/* コンテンツプレビュー */}
                  <div
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(
                        expandedId === schema.id ? null : schema.id
                      )
                    }
                  >
                    <pre
                      className={`bg-gray-50 p-3 rounded-lg text-xs overflow-x-auto ${
                        expandedId === schema.id ? "" : "max-h-24"
                      }`}
                    >
                      {schema.content}
                    </pre>
                    <p className="text-xs text-primary mt-1">
                      {expandedId === schema.id
                        ? "折りたたむ"
                        : "クリックで展開"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {!schema.isActive && (
                    <button
                      onClick={() => handleActivate(schema)}
                      className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      有効化
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(schema)}
                    className="px-3 py-1 text-xs bg-primary-light text-primary rounded hover:bg-primary/20"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(schema.id)}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}

          {schemas.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              DB定義書がまだ登録されていません
            </div>
          )}
        </div>

        {/* フォームモーダル */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editingId ? "DB定義書編集" : "DB定義書追加"}
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DB種別 *
                    </label>
                    <select
                      value={form.dbType}
                      onChange={(e) =>
                        setForm({ ...form, dbType: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="mysql">MySQL</option>
                      <option value="bigquery">BigQuery</option>
                      <option value="postgres">PostgreSQL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      バージョン *
                    </label>
                    <input
                      type="text"
                      value={form.version}
                      onChange={(e) =>
                        setForm({ ...form, version: e.target.value })
                      }
                      placeholder="例: 1.0.0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DB定義書（スキーマ内容） *
                  </label>
                  <textarea
                    value={form.content}
                    onChange={(e) =>
                      setForm({ ...form, content: e.target.value })
                    }
                    rows={16}
                    placeholder="CREATE TABLE文やテーブル定義をここに記述..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm({ ...form, isActive: e.target.checked })
                    }
                    className="rounded"
                  />
                  <label className="text-sm text-gray-700">
                    アクティブにする（同じDB種別の他のスキーマは自動的に非アクティブになります）
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !form.version || !form.content}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
