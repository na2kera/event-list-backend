// アプローチ3: ハイブリッド並列処理
// TextRank と AI を並列実行し、結果を統合

// 環境変数読み込み
import * as dotenv from "dotenv";
dotenv.config();

// kuromoji.jsの型定義
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

// キーフレーズのスコア情報
interface ScoredKeyPhrase {
  text: string;
  textRankScore: number;
  aiScore: number;
  hybridScore: number;
  source: "textrank" | "ai" | "both";
  length: number;
}

// ハイブリッド結果
interface HybridResult {
  keyphrases: ScoredKeyPhrase[];
  textRankResults: string[];
  aiResults: string[];
  processingTime: number;
  confidence: number;
}

// TextRank設定
interface TextRankConfig {
  dampingFactor: number;
  maxIterations: number;
  tolerance: number;
  maxSentences: number;
  minSentenceLength: number;
}

// AI設定
interface AIConfig {
  maxTokens: number;
  temperature: number;
  model: string;
  maxKeyphrases: number;
}

// グローバルにtokenizerを保持
let tokenizer: KuromojiTokenizer | null = null;

// デフォルト設定
const DEFAULT_CONFIG: TextRankConfig = {
  dampingFactor: 0.85,
  maxIterations: 50,
  tolerance: 0.0001,
  maxSentences: 10,
  minSentenceLength: 10,
};

const DEFAULT_AI_CONFIG: AIConfig = {
  maxTokens: 1000,
  temperature: 0.3,
  model: "gemini-2.0-flash-exp",
  maxKeyphrases: 10,
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
    return cleanSentence.length >= DEFAULT_CONFIG.minSentenceLength;
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
 * TextRankによるキーフレーズ抽出
 */
const textRankExtraction = async (text: string): Promise<string[]> => {
  try {
    console.log("🎯 TextRank処理開始");

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return [];
    }

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
    const scores = runPageRank(similarityMatrix, DEFAULT_CONFIG);

    sentences.forEach((sentence, index) => {
      sentence.score = scores[index] || 0;
    });

    const rankedSentences = sentences
      .sort((a, b) => b.score - a.score)
      .slice(
        0,
        Math.min(DEFAULT_CONFIG.maxSentences, Math.ceil(sentences.length * 0.4))
      );

    const finalSentences = rankedSentences
      .sort((a, b) => a.originalPosition - b.originalPosition)
      .map((s) => s.text);

    console.log(`✅ TextRank完了: ${finalSentences.length}文を抽出`);
    return finalSentences;
  } catch (error) {
    console.error("❌ TextRank処理エラー:", error);
    return splitIntoSentences(text).slice(0, 5);
  }
};

/**
 * AIによるキーフレーズ抽出（Gemini API使用）
 */
const aiExtraction = async (
  text: string,
  config: AIConfig = DEFAULT_AI_CONFIG
): Promise<string[]> => {
  try {
    console.log("🤖 Gemini AI処理開始");

    // 環境変数チェック
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn(
        "⚠️ Gemini API キーが設定されていません。ダミーデータを返します。"
      );
      return generateFallbackAIResult(text);
    }

    const prompt = `以下のイベント説明文から、最も重要なキーフレーズを${config.maxKeyphrases}個まで抽出してください。

要求：
- 20文字以内の短いフレーズを優先
- 技術的な内容や学習要素を重視
- 対象者や特徴的な要素を含める
- 重複は避ける
- フレーズのみを改行区切りで出力
- 番号や記号は付けない

イベント説明文：
${text}

抽出されたキーフレーズ：`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Gemini API エラー: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("Gemini AI応答が空です");
    }

    const keyphrases = content
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && line.length <= 50)
      .slice(0, config.maxKeyphrases);

    console.log(`✅ Gemini AI完了: ${keyphrases.length}フレーズを抽出`);
    return keyphrases;
  } catch (error) {
    console.error("❌ Gemini AI処理エラー:", error);
    return generateFallbackAIResult(text);
  }
};

/**
 * Gemini AIのフォールバック結果生成
 */
const generateFallbackAIResult = (text: string): string[] => {
  console.log("🔄 Gemini AIフォールバック処理実行");

  // 簡易的なキーワード抽出
  const keywords = text
    .replace(/[、。！？\.\!\?,\s]/g, " ")
    .split(" ")
    .filter((word) => word.length > 2 && word.length <= 20)
    .slice(0, 8);

  return keywords.length > 0
    ? keywords
    : ["技術セミナー", "プログラミング", "実践的学習"];
};

/**
 * 文字列の類似度を計算（編集距離ベース）
 */
const calculateTextSimilarity = (str1: string, str2: string): number => {
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 || len2 === 0) return 0;

  // 正規化Levenshtein距離
  const maxLen = Math.max(len1, len2);
  const distance = levenshteinDistance(str1, str2);

  return 1 - distance / maxLen;
};

/**
 * Levenshtein距離の計算
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,
        matrix[j][i - 1] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[str2.length][str1.length];
};

/**
 * スコア統合アルゴリズム
 */
const integrateScores = (
  textRankResults: string[],
  aiResults: string[],
  textRankWeight: number = 0.6,
  aiWeight: number = 0.4
): ScoredKeyPhrase[] => {
  console.log("⚖️ スコア統合処理開始");

  const integratedPhrases: ScoredKeyPhrase[] = [];
  const processedTexts = new Set<string>();

  // TextRankの結果を処理
  textRankResults.forEach((phrase, index) => {
    const textRankScore = 1 - index / textRankResults.length; // 順位ベーススコア

    integratedPhrases.push({
      text: phrase,
      textRankScore: textRankScore,
      aiScore: 0,
      hybridScore: textRankScore * textRankWeight,
      source: "textrank",
      length: phrase.length,
    });

    processedTexts.add(phrase.toLowerCase());
  });

  // AIの結果を処理（重複チェック付き）
  aiResults.forEach((phrase, index) => {
    const aiScore = 1 - index / aiResults.length;
    const normalizedPhrase = phrase.toLowerCase();

    // 重複チェック（類似度ベース）
    let bestMatch: ScoredKeyPhrase | null = null;
    let bestSimilarity = 0;

    for (const existing of integratedPhrases) {
      const similarity = calculateTextSimilarity(
        normalizedPhrase,
        existing.text.toLowerCase()
      );

      if (similarity > bestSimilarity && similarity > 0.7) {
        bestSimilarity = similarity;
        bestMatch = existing;
      }
    }

    if (bestMatch) {
      // 既存のフレーズとマージ
      bestMatch.aiScore = aiScore;
      bestMatch.hybridScore =
        bestMatch.textRankScore * textRankWeight + aiScore * aiWeight;
      bestMatch.source = "both";
    } else {
      // 新しいフレーズとして追加
      integratedPhrases.push({
        text: phrase,
        textRankScore: 0,
        aiScore: aiScore,
        hybridScore: aiScore * aiWeight,
        source: "ai",
        length: phrase.length,
      });
    }
  });

  // ハイブリッドスコア順でソート
  integratedPhrases.sort((a, b) => b.hybridScore - a.hybridScore);

  console.log(`✅ スコア統合完了: ${integratedPhrases.length}フレーズを統合`);
  return integratedPhrases;
};

/**
 * 信頼度スコアの計算
 */
const calculateConfidence = (
  textRankResults: string[],
  aiResults: string[],
  integratedResults: ScoredKeyPhrase[]
): number => {
  const bothSourceCount = integratedResults.filter(
    (p) => p.source === "both"
  ).length;
  const totalResults = integratedResults.length;

  if (totalResults === 0) return 0;

  // 両方のソースからの結果の割合を信頼度とする
  const agreementRatio = bothSourceCount / totalResults;

  // 結果数による調整（適度な数の結果がある場合により高い信頼度）
  const countFactor = Math.min(totalResults / 8, 1); // 8個程度が理想

  return Math.min(agreementRatio * 0.7 + countFactor * 0.3, 1.0);
};

/**
 * ハイブリッド並列処理によるキーフレーズ抽出メイン関数
 * @param text 分析対象の文章
 * @param textRankWeight TextRankの重み（デフォルト: 0.6）
 * @param aiWeight AIの重み（デフォルト: 0.4）
 * @returns ハイブリッド結果
 */
export const hybridKeyphraseExtractor = async (
  text: string,
  textRankWeight: number = 0.6,
  aiWeight: number = 0.4
): Promise<HybridResult> => {
  const startTime = Date.now();

  try {
    console.log("\n⚖️ ハイブリッド並列処理開始");
    console.log(`🎯 重み設定: TextRank=${textRankWeight}, AI=${aiWeight}`);

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です。");
      return {
        keyphrases: [],
        textRankResults: [],
        aiResults: [],
        processingTime: 0,
        confidence: 0,
      };
    }

    // 並列処理: TextRankとAIを同時実行
    console.log("🚀 並列処理開始: TextRank & AI");
    const [textRankResults, aiResults] = await Promise.all([
      textRankExtraction(text),
      aiExtraction(text),
    ]);

    console.log(`📊 TextRank結果: ${textRankResults.length}文`);
    console.log(`🤖 AI結果: ${aiResults.length}フレーズ`);

    // スコア統合
    const integratedResults = integrateScores(
      textRankResults,
      aiResults,
      textRankWeight,
      aiWeight
    );

    // 信頼度計算
    const confidence = calculateConfidence(
      textRankResults,
      aiResults,
      integratedResults
    );

    const processingTime = Date.now() - startTime;

    const result: HybridResult = {
      keyphrases: integratedResults.slice(0, 10), // 上位10個まで
      textRankResults,
      aiResults,
      processingTime,
      confidence,
    };

    console.log(
      `🏆 ハイブリッド処理完了: ${result.keyphrases.length}フレーズ抽出`
    );
    console.log(`⏱️ 処理時間: ${processingTime}ms`);
    console.log(`📈 信頼度: ${(confidence * 100).toFixed(1)}%`);
    console.log(
      "🎯 統合結果:",
      result.keyphrases.map(
        (p) => `${p.text} (${p.source}, score: ${p.hybridScore.toFixed(3)})`
      )
    );

    return result;
  } catch (error) {
    console.error("❌ ハイブリッド処理で予期せぬエラー:", error);

    const processingTime = Date.now() - startTime;
    return {
      keyphrases: [],
      textRankResults: [],
      aiResults: [],
      processingTime,
      confidence: 0,
    };
  }
};

/**
 * 互換性のためのエクスポート（従来のインターフェース）
 * @param text 分析対象の文章
 * @returns 重要キーフレーズの配列
 */
export const textrankKeyphraseExtractor = async (
  text: string
): Promise<string[]> => {
  const result = await hybridKeyphraseExtractor(text);
  return result.keyphrases.map((p) => p.text);
};

// デバッグ用：型の再エクスポート
export type { HybridResult, ScoredKeyPhrase };
