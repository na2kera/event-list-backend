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
  tfidfVector: number[];
  score: number;
  originalPosition: number;
}

// コサイン類似度設定インターフェース
interface CosineConfig {
  maxSentences: number; // 最大抽出文数
  minSentenceLength: number; // 最小文字数制限
  similarityThreshold: number; // 重複除去閾値
  usePositionWeight: boolean; // 位置重み使用
}

// グローバルにtokenizerを保持（初期化コストを削減）
let tokenizer: KuromojiTokenizer | null = null;

// デフォルト設定
const DEFAULT_CONFIG: CosineConfig = {
  maxSentences: 20, // 最大20文まで
  minSentenceLength: 10, // 10文字未満の文は除外
  similarityThreshold: 0.8, // 80%以上類似は重複とみなす
  usePositionWeight: false, // 位置重みは使用しない
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
 * TF-IDFベクトルを計算
 */
const calculateTfidfVectors = async (
  sentences: SentenceInfo[]
): Promise<void> => {
  try {
    const TfIdf = require("tiny-tfidf");
    const tfidf = new TfIdf();

    // 各文をドキュメントとして追加
    for (const sentence of sentences) {
      tfidf.addDocument(sentence.words.join(" "));
    }

    // 語彙一覧を取得
    const vocabulary = tfidf.terms();

    // 各文のTF-IDFベクトルを計算
    for (let i = 0; i < sentences.length; i++) {
      const vector: number[] = [];

      for (const term of vocabulary) {
        const tfidfScore = tfidf.tfidf(term, i);
        vector.push(tfidfScore);
      }

      sentences[i].tfidfVector = vector;
    }
  } catch (error) {
    console.error("❌ TF-IDF計算エラー:", error);
    // フォールバック: 単語頻度ベクトル
    const allWords = Array.from(new Set(sentences.flatMap((s) => s.words)));

    for (const sentence of sentences) {
      const vector = allWords.map(
        (word) =>
          sentence.words.filter((w) => w === word).length /
          sentence.words.length
      );
      sentence.tfidfVector = vector;
    }
  }
};

/**
 * コサイン類似度を計算
 */
const calculateCosineSimilarity = (
  vectorA: number[],
  vectorB: number[]
): number => {
  try {
    const similarity = require("compute-cosine-similarity");
    return similarity(vectorA, vectorB) || 0;
  } catch (error) {
    console.error("❌ コサイン類似度計算エラー:", error);
    // フォールバック: ドット積による近似
    if (vectorA.length !== vectorB.length) return 0;

    const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }
};

/**
 * 文間類似度行列を構築
 */
const buildSimilarityMatrix = (sentences: SentenceInfo[]): number[][] => {
  const n = sentences.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        matrix[i][j] = calculateCosineSimilarity(
          sentences[i].tfidfVector,
          sentences[j].tfidfVector
        );
      }
    }
  }

  return matrix;
};

/**
 * 文の重要度スコアを計算
 */
const calculateSentenceScores = (
  sentences: SentenceInfo[],
  similarityMatrix: number[][],
  config: CosineConfig
): void => {
  const n = sentences.length;

  for (let i = 0; i < n; i++) {
    // 他の文との平均類似度を計算
    let totalSimilarity = 0;
    let count = 0;

    for (let j = 0; j < n; j++) {
      if (i !== j) {
        totalSimilarity += similarityMatrix[i][j];
        count++;
      }
    }

    const averageSimilarity = count > 0 ? totalSimilarity / count : 0;

    // 位置重みを適用（オプション）
    let positionWeight = 1.0;
    if (config.usePositionWeight) {
      // 文書の前半と後半により高い重みを付与
      const position = sentences[i].originalPosition / n;
      if (position <= 0.3 || position >= 0.7) {
        positionWeight = 1.2;
      }
    }

    sentences[i].score = averageSimilarity * positionWeight;
  }
};

/**
 * 重複文を除去
 */
const removeDuplicateSentences = (
  sentences: SentenceInfo[],
  config: CosineConfig
): SentenceInfo[] => {
  const filtered: SentenceInfo[] = [];

  for (const sentence of sentences) {
    let isDuplicate = false;

    for (const existing of filtered) {
      const similarity = calculateCosineSimilarity(
        sentence.tfidfVector,
        existing.tfidfVector
      );

      if (similarity >= config.similarityThreshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      filtered.push(sentence);
    }
  }

  return filtered;
};

/**
 * コサイン類似度を使ったキーセンテンス抽出のメイン関数
 */
export const cosineSimilarityKeyphraseExtractor = async (
  text: string,
  config: Partial<CosineConfig> = {}
): Promise<string[]> => {
  try {
    console.log("🔍 コサイン類似度によるキーセンテンス抽出を開始...");

    // 設定をマージ
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // 1. 文分割
    const rawSentences = splitIntoSentences(text);
    console.log(`📝 ${rawSentences.length}文に分割しました`);

    if (rawSentences.length === 0) {
      console.warn("⚠️ 有効な文が見つかりませんでした");
      return [];
    }

    // 2. 各文を形態素解析
    const sentences: SentenceInfo[] = [];
    for (let i = 0; i < rawSentences.length; i++) {
      const words = await tokenizeSentence(rawSentences[i]);
      if (words.length > 0) {
        sentences.push({
          id: i,
          text: rawSentences[i],
          words,
          tfidfVector: [],
          score: 0,
          originalPosition: i,
        });
      }
    }

    console.log(`✅ ${sentences.length}文の形態素解析完了`);

    if (sentences.length === 0) {
      console.warn("⚠️ 処理可能な文が見つかりませんでした");
      return [];
    }

    // 3. TF-IDFベクトル計算
    await calculateTfidfVectors(sentences);
    console.log("📊 TF-IDFベクトル計算完了");

    // 4. 類似度行列構築
    const similarityMatrix = buildSimilarityMatrix(sentences);
    console.log("🔗 文間類似度行列構築完了");

    // 5. 文スコア計算
    calculateSentenceScores(sentences, similarityMatrix, finalConfig);
    console.log("⭐ 文重要度スコア計算完了");

    // 6. スコア順にソート
    sentences.sort((a, b) => b.score - a.score);

    // 7. 重複除去
    const uniqueSentences = removeDuplicateSentences(sentences, finalConfig);
    console.log(`🔄 重複除去後: ${uniqueSentences.length}文`);

    // 8. 上位文を選択
    const topSentences = uniqueSentences
      .slice(0, finalConfig.maxSentences)
      .sort((a, b) => a.originalPosition - b.originalPosition); // 元の順序に戻す

    const results = topSentences.map((s) => s.text);

    console.log(`✅ キーセンテンス抽出完了: ${results.length}文を抽出`);
    console.log("📄 抽出された文:");
    results.forEach((sentence, i) => {
      const previewText =
        sentence.length > 50 ? sentence.substring(0, 50) + "..." : sentence;
      console.log(`  ${i + 1}. ${previewText}`);
    });

    return results;
  } catch (error) {
    console.error("❌ キーセンテンス抽出エラー:", error);

    // フォールバック: 文の長さベースの選択
    try {
      console.log("🔄 フォールバック処理を実行中...");
      const sentences = splitIntoSentences(text);

      if (sentences.length === 0) {
        return [];
      }

      // 中程度の長さの文を優先選択
      const scoredSentences = sentences
        .map((sentence, index) => ({
          text: sentence,
          score:
            sentence.length > 20 && sentence.length < 200 ? sentence.length : 0,
          originalPosition: index,
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(10, sentences.length))
        .sort((a, b) => a.originalPosition - b.originalPosition);

      const fallbackResults = scoredSentences.map((item) => item.text);
      console.log(`🔄 フォールバック完了: ${fallbackResults.length}文を抽出`);

      return fallbackResults;
    } catch (fallbackError) {
      console.error("❌ フォールバック処理もエラー:", fallbackError);
      return [];
    }
  }
};
