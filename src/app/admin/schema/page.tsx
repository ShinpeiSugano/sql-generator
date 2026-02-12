"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/navigation";

interface ColumnDef {
  id: string;
  sortOrder: number;
  columnName: string;
  columnNameJa: string | null;
  dataType: string;
  keyType: string | null;
  nullable: boolean;
  defaultValue: string | null;
  constants: string | null;
  description: string | null;
}

interface TableDef {
  id: string;
  dbType: string;
  tableName: string;
  tableNameJa: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  columns?: ColumnDef[];
}

export default function AdminSchemaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tables, setTables] = useState<TableDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDbType, setFilterDbType] = useState("mysql");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<TableDef | null>(null);

  // アップロード
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  // テーブル編集
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editTableForm, setEditTableForm] = useState({
    tableName: "",
    tableNameJa: "",
    description: "",
  });

  // カラム編集
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editColumnForm, setEditColumnForm] = useState<Partial<ColumnDef>>({});

  // 新規カラム追加
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnForm, setNewColumnForm] = useState({
    columnName: "",
    columnNameJa: "",
    dataType: "",
    keyType: "",
    nullable: true,
    defaultValue: "",
    constants: "",
    description: "",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = session?.user && (session.user as any).role === "admin";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchTables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/table-definitions?dbType=${filterDbType}`
      );
      if (res.ok) {
        const data = await res.json();
        setTables(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterDbType]);

  useEffect(() => {
    if (session) {
      fetchTables();
    }
  }, [session, fetchTables]);

  const fetchTableDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/table-definitions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setExpandedTable(data);
      }
    } catch {
      // ignore
    }
  };

  const handleOpenDetail = (id: string) => {
    setExpandedId(id);
    setExpandedTable(null);
    setEditingColumnId(null);
    setAddingColumn(false);
    setEditingTableId(null);
    fetchTableDetail(id);
  };

  const handleCloseDetail = () => {
    setExpandedId(null);
    setExpandedTable(null);
    setEditingColumnId(null);
    setAddingColumn(false);
    setEditingTableId(null);
  };

  // --- アップロード ---
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dbType", filterDbType);

      const res = await fetch("/api/admin/table-definitions/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadResult(
          `${data.totalTables}テーブル取り込み完了（新規: ${data.created.length}, 更新: ${data.updated.length}）`
        );
        fetchTables();
      } else {
        setUploadResult(`エラー: ${data.error}`);
      }
    } catch (err) {
      setUploadResult(`アップロードに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // --- テーブル編集 ---
  const handleEditTable = (t: TableDef) => {
    setEditingTableId(t.id);
    setEditTableForm({
      tableName: t.tableName,
      tableNameJa: t.tableNameJa || "",
      description: t.description || "",
    });
  };

  const handleSaveTable = async () => {
    if (!editingTableId) return;
    try {
      const res = await fetch(
        `/api/admin/table-definitions/${editingTableId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editTableForm),
        }
      );
      if (res.ok) {
        setEditingTableId(null);
        fetchTables();
        if (expandedId === editingTableId) {
          fetchTableDetail(editingTableId);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm("このテーブル定義を削除しますか？")) return;
    try {
      const res = await fetch(`/api/admin/table-definitions/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        handleCloseDetail();
        fetchTables();
      }
    } catch {
      // ignore
    }
  };

  // --- カラム編集 ---
  const handleEditColumn = (col: ColumnDef) => {
    setEditingColumnId(col.id);
    setEditColumnForm({ ...col });
  };

  const handleSaveColumn = async () => {
    if (!editingColumnId || !expandedId) return;
    try {
      const res = await fetch(
        `/api/admin/table-definitions/${expandedId}/columns/${editingColumnId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editColumnForm),
        }
      );
      if (res.ok) {
        setEditingColumnId(null);
        fetchTableDetail(expandedId);
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!expandedId || !confirm("このカラムを削除しますか？")) return;
    try {
      const res = await fetch(
        `/api/admin/table-definitions/${expandedId}/columns/${columnId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        fetchTableDetail(expandedId);
      }
    } catch {
      // ignore
    }
  };

  const handleAddColumn = async () => {
    if (!expandedId || !newColumnForm.columnName || !newColumnForm.dataType)
      return;
    try {
      const res = await fetch(
        `/api/admin/table-definitions/${expandedId}/columns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newColumnForm),
        }
      );
      if (res.ok) {
        setAddingColumn(false);
        setNewColumnForm({
          columnName: "",
          columnNameJa: "",
          dataType: "",
          keyType: "",
          nullable: true,
          defaultValue: "",
          constants: "",
          description: "",
        });
        fetchTableDetail(expandedId);
      }
    } catch {
      // ignore
    }
  };

  // キータイプバッジの色（メインカラー系）
  const keyBadgeClass = (keyType: string) => {
    const kt = keyType.toUpperCase();
    if (kt === "PK") return "bg-primary/15 text-primary border border-primary/30 font-semibold";
    if (kt.startsWith("FK")) return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    if (kt === "UK") return "bg-blue-50 text-blue-700 border border-blue-200";
    return "bg-gray-100 text-gray-600 border border-gray-200";
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
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">DB定義書管理</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {tables.length}テーブル
            </span>
            {isAdmin && (
              <label className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover cursor-pointer">
                {uploading ? "取り込み中..." : ".xlsxアップロード"}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        </div>

        {/* アップロード結果 */}
        {uploadResult && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              uploadResult.startsWith("エラー")
                ? "bg-red-50 text-red-600"
                : "bg-green-50 text-green-600"
            }`}
          >
            {uploadResult}
            <button
              onClick={() => setUploadResult(null)}
              className="ml-2 text-xs underline"
            >
              閉じる
            </button>
          </div>
        )}

        {/* DB種別フィルタ */}
        <div className="mb-6 flex gap-2">
          {[
            { value: "mysql", label: "MySQL" },
            { value: "bigquery", label: "BigQuery" },
            { value: "postgres", label: "PostgreSQL" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setFilterDbType(opt.value);
                handleCloseDetail();
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterDbType === opt.value
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* テーブルグリッド */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : tables.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            テーブル定義がまだありません。
            {isAdmin && ".xlsxをアップロードしてください。"}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {tables.map((t) => (
              <div
                key={t.id}
                onClick={() => handleOpenDetail(t.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  expandedId === t.id
                    ? "bg-primary-light border-primary shadow-md ring-2 ring-primary/40"
                    : "bg-white border-gray-200 hover:border-primary/40 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {t.tableName}
                    </p>
                    {t.tableNameJa && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {t.tableNameJa}
                      </p>
                    )}
                  </div>
                </div>
                {t.description && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                    {t.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* テーブル詳細ポップアップモーダル */}
        {expandedId && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={handleCloseDetail}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {!expandedTable ? (
                <div className="p-12 text-center text-gray-400">読み込み中...</div>
              ) : (
                <>
                  {/* モーダルヘッダー */}
                  <div className="px-6 py-4 bg-primary-light border-b border-primary/20 flex items-start justify-between shrink-0">
                    {editingTableId === expandedTable.id ? (
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-3 gap-3">
                          <input
                            value={editTableForm.tableName}
                            onChange={(e) =>
                              setEditTableForm({
                                ...editTableForm,
                                tableName: e.target.value,
                              })
                            }
                            placeholder="テーブル名"
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                          />
                          <input
                            value={editTableForm.tableNameJa}
                            onChange={(e) =>
                              setEditTableForm({
                                ...editTableForm,
                                tableNameJa: e.target.value,
                              })
                            }
                            placeholder="論理名"
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                          />
                          <input
                            value={editTableForm.description}
                            onChange={(e) =>
                              setEditTableForm({
                                ...editTableForm,
                                description: e.target.value,
                              })
                            }
                            placeholder="概要"
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveTable}
                            className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary-hover"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingTableId(null)}
                            className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">
                            {expandedTable.tableName}
                            {expandedTable.tableNameJa && (
                              <span className="ml-2 text-sm font-normal text-gray-500">
                                ({expandedTable.tableNameJa})
                              </span>
                            )}
                          </h2>
                          {expandedTable.description && (
                            <p className="text-sm text-gray-500 mt-1">
                              {expandedTable.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {expandedTable.columns?.length || 0}カラム
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleEditTable(expandedTable)}
                                className="px-3 py-1.5 text-xs bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDeleteTable(expandedTable.id)}
                                className="px-3 py-1.5 text-xs bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                              >
                                削除
                              </button>
                            </>
                          )}
                          <button
                            onClick={handleCloseDetail}
                            className="ml-2 text-gray-400 hover:text-gray-600 text-xl leading-none"
                          >
                            &times;
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* カラムテーブル */}
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                            No
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                            物理名
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                            論理名
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                            データ型
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                            キー
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                            NULL
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                            デフォルト
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                            定数
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                            説明
                          </th>
                          {isAdmin && (
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                              操作
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {expandedTable.columns?.map((col, idx) =>
                          editingColumnId === col.id && isAdmin ? (
                            <tr
                              key={col.id}
                              className="border-b border-gray-100 bg-primary-light/50"
                            >
                              <td className="px-4 py-2 text-xs text-gray-400">
                                {idx + 1}
                              </td>
                              <td className="px-1 py-1">
                                <input
                                  value={editColumnForm.columnName || ""}
                                  onChange={(e) =>
                                    setEditColumnForm({
                                      ...editColumnForm,
                                      columnName: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                              </td>
                              <td className="px-1 py-1">
                                <input
                                  value={editColumnForm.columnNameJa || ""}
                                  onChange={(e) =>
                                    setEditColumnForm({
                                      ...editColumnForm,
                                      columnNameJa: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                              </td>
                              <td className="px-1 py-1">
                                <input
                                  value={editColumnForm.dataType || ""}
                                  onChange={(e) =>
                                    setEditColumnForm({
                                      ...editColumnForm,
                                      dataType: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                              </td>
                              <td className="px-1 py-1">
                                <input
                                  value={editColumnForm.keyType || ""}
                                  onChange={(e) =>
                                    setEditColumnForm({
                                      ...editColumnForm,
                                      keyType: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                              </td>
                              <td className="px-1 py-1 text-center">
                                <input
                                  type="checkbox"
                                  checked={editColumnForm.nullable ?? true}
                                  onChange={(e) =>
                                    setEditColumnForm({
                                      ...editColumnForm,
                                      nullable: e.target.checked,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-1 py-1">
                                <input
                                  value={editColumnForm.defaultValue || ""}
                                  onChange={(e) =>
                                    setEditColumnForm({
                                      ...editColumnForm,
                                      defaultValue: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                              </td>
                              <td className="px-1 py-1">
                                <input
                                  value={editColumnForm.constants || ""}
                                  onChange={(e) =>
                                    setEditColumnForm({
                                      ...editColumnForm,
                                      constants: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                              </td>
                              <td className="px-1 py-1">
                                <input
                                  value={editColumnForm.description || ""}
                                  onChange={(e) =>
                                    setEditColumnForm({
                                      ...editColumnForm,
                                      description: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleSaveColumn}
                                    className="text-xs text-primary font-medium hover:text-primary-hover"
                                  >
                                    保存
                                  </button>
                                  <button
                                    onClick={() => setEditingColumnId(null)}
                                    className="text-xs text-gray-500 hover:text-gray-700"
                                  >
                                    取消
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr
                              key={col.id}
                              className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors"
                            >
                              <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-xs text-gray-900 font-medium">
                                {col.columnName}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-600">
                                {col.columnNameJa || "-"}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-primary font-mono font-medium">
                                {col.dataType}
                              </td>
                              <td className="px-4 py-2.5">
                                {col.keyType && (
                                  <span
                                    className={`px-2 py-0.5 text-xs rounded-full ${keyBadgeClass(
                                      col.keyType
                                    )}`}
                                  >
                                    {col.keyType}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-xs">
                                {col.nullable ? (
                                  <span className="text-gray-400">YES</span>
                                ) : (
                                  <span className="text-red-500 font-medium">NOT NULL</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">
                                {col.defaultValue || "-"}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-500">
                                {col.constants || "-"}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-600">
                                {col.description || "-"}
                              </td>
                              {isAdmin && (
                                <td className="px-4 py-2.5">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditColumn(col);
                                      }}
                                      className="text-xs text-primary hover:text-primary-hover"
                                    >
                                      編集
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteColumn(col.id);
                                      }}
                                      className="text-xs text-red-500 hover:text-red-700"
                                    >
                                      削除
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          )
                        )}

                        {/* 新規カラム追加行 */}
                        {addingColumn && isAdmin && (
                          <tr className="border-b border-gray-100 bg-green-50/50">
                            <td className="px-4 py-2 text-xs text-gray-400">+</td>
                            <td className="px-1 py-1">
                              <input
                                value={newColumnForm.columnName}
                                onChange={(e) =>
                                  setNewColumnForm({
                                    ...newColumnForm,
                                    columnName: e.target.value,
                                  })
                                }
                                placeholder="物理名 *"
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <input
                                value={newColumnForm.columnNameJa}
                                onChange={(e) =>
                                  setNewColumnForm({
                                    ...newColumnForm,
                                    columnNameJa: e.target.value,
                                  })
                                }
                                placeholder="論理名"
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <input
                                value={newColumnForm.dataType}
                                onChange={(e) =>
                                  setNewColumnForm({
                                    ...newColumnForm,
                                    dataType: e.target.value,
                                  })
                                }
                                placeholder="データ型 *"
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <input
                                value={newColumnForm.keyType}
                                onChange={(e) =>
                                  setNewColumnForm({
                                    ...newColumnForm,
                                    keyType: e.target.value,
                                  })
                                }
                                placeholder="PK/FK/UK"
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-1 py-1 text-center">
                              <input
                                type="checkbox"
                                checked={newColumnForm.nullable}
                                onChange={(e) =>
                                  setNewColumnForm({
                                    ...newColumnForm,
                                    nullable: e.target.checked,
                                  })
                                }
                              />
                            </td>
                            <td className="px-1 py-1">
                              <input
                                value={newColumnForm.defaultValue}
                                onChange={(e) =>
                                  setNewColumnForm({
                                    ...newColumnForm,
                                    defaultValue: e.target.value,
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <input
                                value={newColumnForm.constants}
                                onChange={(e) =>
                                  setNewColumnForm({
                                    ...newColumnForm,
                                    constants: e.target.value,
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <input
                                value={newColumnForm.description}
                                onChange={(e) =>
                                  setNewColumnForm({
                                    ...newColumnForm,
                                    description: e.target.value,
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={handleAddColumn}
                                  disabled={
                                    !newColumnForm.columnName || !newColumnForm.dataType
                                  }
                                  className="text-xs text-green-600 hover:text-green-800 disabled:opacity-50"
                                >
                                  追加
                                </button>
                                <button
                                  onClick={() => setAddingColumn(false)}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  取消
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* カラム追加ボタン (admin only) */}
                  {isAdmin && !addingColumn && (
                    <div className="px-6 py-3 border-t border-gray-200 shrink-0 bg-gray-50">
                      <button
                        onClick={() => setAddingColumn(true)}
                        className="px-3 py-1.5 text-xs text-primary hover:text-primary-hover border border-primary/30 rounded-lg hover:bg-primary-light transition-colors"
                      >
                        + カラム追加
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
