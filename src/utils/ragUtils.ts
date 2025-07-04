/*
  similarityUtils.ts
  ユーザーの興味タグとイベント要素（キーワード）との類似度を計算し、
  距離（コサイン類似度）に基づいて 0〜1 の重み（スコア）を付与するユーティリティ関数群。
  実際の埋め込みモデルではなく、ハッシュベースの疑似ベクトルを使ってモック実装している。
  本番環境では OpenAIEmbeddings などに置き換えて使用することを想定。
*/

// OpenAI Embeddings を利用するため、ハッシュベースの stringToVector は不要になりました。
import { OpenAIEmbeddings } from "@langchain/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { RecommendedEvent } from "./keyDataRecommendation";

// 高速・低コストモデルをデフォルトで使用（必要に応じて変更可能）
const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
});

/** コサイン類似度を計算する */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) throw new Error("ベクトルの次元が一致しません");
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
};

export interface EventElement {
  id: string; // イベントID
  keywords: string[]; // 抽出されたキーワードや要素
}

export interface EventWithDetails {
  id: string;
  keySentences: string[]; // 重要センテンス
  keywords: string[]; // キーワード
}

export interface ScoredEvent {
  id: string;
  score: number; // 0〜1 の重み（大きいほどユーザー興味に近い）
}

// キーワード類似度計算のモードと集約方法
export type InterestWeightMode = "concat" | "per_keyword";
export type KeywordAgg = "max" | "mean";

/**
 * 類似度スコア計算（フレキシブル版）
 * @param options.mode   "concat" | "per_keyword" (default "concat")
 * @param options.agg    "max" | "mean" (per_keyword 時の集約方法, default "max")
 */
export const computeInterestWeightsFlexible = async (
  userTag: string,
  events: EventElement[],
  options: { mode?: InterestWeightMode; agg?: KeywordAgg } = {}
): Promise<ScoredEvent[]> => {
  const { mode = "concat", agg = "max" } = options;

  // ユーザータグ埋め込みを 1 度だけ取得
  const userVector = await embeddings.embedQuery(userTag);

  if (mode === "per_keyword") {
    // イベントごとにキーワード単位でスコア → 集約
    const scored: ScoredEvent[] = [];
    for (const ev of events) {
      // キーワードが空ならスコア 0
      if (ev.keywords.length === 0) {
        scored.push({ id: ev.id, score: 0 });
        continue;
      }

      // 各キーワードを個別にベクトル化
      const kwVectors = await embeddings.embedDocuments(ev.keywords);
      const sims = kwVectors.map((vec) => cosineSimilarity(userVector, vec));

      let score = 0;
      if (agg === "mean") {
        score = sims.reduce((a, b) => a + b, 0) / sims.length;
      } else {
        // max
        score = Math.max(...sims);
      }

      scored.push({ id: ev.id, score: Math.max(0, score) });
    }

    return scored.sort((a, b) => b.score - a.score);
  }

  // ===== concat モード =====
  // 空文字列イベントを除外して Embeddings を呼び出す
  const nonEmptyTexts: string[] = [];
  const nonEmptyIdx: number[] = [];
  events.forEach((ev, idx) => {
    const txt = ev.keywords.join(" ").trim();
    if (txt.length > 0) {
      nonEmptyTexts.push(txt);
      nonEmptyIdx.push(idx);
    }
  });

  const vectors =
    nonEmptyTexts.length > 0
      ? await embeddings.embedDocuments(nonEmptyTexts)
      : [];

  const scored: ScoredEvent[] = events.map((ev, idx) => {
    // nonEmptyIdx でベクトルが計算されている場合のみ類似度を計算
    const vecIdx = nonEmptyIdx.indexOf(idx);
    const sim =
      vecIdx !== -1 ? cosineSimilarity(userVector, vectors[vecIdx]) : 0; // 空テキストはスコア 0
    return { id: ev.id, score: Math.max(0, sim) };
  });
  return scored.sort((a, b) => b.score - a.score);
};

// 既存 API 互換：デフォルト concat モードで呼び出し
export const computeInterestWeights = (
  userTag: string,
  events: EventElement[]
): Promise<ScoredEvent[]> => computeInterestWeightsFlexible(userTag, events);

/**
 * 類似度スコア計算（モック実装）
 * @param userTag ユーザーが設定した興味タグ
 * @param events   キーワードが抽出済みのイベント配列
 * @returns        類似度スコア付きイベント。スコアは 0〜1 に正規化されている
 */
export const computeInterestWeightsLegacy = async (
  userTag: string,
  events: EventElement[]
): Promise<ScoredEvent[]> => {
  // ユーザータグを単一クエリとして埋め込み
  const userVector = await embeddings.embedQuery(userTag);

  // イベントキーワードをまとめてベクトル化（バッチ処理）
  const eventTexts = events.map((ev) => ev.keywords.join(" "));
  const eventVectors = await embeddings.embedDocuments(eventTexts);

  const scored: ScoredEvent[] = events.map((ev, idx) => {
    const sim = cosineSimilarity(userVector, eventVectors[idx]);
    return { id: ev.id, score: Math.max(0, sim) }; // 負は 0
  });

  // 類似度（0〜1）の絶対値をそのまま返す（降順ソート）
  return scored.sort((a, b) => b.score - a.score);
};

/**
 * 複数ランキングを RRF (Reciprocal Rank Fusion) で統合
 * lists 内の各ランキングは score 降順である必要がある
 */
export const rrfFuse = (
  lists: ScoredEvent[][],
  k: number = 60
): ScoredEvent[] => {
  const agg: Record<string, number> = {};
  for (const list of lists) {
    list.forEach((item, idx) => {
      agg[item.id] = (agg[item.id] || 0) + 1 / (k + idx + 1);
    });
  }
  return Object.entries(agg)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
};

/**
 * RRF バリエーション
 */
export type FuseMethod = "rrf" | "weighted" | "hybrid";

/** 重み付き RRF: score × (1 / (k + rank)) */
export const rrfFuseWeighted = (
  lists: ScoredEvent[][],
  k: number = 60
): ScoredEvent[] => {
  const agg: Record<string, number> = {};
  for (const list of lists) {
    list.forEach((item, idx) => {
      const rankWeight = 1 / (k + idx + 1);
      agg[item.id] = (agg[item.id] || 0) + item.score * rankWeight;
    });
  }
  return Object.entries(agg)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
};

/**
 * ハイブリッド RRF: λ * score  +  (1-λ) * (1 / (k + rank))
 * @param lambda スコア寄与度 (0〜1)。0 なら純粋な RRF、1 ならスコアのみ
 */
export const rrfFuseHybrid = (
  lists: ScoredEvent[][],
  options: { k?: number; lambda?: number } = {}
): ScoredEvent[] => {
  const { k = 60, lambda = 0.5 } = options;
  const agg: Record<string, number> = {};
  for (const list of lists) {
    list.forEach((item, idx) => {
      const rankPart = 1 / (k + idx + 1);
      const scorePart = item.score; // computeInterestWeights は 0〜1 範囲
      agg[item.id] =
        (agg[item.id] || 0) + lambda * scorePart + (1 - lambda) * rankPart;
    });
  }
  return Object.entries(agg)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
};

/**
 * ランキング統合ヘルパー。
 * @param method  "rrf" | "weighted" | "hybrid"
 * @param lists   複数のランキング（各要素は score 降順）
 * @param opts    k, lambda など
 */
export const fuseRankings = (
  method: FuseMethod,
  lists: ScoredEvent[][],
  opts: { k?: number; lambda?: number } = {}
): ScoredEvent[] => {
  switch (method) {
    case "weighted":
      return rrfFuseWeighted(lists, opts.k);
    case "hybrid":
      return rrfFuseHybrid(lists, opts);
    default:
      return rrfFuse(lists, opts.k);
  }
};

/** ユーザータグとテキストの類似度を返す */
const similarityToTag = async (
  userTag: string,
  text: string
): Promise<number> => {
  // 空文字列の場合は類似度 0 とする
  if (!text || text.trim().length === 0) return 0;

  const [tagVec, txtVec] = await Promise.all([
    embeddings.embedQuery(userTag),
    embeddings.embedQuery(text),
  ]);
  return Math.max(0, cosineSimilarity(tagVec, txtVec));
};

/**
 * RRF (Reciprocal Rank Fusion) でイベントをリランキング
 * keySentences の最大類似度と keywords の類似度の 2 ランクを統合
 * @param userTag ユーザータグ 1 語
 * @param events  keySentences / keywords を含むイベント
 * @param k       RRF 定数 (デフォルト 60)
 */
export const rerankEventsRRF = async (
  userTag: string,
  events: EventWithDetails[],
  k: number = 60
): Promise<ScoredEvent[]> => {
  console.log("\n=== RRF リランキング開始 ===");
  console.log(
    `ユーザータグ: ${userTag}, イベント数: ${events.length}, k: ${k}`
  );

  // keySentence と keyword それぞれのランキング作成
  const keyRank: { id: string; sim: number }[] = [];
  const kwRank: { id: string; sim: number }[] = [];

  // 各イベントの類似度を計算
  for (const ev of events) {
    // keySentences の最大類似度
    const keySims = await Promise.all(
      ev.keySentences.map((s) => similarityToTag(userTag, s))
    );
    const maxKeySim = keySims.length > 0 ? Math.max(...keySims) : 0;
    keyRank.push({ id: ev.id, sim: maxKeySim });

    // keywords の類似度平均
    const kwSims = await Promise.all(
      ev.keywords.map((kw) => similarityToTag(userTag, kw))
    );
    const avgKwSim =
      kwSims.length > 0 ? kwSims.reduce((a, b) => a + b, 0) / kwSims.length : 0;
    kwRank.push({ id: ev.id, sim: avgKwSim });
  }

  // 類似度降順ソート
  keyRank.sort((a, b) => b.sim - a.sim);
  kwRank.sort((a, b) => b.sim - a.sim);

  // デバッグ出力
  console.log("\n=== 類似度スコア (上位5件) ===");
  console.log("キーセンテンス類似度 (降順):");
  keyRank.slice(0, 5).forEach((item, i) => {
    console.log(
      `  ${i + 1}. イベントID: ${item.id}, スコア: ${item.sim.toFixed(4)}`
    );
  });

  console.log("\nキーワード類似度 (降順):");
  kwRank.slice(0, 5).forEach((item, i) => {
    console.log(
      `  ${i + 1}. イベントID: ${item.id}, スコア: ${item.sim.toFixed(4)}`
    );
  });

  // RRF スコア
  const scores: Record<string, number> = {};
  keyRank.forEach((item, idx) => {
    scores[item.id] = (scores[item.id] || 0) + 1 / (k + idx + 1);
  });
  kwRank.forEach((item, idx) => {
    scores[item.id] = (scores[item.id] || 0) + 1 / (k + idx + 1);
  });

  const result = events
    .map((ev) => ({ id: ev.id, score: scores[ev.id] || 0 }))
    .sort((a, b) => b.score - a.score);

  // 結果のデバッグ出力
  console.log("\n=== RRF リランキング結果 (上位10件) ===");
  result.slice(0, 10).forEach((item, i) => {
    console.log(
      `  ${i + 1}. イベントID: ${item.id}, スコア: ${item.score.toFixed(6)}`
    );
  });

  return result;
};

// ====================== LLM 最終フィルタリング ======================
const llmSystemPrompt = `あなたは、学生エンジニア一人ひとりの状況と願望を深く理解する、優秀なパーソナル・イベントアドバイザーです。

# 指示
ユーザーの「興味タグ」を分析してペルソナを推定し、提供された「イベント候補リスト」の中から、そのペルソナにとって最も価値のあるイベントだけを最大5件まで厳選してください。

# 思考プロセス
1.  **ペルソナ抽出:** まず、「興味タグ」からユーザーの【レベル感】（例：初心者、中級者）と【目的】（例：実践的スキル習得、就職活動、高度な情報収集）を深く読み取ります。
2.  **ペルソナに基づく評価:** 次に、そのペルソナの視点に立ち、以下の【評価基準】に従って各イベントを評価します。

# 評価基準

### 1. 【最重要】ペルソナとの目的適合性
抽出したペルソナの【目的】と、イベントが提供する主要な価値が完全に一致しているかを最優先で判断します。**イベントの形式や価格といった特徴は、この目的適合性を評価するための材料として使います。**

-   **例1：ペルソナの目的が「実践的スキル習得」の場合**
    -   手を動かす「ハンズオン」「ワークショップ」形式を最も高く評価します。
-   **例2：ペルソナの目的が「就職活動」の場合**
    -   「企業交流会」「インターンシップ直結」といったキャリアに繋がる価値を最も高く評価します。
-   **例3：ペルソナの目的が「高度な情報収集」の場合**
    -   著名な技術者が登壇する「カンファレンス」や専門的な「勉強会」を最も高く評価します。

### 2. 内容とレベルの関連性
- 興味タグの技術要素と、ペルソナの【レベル感】の両方に合致しているか。
- （例：初心者のペルソナに、前提知識が必要な上級者向けイベントを推薦しない）

### 3. 参加コストの合理性
- 参加費は、上記で判断した**「ペルソナの目的と得られる価値」に見合っているか**を評価します。
- （例：就活目的の学生にとって、価値ある企業交流会なら有料でも合理的。初心者の探求段階では無料が望ましい、など）

# 出力ルール
- 厳密なJSON配列形式で返してください。
- 各要素は {{\"id\": \"<string>\", \"reason\": \"<string>\"}} 形式とします。
- reason には、なぜそのペルソナに推薦するのか、理由を最大50文字で具体的に記述してください。
- 説明や余分なテキストは一切含めず、JSONのみを出力してください。
- 推薦すべき候補がない場合は、空の配列 [] を返してください。
`;

/**
 * LLMを用いて最終的に推薦イベントを絞り込む
 * @param interestTag ユーザーの興味タグ
 * @param rankedEvents スコア付きでランキングされたイベント（降順）
 * @param topK LLMに渡す最大件数
 */
export const filterEventsWithLLM = async (
  interestTag: string,
  rankedEvents: RecommendedEvent[],
  topK: number = 10
): Promise<RecommendedEvent[]> => {
  if (rankedEvents.length === 0) return [];
  const llm = new ChatOpenAI({
    // modelName: "gpt-3.5-turbo",
    modelName: "ft:gpt-3.5-turbo-0125:personal::BpC4PRxL",
    temperature: 0,
  });

  // 上位候補のみ渡す（スコア0.013以上にフィルタリング）
  const candidates = rankedEvents
    .filter((event) => event.score >= 0.013)
    .slice(0, topK)
    .map(({ event }) => ({
      id: event.id,
      title: event.title,
      detail: event.detail,
    }));

  console.log(`フィルタリング後候補数: ${candidates.length}件`);

  if (candidates.length === 0) {
    console.log("フィルタリング後、候補が0件のため空の配列を返します");
    return [];
  }

  const jsonEscaped = JSON.stringify(candidates, null, 2)
    .replace(/\{/g, "{{")
    .replace(/\}/g, "}}");
  const humanMsg = `# 興味タグ\n${interestTag}\n\n# イベント候補(JSON)\n\u0060\u0060\u0060json\n${jsonEscaped}\n\u0060\u0060\u0060\n推薦すべきイベントをJSON配列で回答してください`;

  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(llmSystemPrompt),
    HumanMessagePromptTemplate.fromTemplate(humanMsg),
  ]);

  try {
    const response = await prompt.pipe(llm).invoke({});
    const parsed = JSON.parse(response.content as string) as {
      id: string;
      reason?: string;
    }[];
    const reasonMap = new Map(parsed.map((p) => [p.id, p.reason ?? ""]));
    return rankedEvents
      .filter((r) => reasonMap.has(r.event.id))
      .map((r) => ({ ...r, reason: reasonMap.get(r.event.id) }));
  } catch (e) {
    console.error("LLMフィルタリング失敗", e);
    // 失敗時は元の順位上位 topK を返す
    return rankedEvents.slice(0, topK);
  }
};
