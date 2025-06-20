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

// TextRank設定インターフェース
interface TextRankConfig {
  dampingFactor: number; // PageRankのダンピング係数
  maxIterations: number; // 最大反復回数
  tolerance: number; // 収束判定値
  maxSentences: number; // 最大文数制限
  minSentenceLength: number; // 最小文字数制限
}

// グローバルにtokenizerを保持（初期化コストを削減）
let tokenizer: KuromojiTokenizer | null = null;

// デフォルト設定（日本語最適化）
const DEFAULT_CONFIG: TextRankConfig = {
  dampingFactor: 0.85, // PageRankの標準値
  maxIterations: 50, // 最大反復回数
  tolerance: 0.0001, // 収束判定値
  maxSentences: 10, // 最大10文まで
  minSentenceLength: 10, // 10文字未満の文は除外
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
  // 基本的な文区切り記号で分割
  let sentences = text
    .replace(/([。！？\.\!\?])/g, "$1\n") // 文末記号の後に改行
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // 短すぎる文や記号のみの文を除外
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

    // 名詞、動詞、形容詞のみを抽出
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
    // フォールバック: 簡単な分割
    return sentence
      .replace(/[、。！？\.\!\?,\s]/g, " ")
      .split(" ")
      .filter((word) => word.length > 1)
      .slice(0, 10); // 最大10語まで
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

  // 初期スコア
  let scores = new Array(n).fill(1.0);

  for (let iter = 0; iter < config.maxIterations; iter++) {
    const newScores = new Array(n).fill(0);
    let maxChange = 0;

    for (let i = 0; i < n; i++) {
      let sum = 0;
      let totalWeight = 0;

      // i番目の文に接続している文からのスコア計算
      for (let j = 0; j < n; j++) {
        if (i !== j && similarityMatrix[j][i] > 0) {
          // j番目の文から出ている全ての重みの合計
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

    // 収束判定
    if (maxChange < config.tolerance) {
      console.log(`✅ PageRank収束: ${iter + 1}回目の反復で完了`);
      break;
    }
  }

  return scores;
};

/**
 * TextRankを使用したキーセンテンス抽出メイン関数
 * @param text 分析対象の文章
 * @returns 重要文の配列（重要度順）
 */
export const textrankKeyphraseExtractor = async (
  text: string
): Promise<string[]> => {
  try {
    console.log("\n🎯 TextRank キーセンテンス抽出開始");

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です。");
      return [];
    }

    // 1. 文分割
    const rawSentences = splitIntoSentences(text);

    if (rawSentences.length < 2) {
      console.log("⚠️ 分析に十分な文がありません。");
      return rawSentences.slice(0, 5);
    }

    console.log(`📊 ${rawSentences.length}文を分析します...`);

    // 2. 各文を単語に分解
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
      console.log("⚠️ 有効な文が少なすぎます。");
      return sentences.map((s) => s.text).slice(0, 5);
    }

    // 3. 類似度行列を構築
    const similarityMatrix = buildSimilarityMatrix(sentences);

    // 4. PageRankアルゴリズムを実行
    const scores = runPageRank(similarityMatrix, DEFAULT_CONFIG);

    // 5. スコアを文情報に反映
    sentences.forEach((sentence, index) => {
      sentence.score = scores[index] || 0;
    });

    // 6. スコア順にソートして上位を選択
    const rankedSentences = sentences
      .sort((a, b) => b.score - a.score)
      .slice(
        0,
        Math.min(DEFAULT_CONFIG.maxSentences, Math.ceil(sentences.length * 0.4))
      );

    // 7. 元の順序でソート（読みやすさのため）
    const finalSentences = rankedSentences
      .sort((a, b) => a.originalPosition - b.originalPosition)
      .map((s) => s.text);

    console.log(`🏆 TextRank抽出完了: ${finalSentences.length}文を抽出`);
    console.log("📋 抽出された重要文:", finalSentences);

    return finalSentences;
  } catch (error) {
    console.error("❌ TextRank抽出処理で予期せぬエラー:", error);

    // フォールバック処理：簡易的な文抽出
    try {
      console.log("🔄 フォールバック処理を実行中...");
      const fallbackSentences = splitIntoSentences(text).slice(0, 5);
      return fallbackSentences;
    } catch (fallbackError) {
      console.error("❌ フォールバック処理もエラー:", fallbackError);
      return [];
    }
  }
};
