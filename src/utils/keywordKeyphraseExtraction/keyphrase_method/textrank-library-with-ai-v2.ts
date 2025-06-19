import { GoogleGenerativeAI } from "@google/generative-ai";
import { textrankKeyphraseExtractor } from "./textrank-library";
import dotenv from "dotenv";
dotenv.config();

// Gemini設定インターフェース
interface GeminiSummaryConfig {
  maxLength: number; // 最大文字数
  focus: string[]; // 重視する要素
  removeNoise: string[]; // 除外する要素
  model: string; // 使用モデル
}

// デフォルト設定（日本語イベント説明文最適化）
const DEFAULT_GEMINI_CONFIG: GeminiSummaryConfig = {
  maxLength: 200, // 元の1/3程度に圧縮
  focus: ["学習内容", "技術要素", "対象者", "特徴", "スキル", "手法"],
  removeNoise: [
    "講師紹介",
    "会社情報",
    "申込方法",
    "連絡先",
    "参加費",
    "タイムスケジュール",
  ],
  model: "gemini-2.0-flash-exp",
};

// グローバルにGemini AIインスタンスを保持（初期化コストを削減）
let genAI: GoogleGenerativeAI | null = null;

/**
 * Gemini AIの初期化
 */
const initializeGeminiAI = (): GoogleGenerativeAI => {
  if (genAI) {
    return genAI;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  console.log("🚀 Gemini AI を初期化中...");
  genAI = new GoogleGenerativeAI(apiKey);
  console.log("✅ Gemini AI 初期化完了");

  return genAI;
};

/**
 * Gemini AIを使用してテキストを要約
 * @param text 要約対象のテキスト
 * @param config 要約設定
 * @returns 要約されたテキスト
 */
const summarizeWithGemini = async (
  text: string,
  config: GeminiSummaryConfig = DEFAULT_GEMINI_CONFIG
): Promise<string> => {
  try {
    console.log("🤖 Gemini AI による要約処理開始...");
    console.log(`📝 入力テキスト長: ${text.length}文字`);

    if (!text || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です");
      return "";
    }

    // 短いテキストはそのまま返す
    if (text.length <= config.maxLength) {
      console.log("📋 テキストが既に十分短いため、そのまま返します");
      return text;
    }

    const ai = initializeGeminiAI();
    const model = ai.getGenerativeModel({ model: config.model });

    const prompt = `
以下のイベント説明文を、キーフレーズ抽出に最適な形で要約してください。

【要約条件】
- 最大${config.maxLength}文字以内
- 重視する要素: ${config.focus.join(", ")}
- 除外する要素: ${config.removeNoise.join(", ")}
- 技術用語は正確に保持
- 学習目標・対象者・手法を明確に
- 冗長な説明は削除し、核心部分のみを抽出
- 文章は自然で読みやすく

【元テキスト】
${text}

【要約文】
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    if (!summary || summary.trim().length === 0) {
      console.log("⚠️ Gemini API から有効な要約が取得できませんでした");
      // フォールバック: 元テキストの最初の部分を返す
      return text.substring(0, config.maxLength);
    }

    const finalSummary = summary.trim();
    console.log(
      `✅ Gemini AI 要約完了: ${text.length}文字 → ${finalSummary.length}文字`
    );
    console.log(`📄 要約内容: ${finalSummary.substring(0, 100)}...`);

    return finalSummary;
  } catch (error) {
    console.error("❌ Gemini AI 要約処理エラー:", error);

    // フォールバック処理：元テキストを短縮
    console.log("🔄 フォールバック処理: 元テキストを短縮して返します");
    return text.substring(0, config.maxLength);
  }
};

/**
 * AI要約前処理型TextRankキーフレーズ抽出メイン関数
 * @param text 分析対象の文章
 * @param config Gemini要約設定（オプション）
 * @returns 重要文の配列（重要度順）
 */
export const geminiSummaryToTextRankExtractor = async (
  text: string,
  config: GeminiSummaryConfig = DEFAULT_GEMINI_CONFIG
): Promise<string[]> => {
  try {
    console.log("\n🎯 Gemini AI要約 + TextRank キーフレーズ抽出開始");
    console.log(`📊 処理モード: ${config.model}`);

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です");
      return [];
    }

    // Step 1: Gemini AIで要約
    const summary = await summarizeWithGemini(text, config);

    if (!summary || summary.trim().length === 0) {
      console.log("⚠️ 要約処理に失敗しました");
      return [];
    }

    // Step 2: 要約されたテキストでTextRank抽出
    console.log("🔄 要約テキストにTextRank適用中...");
    const keyphrases = await textrankKeyphraseExtractor(summary);

    console.log(
      `🏆 Gemini AI要約 + TextRank 抽出完了: ${keyphrases.length}文を抽出`
    );
    console.log("📋 最終抽出結果:", keyphrases);

    return keyphrases;
  } catch (error) {
    console.error("❌ Gemini AI要約 + TextRank 処理で予期せぬエラー:", error);

    // フォールバック処理：従来のTextRankのみ実行
    try {
      console.log("🔄 フォールバック処理: 従来のTextRankを実行中...");
      const fallbackKeyphrases = await textrankKeyphraseExtractor(text);
      return fallbackKeyphrases;
    } catch (fallbackError) {
      console.error("❌ フォールバック処理もエラー:", fallbackError);
      return [];
    }
  }
};

/**
 * 要約品質の分析・評価
 * @param originalText 元テキスト
 * @param summary 要約テキスト
 * @returns 要約品質レポート
 */
export const analyzeSummaryQuality = (
  originalText: string,
  summary: string
): {
  compressionRatio: number;
  lengthReduction: number;
  wordPreservation: number;
} => {
  const originalLength = originalText.length;
  const summaryLength = summary.length;

  // 圧縮率計算
  const compressionRatio = summaryLength / originalLength;
  const lengthReduction = originalLength - summaryLength;

  // 重要単語の保持率（簡易計算）
  const originalWords = new Set(
    originalText.match(/[ァ-ヴー]+|[ぁ-ゔー]+|[一-龠]+|[a-zA-Z]+/g) || []
  );
  const summaryWords = new Set(
    summary.match(/[ァ-ヴー]+|[ぁ-ゔー]+|[一-龠]+|[a-zA-Z]+/g) || []
  );

  const preservedWords = [...summaryWords].filter((word) =>
    originalWords.has(word)
  );
  const wordPreservation = preservedWords.length / originalWords.size;

  return {
    compressionRatio: Math.round(compressionRatio * 100) / 100,
    lengthReduction,
    wordPreservation: Math.round(wordPreservation * 100) / 100,
  };
};

/**
 * デバッグ用：要約とTextRankの詳細比較
 */
export const debugCompareResults = async (text: string): Promise<void> => {
  console.log("\n🔍 デバッグモード: Gemini要約前後の比較分析");

  // 1. 従来のTextRank
  console.log("\n--- 従来のTextRank結果 ---");
  const originalResults = await textrankKeyphraseExtractor(text);
  console.log("従来結果:", originalResults);

  // 2. Gemini要約
  const summary = await summarizeWithGemini(text);
  console.log("\n--- Gemini要約結果 ---");
  console.log("要約:", summary);

  // 3. 要約品質分析
  const quality = analyzeSummaryQuality(text, summary);
  console.log("\n--- 要約品質分析 ---");
  console.log(`圧縮率: ${quality.compressionRatio * 100}%`);
  console.log(`文字数削減: ${quality.lengthReduction}文字`);
  console.log(`単語保持率: ${quality.wordPreservation * 100}%`);

  // 4. AI要約後TextRank
  console.log("\n--- Gemini要約+TextRank結果 ---");
  const aiResults = await geminiSummaryToTextRankExtractor(text);
  console.log("AI結果:", aiResults);

  // 5. 結果比較
  console.log("\n--- 結果比較分析 ---");
  console.log(`従来結果数: ${originalResults.length}`);
  console.log(`AI結果数: ${aiResults.length}`);
  console.log(
    `結果の重複: ${
      originalResults.filter((r) => aiResults.includes(r)).length
    }個`
  );
};
