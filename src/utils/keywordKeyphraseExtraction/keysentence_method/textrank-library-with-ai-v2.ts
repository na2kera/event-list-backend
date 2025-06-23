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
  preserveTechTerms: boolean; // 技術用語強制保持
  structuredOutput: boolean; // 構造化出力
  minSentences: number; // 最小文数
}

// 改善されたデフォルト設定
const DEFAULT_GEMINI_CONFIG: GeminiSummaryConfig = {
  maxLength: 350, // 文字数制限を緩和（200→350）
  focus: [
    "プログラミング言語名",
    "技術要素",
    "学習内容",
    "対象者レベル",
    "手法・アプローチ",
    "具体的スキル",
    "ツール名",
  ],
  removeNoise: [
    "講師の経歴詳細",
    "会社創業歴史",
    "申込手順",
    "問い合わせ先",
    "参加者の感想",
    "詳細なタイムスケジュール",
  ],
  model: "gemini-2.0-flash-exp",
  preserveTechTerms: true, // 技術用語強制保持を有効
  structuredOutput: true, // 構造化出力を有効
  minSentences: 4, // 最小4文は確保
};

// 技術用語パターン（正規表現で検出）
const TECH_TERMS_PATTERNS = [
  /Python|Java|JavaScript|PHP|Ruby|Go|Rust|C\+\+|HTML|CSS/gi,
  /ChatGPT|GPT|AI|機械学習|データサイエンス|深層学習/gi,
  /React|Vue|Angular|Node\.js|Django|Flask|Laravel/gi,
  /AWS|Azure|GCP|Docker|Kubernetes|Git|GitHub/gi,
  /プログラミング|コーディング|開発|エンジニア|システム/gi,
];

// グローバルにGemini AIインスタンスを保持
let genAI: GoogleGenerativeAI | null = null;

/**
 * テキストから技術用語を抽出
 */
const extractTechTerms = (text: string): string[] => {
  const techTerms: string[] = [];

  TECH_TERMS_PATTERNS.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      techTerms.push(...matches);
    }
  });

  // 重複除去して返す
  return [...new Set(techTerms.map((term) => term.toLowerCase()))];
};

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
 * 改善されたGemini AIを使用したテキスト要約
 */
const summarizeWithGemini = async (
  text: string,
  config: GeminiSummaryConfig = DEFAULT_GEMINI_CONFIG
): Promise<string> => {
  try {
    console.log("�� Gemini AI による要約処理開始...");
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

    // 技術用語を事前抽出
    const techTerms = extractTechTerms(text);
    console.log(`🔧 検出された技術用語: ${techTerms.join(", ")}`);

    const ai = initializeGeminiAI();
    const model = ai.getGenerativeModel({ model: config.model });

    const structuredPrompt = config.structuredOutput
      ? `
【要約形式】
以下の形式で構造化して要約してください：

■学習内容: [具体的な技術・スキル]
■対象者: [レベル・属性]  
■手法: [学習方法・アプローチ]
■技術要素: [使用ツール・言語]
■特徴: [独自性・差別化要素]
`
      : "";

    const techTermsInstruction =
      config.preserveTechTerms && techTerms.length > 0
        ? `
【必須保持技術用語】
以下の技術用語は必ず要約に含めてください: ${techTerms.join(", ")}
`
        : "";

    const prompt = `
以下のイベント説明文を、キーフレーズ抽出に最適な形で要約してください。

【要約条件】
- 最大${config.maxLength}文字以内
- 最低${config.minSentences}文は確保
- 重視する要素: ${config.focus.join(", ")}
- 除外する要素: ${config.removeNoise.join(", ")}
- 技術用語・ツール名は正確に保持
- 具体的なスキル・内容を明記
- 抽象的な表現より具体的な情報を優先

${techTermsInstruction}

${structuredPrompt}

【元テキスト】
${text}

【要約文】
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let summary = response.text();

    if (!summary || summary.trim().length === 0) {
      console.log("⚠️ Gemini API から有効な要約が取得できませんでした");
      return text.substring(0, config.maxLength);
    }

    // 技術用語の強制追加（要約に含まれていない場合）
    if (config.preserveTechTerms) {
      const summaryTechTerms = extractTechTerms(summary);
      const missingTerms = techTerms.filter(
        (term) =>
          !summaryTechTerms.some((summaryTerm) =>
            summaryTerm.toLowerCase().includes(term.toLowerCase())
          )
      );

      if (missingTerms.length > 0) {
        console.log(`🔧 不足技術用語を追加: ${missingTerms.join(", ")}`);
        summary += ` 技術要素: ${missingTerms.join(", ")}を活用。`;
      }
    }

    const finalSummary = summary.trim();
    console.log(
      `✅ Gemini AI 要約完了: ${text.length}文字 → ${finalSummary.length}文字`
    );
    console.log(`📄 要約内容: ${finalSummary.substring(0, 150)}...`);

    return finalSummary;
  } catch (error) {
    console.error("❌ Gemini AI 要約処理エラー:", error);
    console.log("🔄 フォールバック処理: 元テキストを短縮して返します");
    return text.substring(0, config.maxLength);
  }
};

/**
 * 改善されたAI要約前処理型TextRankキーフレーズ抽出
 */
export const geminiSummaryToTextRankExtractor = async (
  text: string,
  config: GeminiSummaryConfig = DEFAULT_GEMINI_CONFIG
): Promise<string[]> => {
  try {
    console.log("\n🎯 改善版 Gemini AI要約 + TextRank キーフレーズ抽出開始");
    console.log(`📊 処理モード: ${config.model} (精度重視設定)`);

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です");
      return [];
    }

    // Step 1: 改善されたGemini AIで要約
    const summary = await summarizeWithGemini(text, config);

    if (!summary || summary.trim().length === 0) {
      console.log("⚠️ 要約処理に失敗しました");
      return [];
    }

    // Step 2: 要約されたテキストでTextRank抽出（設定調整）
    console.log("🔄 改善要約テキストにTextRank適用中...");
    const keyphrases = await textrankKeyphraseExtractor(summary);

    // Step 3: 技術用語の補完
    const techTerms = extractTechTerms(text);
    const enhancedKeyphrases = [...keyphrases];

    // 重要な技術用語がキーフレーズに含まれていない場合は追加
    techTerms.forEach((term) => {
      const termExists = enhancedKeyphrases.some((phrase) =>
        phrase.toLowerCase().includes(term.toLowerCase())
      );
      if (!termExists && enhancedKeyphrases.length < 6) {
        enhancedKeyphrases.push(`${term}を活用`);
      }
    });

    console.log(
      `🏆 改善版 Gemini AI要約 + TextRank 抽出完了: ${enhancedKeyphrases.length}文を抽出`
    );
    console.log("📋 最終抽出結果:", enhancedKeyphrases);

    return enhancedKeyphrases;
  } catch (error) {
    console.error(
      "❌ 改善版 Gemini AI要約 + TextRank 処理で予期せぬエラー:",
      error
    );

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
 * 要約品質の分析・評価（改善版）
 */
export const analyzeSummaryQuality = (
  originalText: string,
  summary: string
): {
  compressionRatio: number;
  lengthReduction: number;
  wordPreservation: number;
  techTermsPreservation: number;
} => {
  const originalLength = originalText.length;
  const summaryLength = summary.length;

  // 圧縮率計算
  const compressionRatio = summaryLength / originalLength;
  const lengthReduction = originalLength - summaryLength;

  // 重要単語の保持率
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

  // 技術用語の保持率
  const originalTechTerms = extractTechTerms(originalText);
  const summaryTechTerms = extractTechTerms(summary);
  const techTermsPreservation =
    originalTechTerms.length > 0
      ? summaryTechTerms.length / originalTechTerms.length
      : 1;

  return {
    compressionRatio: Math.round(compressionRatio * 100) / 100,
    lengthReduction,
    wordPreservation: Math.round(wordPreservation * 100) / 100,
    techTermsPreservation: Math.round(techTermsPreservation * 100) / 100,
  };
};

/**
 * デバッグ用：改善版要約とTextRankの詳細比較
 */
export const debugCompareResults = async (text: string): Promise<void> => {
  console.log("\n🔍 改善版デバッグモード: Gemini要約前後の比較分析");

  // 1. 従来のTextRank
  console.log("\n--- 従来のTextRank結果 ---");
  const originalResults = await textrankKeyphraseExtractor(text);
  console.log("従来結果:", originalResults);

  // 2. 改善版Gemini要約
  const summary = await summarizeWithGemini(text);
  console.log("\n--- 改善版Gemini要約結果 ---");
  console.log("要約:", summary);

  // 3. 技術用語分析
  const originalTechTerms = extractTechTerms(text);
  const summaryTechTerms = extractTechTerms(summary);
  console.log("\n--- 技術用語分析 ---");
  console.log(`元テキストの技術用語: ${originalTechTerms.join(", ")}`);
  console.log(`要約の技術用語: ${summaryTechTerms.join(", ")}`);

  // 4. 改善版要約品質分析
  const quality = analyzeSummaryQuality(text, summary);
  console.log("\n--- 改善版要約品質分析 ---");
  console.log(`圧縮率: ${quality.compressionRatio * 100}%`);
  console.log(`文字数削減: ${quality.lengthReduction}文字`);
  console.log(`単語保持率: ${quality.wordPreservation * 100}%`);
  console.log(`技術用語保持率: ${quality.techTermsPreservation * 100}%`);

  // 5. 改善版AI要約後TextRank
  console.log("\n--- 改善版Gemini要約+TextRank結果 ---");
  const aiResults = await geminiSummaryToTextRankExtractor(text);
  console.log("改善版AI結果:", aiResults);

  // 6. 結果比較
  console.log("\n--- 改善版結果比較分析 ---");
  console.log(`従来結果数: ${originalResults.length}`);
  console.log(`改善版AI結果数: ${aiResults.length}`);
  console.log(
    `結果の重複: ${
      originalResults.filter((r) => aiResults.includes(r)).length
    }個`
  );
};
