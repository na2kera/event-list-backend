// Gemini APIのimport追加
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

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

// スコア付きキーフレーズのインターフェース
interface ScoredKeyPhrase {
  phrase: string;
  score: number;
  source: "ai" | "textrank" | "hybrid";
  category?: string;
}

// AI抽出結果のインターフェース
interface AIExtractionResult {
  keyphrases: string[];
  categories: { [key: string]: string[] };
  confidence: number;
}

// TextRank設定インターフェース
interface TextRankConfig {
  dampingFactor: number;
  maxIterations: number;
  tolerance: number;
  maxKeyphrases: number;
  minPhraseLength: number;
}

// グローバルにtokenizerとGemini AIを保持（初期化コストを削減）
let tokenizer: KuromojiTokenizer | null = null;
let genAI: GoogleGenerativeAI | null = null;

// デフォルト設定（AI主導型最適化）
const DEFAULT_CONFIG: TextRankConfig = {
  dampingFactor: 0.85,
  maxIterations: 30,
  tolerance: 0.0001,
  maxKeyphrases: 15, // AI抽出結果をベースにするため多めに設定
  minPhraseLength: 2,
};

/**
 * Gemini API初期化
 */
const initializeGeminiAI = (): GoogleGenerativeAI => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY環境変数が設定されていません");
    }
    console.log("🚀 Gemini AI を初期化中...");
    genAI = new GoogleGenerativeAI(apiKey);
    console.log("✅ Gemini AI 初期化完了");
  }
  return genAI;
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
 * AIを使用してキーフレーズを抽出
 */
const extractKeyphrasesWithAI = async (
  text: string
): Promise<AIExtractionResult> => {
  try {
    console.log("🤖 Gemini AI によるキーフレーズ抽出開始...");

    // Gemini AI を初期化
    const genAI = initializeGeminiAI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `
あなたは技術イベントの内容分析専門家です。以下のイベント説明文から、最も重要なキーフレーズを抽出してください。

## 抽出条件
- 技術的な学習内容や手法を重視
- 対象者や難易度レベルの情報
- 特徴的な技術要素やツール
- 1つのキーフレーズは2-20文字程度
- 最大15個まで抽出
- 重要度順に並べる

## カテゴリ分類
抽出したキーフレーズを以下のカテゴリに分類してください：
- technology: 技術・ツール・フレームワーク
- skill: スキル・手法・アプローチ
- level: 対象者・レベル・難易度
- format: 形式・方法・スタイル

## 回答形式
JSON形式で回答してください：
{
  "keyphrases": ["キーフレーズ1", "キーフレーズ2", ...],
  "categories": {
    "technology": ["技術系フレーズ"],
    "skill": ["スキル系フレーズ"],
    "level": ["レベル系フレーズ"],
    "format": ["形式系フレーズ"]
  },
  "confidence": 0.95
}

## 分析対象テキスト
${text}
`;

    const geminiResult = await model.generateContent(prompt);
    const geminiResponse = await geminiResult.response;
    const content = geminiResponse.text();

    if (!content) {
      throw new Error("Gemini AIから有効な応答を取得できませんでした");
    }

    // JSON形式の応答をパース
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Gemini AIの応答からJSONを抽出できませんでした");
    }

    const parsedResult = JSON.parse(jsonMatch[0]) as AIExtractionResult;

    console.log(
      `✅ Gemini AI抽出完了: ${parsedResult.keyphrases.length}個のキーフレーズを取得`
    );
    console.log("📋 抽出されたキーフレーズ:", parsedResult.keyphrases);

    return parsedResult;
  } catch (error) {
    console.error("❌ Gemini AI抽出処理エラー:", error);

    // フォールバック: 簡易的なキーフレーズ抽出
    const fallbackPhrases = await extractFallbackKeyphrases(text);
    return {
      keyphrases: fallbackPhrases,
      categories: { fallback: fallbackPhrases },
      confidence: 0.3,
    };
  }
};

/**
 * フォールバック用の簡易キーフレーズ抽出
 */
const extractFallbackKeyphrases = async (text: string): Promise<string[]> => {
  try {
    const _tokenizer = await initializeTokenizer();
    const tokens = _tokenizer.tokenize(text);

    // 重要そうな単語を抽出
    const keywords = tokens
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

    // 頻度ベースでの簡易抽出
    const wordCounts = new Map<string, number>();
    keywords.forEach((word) => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  } catch (error) {
    console.error("❌ フォールバック抽出エラー:", error);
    return [];
  }
};

/**
 * キーフレーズ間の類似度を計算
 */
const calculatePhraseSimilarity = async (
  phrase1: string,
  phrase2: string
): Promise<number> => {
  try {
    const _tokenizer = await initializeTokenizer();

    const tokens1 = _tokenizer.tokenize(phrase1);
    const tokens2 = _tokenizer.tokenize(phrase2);

    const words1 = tokens1.map((t) => t.basic_form || t.surface_form);
    const words2 = tokens2.map((t) => t.basic_form || t.surface_form);

    if (words1.length === 0 || words2.length === 0) {
      return 0;
    }

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  } catch (error) {
    console.error("❌ 類似度計算エラー:", error);
    return 0;
  }
};

/**
 * TextRankを使用したキーフレーズスコアリング
 */
const scoreKeyphrasesWithTextRank = async (
  keyphrases: string[],
  originalText: string
): Promise<ScoredKeyPhrase[]> => {
  try {
    console.log("📊 TextRank によるスコアリング開始...");

    if (keyphrases.length < 2) {
      return keyphrases.map((phrase) => ({
        phrase,
        score: 1.0,
        source: "ai" as const,
      }));
    }

    // 類似度行列を構築
    const n = keyphrases.length;
    const similarityMatrix: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          similarityMatrix[i][j] = await calculatePhraseSimilarity(
            keyphrases[i],
            keyphrases[j]
          );
        }
      }
    }

    // PageRankアルゴリズムを実行
    let scores = new Array(n).fill(1.0);

    for (let iter = 0; iter < DEFAULT_CONFIG.maxIterations; iter++) {
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

        newScores[i] =
          1 - DEFAULT_CONFIG.dampingFactor + DEFAULT_CONFIG.dampingFactor * sum;
        maxChange = Math.max(maxChange, Math.abs(newScores[i] - scores[i]));
      }

      scores = newScores;

      if (maxChange < DEFAULT_CONFIG.tolerance) {
        console.log(`✅ TextRank収束: ${iter + 1}回目の反復で完了`);
        break;
      }
    }

    // スコアを正規化
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const range = maxScore - minScore;

    const scoredPhrases: ScoredKeyPhrase[] = keyphrases.map(
      (phrase, index) => ({
        phrase,
        score: range > 0 ? (scores[index] - minScore) / range : 0.5,
        source: "hybrid" as const,
      })
    );

    console.log("📊 TextRankスコアリング完了");
    return scoredPhrases;
  } catch (error) {
    console.error("❌ TextRankスコアリングエラー:", error);

    // フォールバック: 均等スコア
    return keyphrases.map((phrase) => ({
      phrase,
      score: 0.5,
      source: "ai" as const,
    }));
  }
};

/**
 * Gemini AI主導型キーフレーズ抽出メイン関数
 * @param text 分析対象の文章
 * @returns スコア付きキーフレーズの配列（重要度順）
 */
export const aiDrivenKeyphraseExtractor = async (
  text: string
): Promise<ScoredKeyPhrase[]> => {
  try {
    console.log("\n🎯 Gemini AI主導型キーフレーズ抽出開始");

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です。");
      return [];
    }

    // Step 1: AIでキーフレーズを抽出
    const aiResult = await extractKeyphrasesWithAI(text);

    if (aiResult.keyphrases.length === 0) {
      console.log("⚠️ AIからキーフレーズを取得できませんでした。");
      return [];
    }

    // Step 2: TextRankでスコアリング
    const scoredPhrases = await scoreKeyphrasesWithTextRank(
      aiResult.keyphrases,
      text
    );

    // Step 3: カテゴリ情報を追加
    scoredPhrases.forEach((scoredPhrase) => {
      for (const [category, phrases] of Object.entries(aiResult.categories)) {
        if (phrases.includes(scoredPhrase.phrase)) {
          scoredPhrase.category = category;
          break;
        }
      }
    });

    // Step 4: スコア順にソートして最終結果を生成
    const finalResult = scoredPhrases
      .sort((a, b) => b.score - a.score)
      .slice(0, DEFAULT_CONFIG.maxKeyphrases);

    console.log(
      `🏆 Gemini AI主導型抽出完了: ${finalResult.length}個のキーフレーズを抽出`
    );
    console.log(
      "📋 最終結果:",
      finalResult.map((p) => `${p.phrase}(${p.score.toFixed(3)})`)
    );

    return finalResult;
  } catch (error) {
    console.error("❌ Gemini AI主導型抽出処理で予期せぬエラー:", error);
    return [];
  }
};

// デフォルトエクスポート（後方互換性のため）
export default aiDrivenKeyphraseExtractor;
