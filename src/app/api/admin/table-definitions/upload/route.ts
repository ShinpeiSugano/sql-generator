import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-helpers";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ParsedColumn {
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

interface ParsedTable {
  tableName: string;
  tableNameJa: string | null;
  description: string | null;
  columns: ParsedColumn[];
}

function parseSheet(sheet: XLSX.WorkSheet, sheetName: string): ParsedTable | null {
  const range = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  if (!range || range.length < 3) return null;

  // Row 0: テーブル名 | {tableName}
  // Row 1: テーブル概要 | {description}
  // ...header row somewhere below
  let tableName = "";
  let tableNameJa: string | null = null;
  let description: string | null = null;

  // テーブル名の取得: Row 0のB列、またはシート名から
  if (range[0] && range[0].length >= 2) {
    tableName = String(range[0][1] || "").trim();
  }
  if (!tableName) {
    // シート名からテーブル名を抽出 (BD_table_0001_admins -> admins)
    const match = sheetName.match(/BD_table_\d+_(.+)/);
    tableName = match ? match[1] : sheetName;
  }

  // テーブル概要
  if (range[1] && range[1].length >= 2) {
    const raw = String(range[1][1] || "").trim();
    // "管理者 管理画面に..." のように論理名+概要が入っている場合がある
    const parts = raw.split(/\s+/);
    if (parts.length > 1) {
      tableNameJa = parts[0];
      description = parts.slice(1).join(" ");
    } else {
      description = raw || null;
    }
  }

  // ヘッダー行を探す（"No" or "物理名" を含む行）
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(range.length, 10); i++) {
    const row = range[i];
    if (!row) continue;
    const joined = row.map((c) => String(c || "").trim().toLowerCase()).join(",");
    if (joined.includes("物理名") || (joined.includes("no") && joined.includes("データ型"))) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) return null;

  // ヘッダーからカラムインデックスをマッピング
  const headerRow = range[headerRowIdx].map((c) => String(c || "").trim());
  const colMap: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    const lower = h.toLowerCase();
    if (lower === "no") colMap.no = idx;
    if (lower === "物理名" || lower === "column_name") colMap.columnName = idx;
    if (lower === "論理名" || lower === "logical_name") colMap.columnNameJa = idx;
    if (lower.includes("データ型") || lower === "data_type") colMap.dataType = idx;
    if (lower.includes("pk") || lower.includes("fk") || lower.includes("キー") || lower === "key") colMap.keyType = idx;
    if (lower.includes("null") || lower === "nullable") colMap.nullable = idx;
    if (lower.includes("デフォルト") || lower === "default") colMap.defaultValue = idx;
    if (lower.includes("定数") || lower === "constants") colMap.constants = idx;
    if (lower === "説明" || lower === "description" || lower === "discription") colMap.description = idx;
  });

  if (colMap.columnName === undefined) return null;

  // データ行をパース
  const columns: ParsedColumn[] = [];
  for (let i = headerRowIdx + 1; i < range.length; i++) {
    const row = range[i];
    if (!row || row.length === 0) continue;

    const colName = String(row[colMap.columnName] || "").trim();
    if (!colName) continue;

    const nullStr = colMap.nullable !== undefined
      ? String(row[colMap.nullable] || "").trim().toUpperCase()
      : "";

    columns.push({
      sortOrder: columns.length + 1,
      columnName: colName,
      columnNameJa: colMap.columnNameJa !== undefined
        ? String(row[colMap.columnNameJa] || "").trim() || null
        : null,
      dataType: colMap.dataType !== undefined
        ? String(row[colMap.dataType] || "").trim()
        : "",
      keyType: colMap.keyType !== undefined
        ? String(row[colMap.keyType] || "").trim() || null
        : null,
      nullable: nullStr !== "NOT NULL",
      defaultValue: colMap.defaultValue !== undefined
        ? String(row[colMap.defaultValue] || "").trim() || null
        : null,
      constants: colMap.constants !== undefined
        ? String(row[colMap.constants] || "").trim() || null
        : null,
      description: colMap.description !== undefined
        ? String(row[colMap.description] || "").trim() || null
        : null,
    });
  }

  if (columns.length === 0) return null;

  return { tableName, tableNameJa, description, columns };
}

// POST: xlsxアップロードで一括取り込み
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return forbiddenResponse();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const dbType = formData.get("dbType") as string | null;

    if (!file || !dbType) {
      return NextResponse.json(
        { error: "file と dbType は必須です" },
        { status: 400 }
      );
    }

    if (!["mysql", "bigquery", "postgres"].includes(dbType)) {
      return NextResponse.json(
        { error: "無効なDB種別です" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const parsedTables: ParsedTable[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const parsed = parseSheet(sheet, sheetName);
      if (parsed) {
        parsedTables.push(parsed);
      }
    }

    if (parsedTables.length === 0) {
      return NextResponse.json(
        { error: `有効なテーブル定義が見つかりませんでした（シート数: ${workbook.SheetNames.length}, シート名: ${workbook.SheetNames.slice(0, 5).join(", ")}）` },
        { status: 400 }
      );
    }

    // 一括処理（PgBouncer互換: interactive transactionを使わない）
    const created: string[] = [];
    const updated: string[] = [];

    for (let i = 0; i < parsedTables.length; i++) {
      const t = parsedTables[i];
      const existing = await prisma.tableDefinition.findUnique({
        where: { dbType_tableName: { dbType, tableName: t.tableName } },
      });

      if (existing) {
        await prisma.columnDefinition.deleteMany({ where: { tableId: existing.id } });
        await prisma.tableDefinition.update({
          where: { id: existing.id },
          data: {
            tableNameJa: t.tableNameJa,
            description: t.description,
            sortOrder: i + 1,
            columns: {
              create: t.columns,
            },
          },
        });
        updated.push(t.tableName);
      } else {
        await prisma.tableDefinition.create({
          data: {
            dbType,
            tableName: t.tableName,
            tableNameJa: t.tableNameJa,
            description: t.description,
            sortOrder: i + 1,
            isActive: true,
            columns: {
              create: t.columns,
            },
          },
        });
        created.push(t.tableName);
      }
    }

    const results = { created, updated };

    return NextResponse.json({
      message: `${results.created.length}件作成、${results.updated.length}件更新しました`,
      created: results.created,
      updated: results.updated,
      totalTables: parsedTables.length,
    });
  } catch (err) {
    console.error("xlsx upload error:", err);
    return NextResponse.json(
      { error: `アップロード処理エラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
