import { GoogleGenerativeAI } from "@google/generative-ai";

// AI強化設定インターフェース
interface AIEnhancementConfig {
  maxRetries: number;
  timeoutMs: number;
  maxKeyphrases: number;
  minScore: number;
  cacheEnabled: boolean;
}

// AI強化結果インターフェース
interface EnhancedKeyphrase {
  phrase: string;
  score: number;
  confidence: number;
  aiEnhanced: boolean;
  originalRank?: number;
}

// キャッシュインターフェース
interface CacheEntry {
  result: EnhancedKeyphrase[];
  timestamp: number;
  ttl: number;
}

// デフォルト設定
const DEFAULT_CONFIG: AIEnhancementConfig = {
  maxRetries: 3,
  timeoutMs: 8000,
  maxKeyphrases: 10,
  minScore: 0.3,
  cacheEnabled: true,
};

// 簡易キャッシュ実装（本番環境ではRedis等を使用）
const cache = new Map<string, CacheEntry>();

// Gemini API初期化
let genAI: GoogleGenerativeAI | null = null;

const initializeGeminiAPI = (): GoogleGenerativeAI => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY環境変数が設定されていません");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
};

/**
 * キャッシュからの取得
 */
const getCachedResult = (cacheKey: string): EnhancedKeyphrase[] | null => {
  const entry = cache.get(cacheKey);
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.timestamp + entry.ttl) {
    cache.delete(cacheKey);
    return null;
  }

  return entry.result;
};

/**
 * キャッシュへの保存
 */
const setCachedResult = (
  cacheKey: string,
  result: EnhancedKeyphrase[],
  ttlHours: number = 24
): void => {
  cache.set(cacheKey, {
    result,
    timestamp: Date.now(),
    ttl: ttlHours * 60 * 60 * 1000, // ミリ秒に変換
  });
};

/**
 * TextRank結果をAIで強化するプロンプト生成
 */
const generateEnhancementPrompt = (
  originalText: string,
  textRankResults: string[]
): string => {
  return `
あなたは日本のIT・技術イベントの専門家です。以下のイベント説明文と、TextRankアルゴリズムで抽出されたキーフレーズを分析し、より関連性の高いキーフレーズに改善してください。

【イベント説明文】
${originalText.substring(0, 2000)}

【TextRank抽出結果】
${textRankResults.map((phrase, index) => `${index + 1}. ${phrase}`).join("\n")}

【改善指示】
1. 技術用語・プログラミング言語・フレームワーク名を優先
2. 重複や類似表現を統合
3. 一般的すぎる単語（「学習」「開催」等）は除外
4. 20文字以内の短縮形を推奨
5. 最大8個まで厳選

【出力形式】（JSON形式で回答）
{
  "enhanced_keyphrases": [
    {
      "phrase": "キーフレーズ",
      "score": 0.85,
      "reason": "選択理由"
    }
  ]
}
`;
};

/**
 * Gemini APIでキーフレーズを強化
 */
const enhanceWithGemini = async (
  originalText: string,
  textRankResults: string[],
  config: AIEnhancementConfig = DEFAULT_CONFIG
): Promise<EnhancedKeyphrase[]> => {
  try {
    console.log("🤖 Gemini APIでキーフレーズ強化開始...");

    const genAI = initializeGeminiAPI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = generateEnhancementPrompt(originalText, textRankResults);

    // タイムアウト制御
    const enhancePromise = model.generateContent(prompt);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("AI API タイムアウト")),
        config.timeoutMs
      )
    );

    const result = (await Promise.race([
      enhancePromise,
      timeoutPromise,
    ])) as any;
    const responseText = result.response.text();

    console.log("📝 Gemini API レスポンス受信");

    // JSON解析
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON形式のレスポンスが見つかりません");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const enhancedPhrases: EnhancedKeyphrase[] = parsed.enhanced_keyphrases.map(
      (item: any, index: number) => ({
        phrase: item.phrase,
        score: item.score || 0.5,
        confidence: Math.max(0.1, Math.min(1.0, item.score || 0.5)),
        aiEnhanced: true,
        originalRank: index,
      })
    );

    // スコアでソート
    enhancedPhrases.sort((a, b) => b.score - a.score);

    console.log(`✅ AI強化完了: ${enhancedPhrases.length}個のキーフレーズ`);
    return enhancedPhrases.slice(0, config.maxKeyphrases);
  } catch (error) {
    console.error("❌ Gemini API エラー:", error);
    throw error;
  }
};

/**
 * TextRank結果とAI強化結果をマージ
 */
const mergeResults = (
  textRankResults: string[],
  aiResults: EnhancedKeyphrase[]
): EnhancedKeyphrase[] => {
  // TextRank結果をフォールバック用に変換
  const textRankPhrases: EnhancedKeyphrase[] = textRankResults.map(
    (phrase, index) => ({
      phrase,
      score: Math.max(0.1, 1.0 - index * 0.1), // 順位ベースのスコア
      confidence: 0.6, // TextRankの基本信頼度
      aiEnhanced: false,
      originalRank: index,
    })
  );

  // AI結果を優先、不足分をTextRankで補完
  const mergedResults = [...aiResults];

  for (const textRankPhrase of textRankPhrases) {
    if (mergedResults.length >= DEFAULT_CONFIG.maxKeyphrases) break;

    // 重複チェック（部分一致含む）
    const isDuplicate = mergedResults.some(
      (existing) =>
        existing.phrase.includes(textRankPhrase.phrase) ||
        textRankPhrase.phrase.includes(existing.phrase)
    );

    if (!isDuplicate) {
      mergedResults.push(textRankPhrase);
    }
  }

  return mergedResults
    .filter((phrase) => phrase.score >= DEFAULT_CONFIG.minScore)
    .slice(0, DEFAULT_CONFIG.maxKeyphrases);
};

/**
 * メイン関数：AI強化されたキーフレーズ抽出
 */
export const aiEnhancedKeyphraseExtraction = async (
  originalText: string,
  textRankResults: string[],
  config: AIEnhancementConfig = DEFAULT_CONFIG
): Promise<EnhancedKeyphrase[]> => {
  const startTime = Date.now();

  try {
    console.log("🚀 AI強化キーフレーズ抽出開始");

    // キャッシュキー生成
    const cacheKey = `ai_enhanced_${btoa(
      originalText.substring(0, 100)
    ).substring(0, 32)}`;

    // キャッシュチェック
    if (config.cacheEnabled) {
      const cachedResult = getCachedResult(cacheKey);
      if (cachedResult) {
        console.log("📋 キャッシュからの結果を返却");
        return cachedResult;
      }
    }

    // AI強化実行（リトライ機能付き）
    let aiResults: EnhancedKeyphrase[] = [];
    let retryCount = 0;

    while (retryCount < config.maxRetries) {
      try {
        aiResults = await enhanceWithGemini(
          originalText,
          textRankResults,
          config
        );
        break; // 成功した場合はループを抜ける
      } catch (error) {
        retryCount++;
        console.warn(
          `⚠️ AI API 失敗 (${retryCount}/${config.maxRetries}):`,
          error
        );

        if (retryCount >= config.maxRetries) {
          console.log("🔄 AI API 失敗、TextRank結果にフォールバック");
          aiResults = []; // 空配列でフォールバック
        } else {
          // 指数バックオフで待機
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retryCount) * 1000)
          );
        }
      }
    }

    // 結果マージ
    const finalResults = mergeResults(textRankResults, aiResults);

    // キャッシュ保存
    if (config.cacheEnabled && finalResults.length > 0) {
      setCachedResult(cacheKey, finalResults);
    }

    const processingTime = Date.now() - startTime;
    console.log(
      `✅ AI強化完了 (${processingTime}ms): ${finalResults.length}個のキーフレーズ`
    );

    return finalResults;
  } catch (error) {
    console.error("❌ AI強化処理エラー:", error);

    // 完全フォールバック：TextRank結果のみ返却
    console.log("🔄 完全フォールバック：TextRank結果のみ返却");
    return mergeResults(textRankResults, []);
  }
};

/**
 * 統計情報取得
 */
export const getAIEnhancementStats = () => {
  return {
    cacheSize: cache.size,
    cacheKeys: Array.from(cache.keys()),
    uptime: process.uptime(),
  };
};

/**
 * キャッシュクリア
 */
export const clearAIEnhancementCache = () => {
  cache.clear();
  console.log("🗑️ AI強化キャッシュをクリアしました");
};

// エクスポート型定義
export type { EnhancedKeyphrase, AIEnhancementConfig };
