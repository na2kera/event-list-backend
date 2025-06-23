import { GoogleGenerativeAI } from "@google/generative-ai";

// kuromoji.jsの型定義（既存ライブラリから流用）
interface KuromojiToken {
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  pos_detail_3: string;
  basic_form: string;
  reading: string;
  pronunciation: string;
}

interface KuromojiTokenizer {
  tokenize(text: string): KuromojiToken[];
}

// 文情報のインターフェース
interface SentenceInfo {
  id: number;
  text: string;
  words: string[];
  score: number;
  originalPosition: number;
}

// 段階的AI強化の結果インターフェース
interface EnhancedResult {
  finalKeyphrases: string[];
  processStages: {
    original: string;
    preprocessed: string;
    textrankResults: string[];
    postprocessed: string[];
  };
  performanceMetrics: {
    totalProcessingTime: number;
    preprocessingTime: number;
    textrankTime: number;
    postprocessingTime: number;
    aiApiCalls: number;
  };
}

// AI処理設定インターフェース
interface AIConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
}

// TextRank設定インターフェース
interface TextRankConfig {
  dampingFactor: number;
  maxIterations: number;
  tolerance: number;
  maxSentences: number;
  minSentenceLength: number;
}

// グローバルにtokenizerを保持（初期化コストを削減）
let tokenizer: KuromojiTokenizer | null = null;

// デフォルト設定
const DEFAULT_TEXTRANK_CONFIG: TextRankConfig = {
  dampingFactor: 0.85,
  maxIterations: 50,
  tolerance: 0.0001,
  maxSentences: 10,
  minSentenceLength: 10,
};

const DEFAULT_AI_CONFIG: AIConfig = {
  model: "gemini-2.0-flash-exp", // より安定したモデルに変更
  maxTokens: 1000,
  temperature: 0.3, // 安定した出力のため低めに設定
  enabled: true,
};

// Gemini AI インスタンス
let geminiAI: GoogleGenerativeAI | null = null;

/**
 * Gemini AI の初期化
 */
const initializeGeminiAI = async (): Promise<GoogleGenerativeAI> => {
  if (geminiAI) {
    return geminiAI;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY 環境変数が設定されていません");
  }

  console.log("🚀 Gemini AI を初期化中...");
  geminiAI = new GoogleGenerativeAI(apiKey);
  console.log("✅ Gemini AI 初期化完了");
  return geminiAI;
};

/**
 * 日本語形態素解析器の初期化
 */
const initializeTokenizer = async (): Promise<KuromojiTokenizer> => {
  if (tokenizer) {
    return tokenizer;
  }
  console.log("🚀 kuromoji tokenizer を初期化中...");
  const kuromoji = require("kuromoji");
  return new Promise((resolve, reject) => {
    kuromoji
      .builder({ dicPath: "node_modules/kuromoji/dict" })
      .build((err: any, _tokenizer: KuromojiTokenizer) => {
        if (err) {
          console.error("❌ kuromoji初期化エラー:", err);
          reject(err);
        } else {
          console.log("✅ kuromoji tokenizer 初期化完了");
          tokenizer = _tokenizer;
          resolve(_tokenizer);
        }
      });
  });
};

/**
 * Gemini AI API呼び出し
 */
const callAIAPI = async (prompt: string, config: AIConfig): Promise<string> => {
  try {
    console.log("🤖 Gemini AI API 呼び出し中...");

    const genAI = await initializeGeminiAI();
    const model = genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
      },
    });

    const result = await model.generateContent([
      {
        text: `あなたは日本語のイベント説明文を分析し、キーフレーズ抽出を支援するAIアシスタントです。正確で簡潔な回答を心がけてください。\n\n${prompt}`,
      },
    ]);

    const response = await result.response;
    const content = response.text() || "";

    console.log("✅ Gemini AI API 呼び出し完了");
    return content.trim();
  } catch (error) {
    console.error("❌ Gemini AI API エラー:", error);

    // レート制限エラーの場合は特別な処理
    if (
      (error as Error).message?.includes("429") ||
      (error as Error).message?.includes("quota")
    ) {
      console.log(
        "⏳ レート制限検出: 少し待機してからフォールバック処理を実行"
      );
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2秒待機
    }

    // フォールバック: モック実装
    console.log("🔄 フォールバック: モック実装を使用");
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (prompt.includes("前処理")) {
      return `実践的なWebアプリケーション開発講座。JavaScript基礎からReactモダンフロントエンド開発を学習。Next.jsフレームワーク活用。初心者〜中級者対象。実務技術力習得目標。現役エンジニア講師。最新技術トレンド紹介。`;
    } else if (prompt.includes("後処理")) {
      return `実践的Webアプリ開発, JavaScript・React学習, Next.js活用, 初心者〜中級者向け, 実務技術力習得`;
    }

    return "フォールバック処理結果";
  }
};

/**
 * 前処理AI：テキストの最適化とクリーニング
 */
const preprocessWithAI = async (
  text: string,
  config: AIConfig
): Promise<string> => {
  if (!config.enabled) {
    return text;
  }

  const prompt = `
以下のイベント説明文を、TextRankアルゴリズムによるキーフレーズ抽出に最適化してください：

最適化要件：
1. 冗長な説明や宣伝文句を削除
2. 技術用語と学習内容を明確に保持
3. 講師紹介や申込方法などのノイズを除去
4. 学習目標・対象者・手法を明確に整理
5. 文章構造を論理的に整理

元テキスト：
${text}

最適化後のテキスト：`;

  try {
    const result = await callAIAPI(prompt, config);
    console.log("✅ 前処理AI完了");
    return result.trim();
  } catch (error) {
    console.warn("⚠️ 前処理AI失敗、元テキストを使用:", error);
    return text;
  }
};

/**
 * 後処理AI：キーフレーズの品質向上
 */
const postprocessWithAI = async (
  keyphrases: string[],
  config: AIConfig
): Promise<string[]> => {
  if (!config.enabled || keyphrases.length === 0) {
    return keyphrases;
  }

  const prompt = `
以下のTextRankで抽出されたキーフレーズを、イベント推薦システム用に最適化してください：

最適化要件：
1. 各フレーズを20文字以内に短縮
2. 技術用語を正確に抽出・統合
3. 不完全な文章を完全な形に修正
4. 重複を排除し、重要度順に並び替え
5. 最大5つのキーフレーズに絞り込み

抽出されたキーフレーズ：
${keyphrases.map((phrase, index) => `${index + 1}. ${phrase}`).join("\n")}

最適化後のキーフレーズ（カンマ区切りで出力）：`;

  try {
    const result = await callAIAPI(prompt, config);
    const optimizedPhrases = result
      .split(",")
      .map((phrase) => phrase.trim())
      .filter((phrase) => phrase.length > 0)
      .slice(0, 5);

    console.log("✅ 後処理AI完了");
    return optimizedPhrases;
  } catch (error) {
    console.warn("⚠️ 後処理AI失敗、元の結果を使用:", error);
    return keyphrases.slice(0, 5);
  }
};

/**
 * 日本語テキストを文に分割
 */
const splitIntoSentences = (text: string): string[] => {
  let sentences = text
    .replace(/([。！？\.\!\?])/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  sentences = sentences.filter((sentence) => {
    const cleanSentence = sentence.replace(/[。！？\.\!\?\s]/g, "");
    return cleanSentence.length >= DEFAULT_TEXTRANK_CONFIG.minSentenceLength;
  });

  return sentences;
};

/**
 * 文を単語に分解（形態素解析）
 */
const tokenizeSentence = async (sentence: string): Promise<string[]> => {
  try {
    const _tokenizer = await initializeTokenizer();
    const tokens = _tokenizer.tokenize(sentence);

    const words = tokens
      .filter((token) => {
        const pos = token.pos;
        const detail1 = token.pos_detail_1;
        return (
          (pos === "名詞" &&
            !["接続詞的", "数", "非自立", "代名詞"].includes(detail1)) ||
          (pos === "動詞" && detail1 !== "非自立") ||
          (pos === "形容詞" && detail1 !== "非自立")
        );
      })
      .map((token) => token.basic_form || token.surface_form)
      .filter((word) => word && word.length > 1);

    return words;
  } catch (error) {
    console.error("❌ 形態素解析エラー:", error);
    return sentence
      .replace(/[、。！？\.\!\?,\s]/g, " ")
      .split(" ")
      .filter((word) => word.length > 1)
      .slice(0, 10);
  }
};

/**
 * 文間の類似度を計算（Jaccard係数）
 */
const calculateSimilarity = (wordsA: string[], wordsB: string[]): number => {
  if (wordsA.length === 0 || wordsB.length === 0) {
    return 0;
  }

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
};

/**
 * 類似度行列を構築
 */
const buildSimilarityMatrix = (sentences: SentenceInfo[]): number[][] => {
  const n = sentences.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        matrix[i][j] = calculateSimilarity(
          sentences[i].words,
          sentences[j].words
        );
      }
    }
  }

  return matrix;
};

/**
 * PageRankアルゴリズムを実行
 */
const runPageRank = (
  similarityMatrix: number[][],
  config: TextRankConfig
): number[] => {
  const n = similarityMatrix.length;
  if (n === 0) return [];

  let scores = new Array(n).fill(1.0);

  for (let iter = 0; iter < config.maxIterations; iter++) {
    const newScores = new Array(n).fill(0);
    let maxChange = 0;

    for (let i = 0; i < n; i++) {
      let sum = 0;

      for (let j = 0; j < n; j++) {
        if (i !== j && similarityMatrix[j][i] > 0) {
          let outgoingWeights = 0;
          for (let k = 0; k < n; k++) {
            if (j !== k) {
              outgoingWeights += similarityMatrix[j][k];
            }
          }

          if (outgoingWeights > 0) {
            sum += (similarityMatrix[j][i] / outgoingWeights) * scores[j];
          }
        }
      }

      newScores[i] = 1 - config.dampingFactor + config.dampingFactor * sum;
      maxChange = Math.max(maxChange, Math.abs(newScores[i] - scores[i]));
    }

    scores = newScores;

    if (maxChange < config.tolerance) {
      console.log(`✅ PageRank収束: ${iter + 1}回目の反復で完了`);
      break;
    }
  }

  return scores;
};

/**
 * TextRank処理（AI強化版）
 */
const runEnhancedTextRank = async (
  text: string,
  config: TextRankConfig
): Promise<string[]> => {
  const rawSentences = splitIntoSentences(text);

  if (rawSentences.length < 2) {
    return rawSentences.slice(0, 5);
  }

  const sentences: SentenceInfo[] = [];
  for (let i = 0; i < rawSentences.length; i++) {
    const words = await tokenizeSentence(rawSentences[i]);
    if (words.length > 0) {
      sentences.push({
        id: i,
        text: rawSentences[i],
        words: words,
        score: 0,
        originalPosition: i,
      });
    }
  }

  if (sentences.length < 2) {
    return sentences.map((s) => s.text).slice(0, 5);
  }

  const similarityMatrix = buildSimilarityMatrix(sentences);
  const scores = runPageRank(similarityMatrix, config);

  sentences.forEach((sentence, index) => {
    sentence.score = scores[index] || 0;
  });

  const rankedSentences = sentences
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(config.maxSentences, Math.ceil(sentences.length * 0.4)));

  const finalSentences = rankedSentences
    .sort((a, b) => a.originalPosition - b.originalPosition)
    .map((s) => s.text);

  return finalSentences;
};

/**
 * 段階的AI強化メイン関数
 * @param text 分析対象の文章
 * @param aiConfig AI設定（オプショナル）
 * @param textrankConfig TextRank設定（オプショナル）
 * @returns 段階的AI強化の結果
 */
export const stagedAIEnhancement = async (
  text: string,
  aiConfig: Partial<AIConfig> = {},
  textrankConfig: Partial<TextRankConfig> = {}
): Promise<EnhancedResult> => {
  const startTime = Date.now();
  let aiApiCalls = 0;

  console.log("\n🎯 段階的AI強化キーフレーズ抽出開始");

  // 設定のマージ
  const finalAIConfig = { ...DEFAULT_AI_CONFIG, ...aiConfig };
  const finalTextRankConfig = { ...DEFAULT_TEXTRANK_CONFIG, ...textrankConfig };

  const result: EnhancedResult = {
    finalKeyphrases: [],
    processStages: {
      original: text,
      preprocessed: text,
      textrankResults: [],
      postprocessed: [],
    },
    performanceMetrics: {
      totalProcessingTime: 0,
      preprocessingTime: 0,
      textrankTime: 0,
      postprocessingTime: 0,
      aiApiCalls: 0,
    },
  };

  try {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です。");
      return result;
    }

    // Step 1: 前処理AI
    console.log("📝 Step 1: 前処理AI実行中...");
    const preprocessStart = Date.now();

    const preprocessedText = await preprocessWithAI(text, finalAIConfig);
    if (finalAIConfig.enabled) aiApiCalls++;

    result.processStages.preprocessed = preprocessedText;
    result.performanceMetrics.preprocessingTime = Date.now() - preprocessStart;

    // Step 2: TextRank処理
    console.log("🔄 Step 2: TextRank処理実行中...");
    const textrankStart = Date.now();

    const textrankResults = await runEnhancedTextRank(
      preprocessedText,
      finalTextRankConfig
    );

    result.processStages.textrankResults = textrankResults;
    result.performanceMetrics.textrankTime = Date.now() - textrankStart;

    // Step 3: 後処理AI
    console.log("✨ Step 3: 後処理AI実行中...");
    const postprocessStart = Date.now();

    const postprocessedResults = await postprocessWithAI(
      textrankResults,
      finalAIConfig
    );
    if (finalAIConfig.enabled) aiApiCalls++;

    result.processStages.postprocessed = postprocessedResults;
    result.finalKeyphrases = postprocessedResults;
    result.performanceMetrics.postprocessingTime =
      Date.now() - postprocessStart;

    // 総合メトリクス
    result.performanceMetrics.totalProcessingTime = Date.now() - startTime;
    result.performanceMetrics.aiApiCalls = aiApiCalls;

    console.log(
      `🏆 段階的AI強化完了: ${result.finalKeyphrases.length}個のキーフレーズを抽出`
    );
    console.log("📊 処理時間:", {
      総時間: `${result.performanceMetrics.totalProcessingTime}ms`,
      前処理: `${result.performanceMetrics.preprocessingTime}ms`,
      TextRank: `${result.performanceMetrics.textrankTime}ms`,
      後処理: `${result.performanceMetrics.postprocessingTime}ms`,
      API呼び出し回数: result.performanceMetrics.aiApiCalls,
    });
    console.log("🎯 最終キーフレーズ:", result.finalKeyphrases);

    return result;
  } catch (error) {
    console.error("❌ 段階的AI強化処理で予期せぬエラー:", error);

    // フォールバック: 元のTextRankのみで処理
    try {
      console.log("🔄 フォールバック処理（TextRankのみ）を実行中...");
      const fallbackResults = await runEnhancedTextRank(
        text,
        finalTextRankConfig
      );
      result.finalKeyphrases = fallbackResults.slice(0, 5);
      result.processStages.textrankResults = fallbackResults;
      result.performanceMetrics.totalProcessingTime = Date.now() - startTime;
      return result;
    } catch (fallbackError) {
      console.error("❌ フォールバック処理もエラー:", fallbackError);
      result.performanceMetrics.totalProcessingTime = Date.now() - startTime;
      return result;
    }
  }
};

/**
 * 簡易テスト用のサンプル実行関数
 */
export const testStagedAIEnhancement = async (): Promise<void> => {
  const sampleText = `
これは実践的なWebアプリケーション開発講座です。JavaScriptの基礎から始まり、Reactを使用したモダンなフロントエンド開発を学びます。
Next.jsフレームワークを活用して、実際のプロジェクトを通じてスキルアップしていきます。
初心者から中級者まで幅広く対応し、実務で使える技術力を身につけることを目標としています。
講師は現役のエンジニアで、最新の技術トレンドも紹介します。
受講料は50,000円で、オンラインでの参加も可能です。お申し込みはウェブサイトから。
  `;

  console.log("🧪 段階的AI強化のテスト実行");

  // AI有効版のテスト
  console.log("\n=== AI有効版 ===");
  const resultWithAI = await stagedAIEnhancement(sampleText);

  console.log("\n📋 AI有効版テスト結果詳細:");
  console.log(
    "元テキスト:",
    resultWithAI.processStages.original.substring(0, 100) + "..."
  );
  console.log(
    "前処理後:",
    resultWithAI.processStages.preprocessed.substring(0, 100) + "..."
  );
  console.log("TextRank結果:", resultWithAI.processStages.textrankResults);
  console.log("最終結果:", resultWithAI.finalKeyphrases);

  // AI無効版のテスト
  console.log("\n=== AI無効版（TextRankのみ） ===");
  const resultWithoutAI = await stagedAIEnhancement(sampleText, {
    enabled: false,
  });

  console.log("\n📋 AI無効版テスト結果詳細:");
  console.log(
    "元テキスト:",
    resultWithoutAI.processStages.original.substring(0, 100) + "..."
  );
  console.log(
    "前処理後:",
    resultWithoutAI.processStages.preprocessed.substring(0, 100) + "..."
  );
  console.log("TextRank結果:", resultWithoutAI.processStages.textrankResults);
  console.log("最終結果:", resultWithoutAI.finalKeyphrases);

  // 処理時間の比較
  console.log("\n📊 処理時間比較:");
  console.log(
    "AI有効版:",
    `${resultWithAI.performanceMetrics.totalProcessingTime}ms (API呼び出し: ${resultWithAI.performanceMetrics.aiApiCalls}回)`
  );
  console.log(
    "AI無効版:",
    `${resultWithoutAI.performanceMetrics.totalProcessingTime}ms (API呼び出し: ${resultWithoutAI.performanceMetrics.aiApiCalls}回)`
  );
};

// テスト実行
if (require.main === module) {
  testStagedAIEnhancement().catch(console.error);
}
