"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";

type DbType = "mysql" | "bigquery" | "postgres";

type CsvRow = {
  table_physical?: string; // 例: BD_table_0001_admins
  column_physical?: string; // 例: id
  column_logical?: string; // 例: ID
  data_type?: string; // 例: INT UNSIGNED
  is_null?: string; // 例: NOT NULL / YES / NO
  key?: string; // 例: PK / UK / FK(...)
  default_value?: string; // 定数
  description?: string; // 説明
};

function normalizeKey(s?: string) {
  return (s ?? "").trim().toLowerCase();
}

function asNotNull(isNull?: string) {
  const v = (isNull ?? "").toLowerCase();
  // シートによって YES/NO, NULL/NOT NULL が混ざる想定
  if (v.includes("not null")) return true;
  if (v === "no") return true;
  return false;
}

function safeIdent(name: string) {
  // MySQL想定：バッククォートで囲む（簡易）
  return `\`${name.replace(/`/g, "")}\``;
}

function mapMysqlType(t?: string) {
  const v = (t ?? "").trim();
  return v || "VARCHAR(191)";
}

function generateMysqlDDL(table: string, rows: CsvRow[]) {
  const cols = rows
    .filter((r) => r.column_physical)
    .map((r) => {
      const col = r.column_physical!.trim();
      const type = mapMysqlType(r.data_type);
      const notNull = asNotNull(r.is_null) ? " NOT NULL" : "";
      const def = r.default_value?.trim()
        ? ` DEFAULT ${r.default_value.trim()}`
        : "";
      return `  ${safeIdent(col)} ${type}${notNull}${def}`;
    });

  // PK候補
  const pkCols = rows
    .filter((r) => normalizeKey(r.key).includes("pk"))
    .map((r) => r.column_physical!.trim())
    .filter(Boolean);

  const indexes: string[] = [];
  if (pkCols.length > 0) {
    indexes.push(`  PRIMARY KEY (${pkCols.map(safeIdent).join(", ")})`);
  }

  const ddl = [
    `-- ${table}`,
    `CREATE TABLE ${safeIdent(table)} (`,
    [...cols, ...indexes].join(",\n"),
    `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  ].join("\n");

  return ddl;
}

function generateMarkdownTable(table: string, rows: CsvRow[]) {
  const header =
    `### ${table}\n\n` +
    `| No | 物理名 | 論理名 | データ型 | キー | NULL | 定数 | 説明 |\n` +
    `|---:|---|---|---|---|---|---|---|\n`;

  const body = rows
    .filter((r) => r.column_physical)
    .map((r, i) => {
      const no = i + 1;
      const phys = r.column_physical ?? "";
      const logical = r.column_logical ?? "";
      const dt = r.data_type ?? "";
      const key = r.key ?? "";
      const nul = r.is_null ?? "";
      const def = r.default_value ?? "";
      const desc = (r.description ?? "").replace(/\n/g, " ");
      return `| ${no} | ${phys} | ${logical} | ${dt} | ${key} | ${nul} | ${def} | ${desc} |`;
    })
    .join("\n");

  return header + body + "\n";
}

export default function AdminSchemaPage() {
  const [dbType, setDbType] = useState<DbType>("mysql");
  const [version, setVersion] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [preview, setPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, CsvRow[]>();
    for (const r of rows) {
      const t = (r.table_physical ?? "").trim();
      if (!t) continue;
      if (!m.has(t)) m.set(t, []);
      m.get(t)!.push(r);
    }
    return m;
  }, [rows]);

  const handleFile = (file: File) => {
    setMsg(null);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        // ヘッダ名がシートによって違う可能性があるので、柔軟に吸収（最低限）
        const normalized = (result.data ?? []).map((r: any) => ({
          table_physical:
            r.table_physical ?? r.table ?? r["テーブル物理名"] ?? r["table"],
          column_physical:
            r.column_physical ?? r.column ?? r["カラム物理名"] ?? r["column"],
          column_logical:
            r.column_logical ?? r["カラム論理名"] ?? r["logical_name"],
          data_type: r.data_type ?? r["データ型"] ?? r["type"],
          key: r.key ?? r["キー"] ?? r["Key"],
          is_null: r.is_null ?? r["NULL"] ?? r["null"],
          default_value: r.default_value ?? r["定数"] ?? r["default"],
          description: r.description ?? r["説明"] ?? r["comment"],
        })) as CsvRow[];

        setRows(normalized);

        // プレビュー（DDL + Markdown）
        const parts: string[] = [];
        for (const [table, rs] of new Map(
          [...normalized]
            .filter((x) => (x.table_physical ?? "").trim())
            .reduce((acc, x) => {
              const t = (x.table_physical ?? "").trim();
              if (!acc.has(t)) acc.set(t, []);
              acc.get(t)!.push(x);
              return acc;
            }, new Map<string, CsvRow[]>())
        )) {
          parts.push(generateMysqlDDL(table, rs));
          parts.push("");
          parts.push(generateMarkdownTable(table, rs));
          parts.push("\n---\n");
        }
        setPreview(parts.join("\n"));
      },
      error: () => setMsg("CSVの読み込みに失敗しました"),
    });
  };

  const save = async () => {
    setMsg(null);
    if (!version.trim()) {
      setMsg("バージョンを入力してね（例: 1.0.0）");
      return;
    }
    if (!preview.trim()) {
      setMsg("CSVをアップロードしてプレビューを作ってね");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/schema/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dbType,
          version,
          content: preview,
          isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存に失敗");

      setMsg("保存できた！ 🎉（SchemaDocument に登録完了）");
    } catch (e: any) {
      setMsg(e?.message ?? "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white border rounded-xl p-6">
          <h1 className="text-lg font-semibold">DB定義書（CSVアップロード）</h1>
          <p className="text-sm text-gray-500 mt-1">
            CSV → table_physical でグルーピング → DDL + Markdown生成 →
            SchemaDocument.content に保存
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div>
              <label className="text-sm font-medium text-gray-700">
                DB種別
              </label>
              <select
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={dbType}
                onChange={(e) => setDbType(e.target.value as DbType)}
              >
                <option value="mysql">MySQL</option>
                <option value="bigquery">BigQuery</option>
                <option value="postgres">PostgreSQL</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                ※いまのDDL生成はMySQL向け（必要ならBQ/PGも後で対応）
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                バージョン
              </label>
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="例: 1.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                アクティブにする
              </label>
              <button
                onClick={save}
                disabled={saving}
                className="ml-auto px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50 hover:bg-primary-hover"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="text-xs text-gray-500 mt-2">
              読み込んだテーブル数：{grouped.size}
            </div>
          </div>

          {msg && (
            <div className="mt-4 text-sm border rounded-lg px-3 py-2 bg-gray-50">
              {msg}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            生成プレビュー（DDL + Markdown）
          </h2>
          <textarea
            className="w-full h-[420px] border rounded-lg p-3 font-mono text-xs"
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
