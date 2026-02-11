import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── METRICS_TEXT 初期テンプレ ───
const DEFAULT_METRICS_TEXT = `■ LTV（デフォルト定義）
・LTV = SUM(支払金額 - COALESCE(返金額, 0))
・対象: 支払いステータスが paid のみ
・基準日: 支払日（paid_at）
・通貨: JPY

■ 登録日
・登録日 = users.created_at

■ 年齢
・現在年齢を使用
・DB種別ごとに正しい関数を使う（MySQL / BigQuery / Postgres）`;

// ─── SQL生成プロンプトテンプレ ───
const SQL_GENERATION_PROMPT = `あなたは当社専用のデータ分析AIです。
ユーザーの日本語の質問を、Metabaseに貼り付けてそのまま実行できるSQLに変換してください。

【絶対ルール】
・出力はSQLのみ（説明文・Markdown禁止）
・SELECTのみ生成すること
・INSERT / UPDATE / DELETE / MERGE / DROP / ALTER / TRUNCATE / CREATE は禁止
・提供されたDB定義書に存在しないテーブル/カラムを捏造しない
・日付は日本時間（JST）で解釈する
・1クエリで完結（WITH句は使用可）
・可読性の高いSQLを書く（明確なJOIN条件・エイリアス）

【利用DB】
{DB_TYPE}

【DB定義書】
{SCHEMA_TEXT}

【指標定義・業務ルール】
{METRICS_TEXT}

【曖昧性解消ルール】
・「LTV教えて」とだけ言われた場合は「平均LTV」と「対象ユーザー数」を返す
・合計/平均の指定がなければ平均を採用する
・「今日まで」= CURRENT_DATE()（JST）まで
・「登録日が2026年」= 登録日時が [2026-01-01, 2027-01-01)
・「25歳」= 現在年齢が25歳
・期間指定がない場合は生涯（期間制限なし）

【ゴールドSQL（最優先で踏襲）】
以下は人間が正しいと判断したSQLです。
質問が近い場合は構造（JOIN / WHERE / 集計）を最大限踏襲し、差分のみ変更してください。
{GOLD_SQL_EXAMPLES}

【出力カラム名】
・ユーザーが日本語で質問しているため、日本語カラム名を使用する

【ユーザーの質問】
{USER_INPUT}`;

export interface GoldSqlExample {
  id: string;
  title: string;
  description: string | null;
  sql: string;
  tags: string[];
}

export interface GenerateSqlParams {
  userQuestion: string;
  dbType: string;
  schemaText: string;
  goldSqlExamples: GoldSqlExample[];
  metricsText?: string;
}

export interface GenerateSqlResult {
  sql: string;
  model: string;
  temperature: number;
  promptVersion: string;
}

function buildPrompt(params: GenerateSqlParams): string {
  const { userQuestion, dbType, schemaText, goldSqlExamples, metricsText } =
    params;

  // ゴールドSQL部分の組み立て
  let goldSqlSection = "（該当するゴールドSQLはありません）";
  if (goldSqlExamples.length > 0) {
    goldSqlSection = goldSqlExamples
      .map(
        (g, i) =>
          `--- ゴールドSQL ${i + 1}: ${g.title} ---\n${g.description ? `用途: ${g.description}\n` : ""}タグ: ${g.tags.join(", ")}\n${g.sql}`
      )
      .join("\n\n");
  }

  return SQL_GENERATION_PROMPT.replace("{DB_TYPE}", dbType)
    .replace("{SCHEMA_TEXT}", schemaText || "（DB定義書が未設定です）")
    .replace("{METRICS_TEXT}", metricsText || DEFAULT_METRICS_TEXT)
    .replace("{GOLD_SQL_EXAMPLES}", goldSqlSection)
    .replace("{USER_INPUT}", userQuestion);
}

// 禁止SQL操作の検証
function validateGeneratedSql(sql: string): { valid: boolean; error?: string } {
  const forbidden = [
    /\bINSERT\b/i,
    /\bUPDATE\b/i,
    /\bDELETE\b/i,
    /\bMERGE\b/i,
    /\bDROP\b/i,
    /\bALTER\b/i,
    /\bTRUNCATE\b/i,
    /\bCREATE\b/i,
  ];

  for (const pattern of forbidden) {
    if (pattern.test(sql)) {
      return {
        valid: false,
        error: `禁止されたSQL操作が検出されました: ${pattern.source}`,
      };
    }
  }

  if (!/\bSELECT\b/i.test(sql)) {
    return { valid: false, error: "SELECT文が含まれていません" };
  }

  return { valid: true };
}

export async function generateSql(
  params: GenerateSqlParams
): Promise<GenerateSqlResult> {
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const temperature = 0;
  const promptVersion = "v1.0";

  const prompt = buildPrompt(params);

  const response = await openai.chat.completions.create({
    model,
    temperature,
    messages: [
      {
        role: "system",
        content:
          "あなたはSQLジェネレーターです。出力はSQLのみです。説明文やMarkdownは一切含めないでください。",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 4096,
  });

  let sql = response.choices[0]?.message?.content?.trim() || "";

  // Markdownコードブロックが含まれている場合は除去
  sql = sql.replace(/^```(?:sql)?\n?/i, "").replace(/\n?```$/i, "");
  sql = sql.trim();

  // 生成SQLの検証
  const validation = validateGeneratedSql(sql);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return {
    sql,
    model,
    temperature,
    promptVersion,
  };
}
