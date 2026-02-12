"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/navigation";
import { MultiSelectTags } from "@/components/multi-select-tags";

interface Tag {
  id: string;
  name: string;
}

interface GoldSql {
  id: string;
  title: string;
  description: string | null;
  dbType: string;
  sql: string;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  dbType: "mysql",
  sql: "",
  tags: [] as string[],
  isActive: true,
};

export default function AdminGoldSqlPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [goldSqls, setGoldSqls] = useState<GoldSql[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterDbType, setFilterDbType] = useState("");
  const [saving, setSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showTagManager, setShowTagManager] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (session && session.user.role !== "admin") {
      router.push("/generate");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session && session.user.role === "admin") {
      fetchGoldSqls();
      fetchTags();
    }
  }, [session, filterDbType]);

  const fetchGoldSqls = async () => {
    const params = filterDbType ? `?dbType=${filterDbType}` : "";
    try {
      const res = await fetch(`/api/admin/gold-sql${params}`);
      if (res.ok) {
        const data = await res.json();
        setGoldSqls(data);
      }
    } catch {
      // ignore
    }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch("/api/admin/tags");
      if (res.ok) {
        const data: Tag[] = await res.json();
        setAllTags(data);
        setAvailableTags(data.map((t) => t.name));
      }
    } catch {
      // ignore
    }
  };

  const handleCreateTag = async (name: string) => {
    const res = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const created: Tag = await res.json();
      setAllTags((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setAvailableTags((prev) => [...prev, name].sort());
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm("このタグを削除しますか？")) return;
    const res = await fetch(`/api/admin/tags/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAllTags((prev) => prev.filter((t) => t.id !== id));
      setAvailableTags((prev) => {
        const deleted = allTags.find((t) => t.id === id);
        return deleted ? prev.filter((n) => n !== deleted.name) : prev;
      });
    }
  };

  const handleRenameTag = async (id: string) => {
    const name = editingTagName.trim();
    if (!name) return;
    const res = await fetch(`/api/admin/tags/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setEditingTagId(null);
      setEditingTagName("");
      fetchTags();
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const body = { ...form };

      const url = editingId
        ? `/api/admin/gold-sql/${editingId}`
        : "/api/admin/gold-sql";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        fetchGoldSqls();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (gs: GoldSql) => {
    setEditingId(gs.id);
    setForm({
      title: gs.title,
      description: gs.description || "",
      dbType: gs.dbType,
      sql: gs.sql,
      tags: gs.tags || [],
      isActive: gs.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("本当に削除しますか？")) return;
    try {
      await fetch(`/api/admin/gold-sql/${id}`, { method: "DELETE" });
      fetchGoldSqls();
    } catch {
      // ignore
    }
  };

  const handleToggleActive = async (gs: GoldSql) => {
    try {
      await fetch(`/api/admin/gold-sql/${gs.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !gs.isActive }),
      });
      fetchGoldSqls();
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
          <h1 className="text-2xl font-bold text-gray-900">ゴールドSQL管理</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowTagManager(true)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            >
              タグ整理
            </button>
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
          {goldSqls.map((gs) => (
            <div
              key={gs.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {gs.title}
                    </h3>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      {gs.dbType}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        gs.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {gs.isActive ? "有効" : "無効"}
                    </span>
                  </div>
                  {gs.description && (
                    <p className="text-sm text-gray-600 mb-2">
                      {gs.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {gs.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs overflow-y-auto max-h-32 whitespace-pre-wrap break-all">
                    {gs.sql}
                  </pre>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleToggleActive(gs)}
                    className={`px-3 py-1 text-xs rounded ${
                      gs.isActive
                        ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                  >
                    {gs.isActive ? "無効化" : "有効化"}
                  </button>
                  <button
                    onClick={() => handleEdit(gs)}
                    className="px-3 py-1 text-xs bg-primary-light text-primary rounded hover:bg-primary/20"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(gs.id)}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}

          {goldSqls.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              ゴールドSQLがまだ登録されていません
            </div>
          )}
        </div>

        {/* フォームモーダル */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editingId ? "ゴールドSQL編集" : "ゴールドSQL追加"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    タイトル *
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明（用途・注意点）
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

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
                    SQL *
                  </label>
                  <textarea
                    value={form.sql}
                    onChange={(e) => setForm({ ...form, sql: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    タグ
                  </label>
                  <MultiSelectTags
                    availableTags={availableTags}
                    selectedTags={form.tags}
                    onChange={(tags) => setForm({ ...form, tags })}
                    onCreateTag={handleCreateTag}
                    placeholder="タグを選択..."
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
                  <label className="text-sm text-gray-700">有効</label>
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
                  disabled={saving || !form.title || !form.sql}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* タグ整理モーダル */}
        {showTagManager && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[70vh] overflow-hidden p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">タグ整理</h2>
                <button
                  onClick={() => {
                    setShowTagManager(false);
                    setEditingTagId(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  &times;
                </button>
              </div>

              {allTags.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">タグがまだありません</p>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {allTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg"
                    >
                      {editingTagId === tag.id ? (
                        <>
                          <input
                            type="text"
                            value={editingTagName}
                            onChange={(e) => setEditingTagName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameTag(tag.id);
                              if (e.key === "Escape") setEditingTagId(null);
                            }}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenameTag(tag.id)}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingTagId(null)}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-gray-700">
                            {tag.name}
                          </span>
                          <button
                            onClick={() => {
                              setEditingTagId(tag.id);
                              setEditingTagName(tag.name);
                            }}
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteTag(tag.id)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                          >
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
