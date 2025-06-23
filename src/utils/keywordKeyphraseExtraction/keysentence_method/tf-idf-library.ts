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
  tfidfScore: number;
  originalPosition: number;
}

// TF-IDF設定インターフェース
interface TfidfConfig {
  maxSentences: number; // 最大抽出文数
  minSentenceLength: number; // 最小文字数制限
  scoreThreshold: number; // スコア閾値倍率
  removeShortSentences: boolean; // 短文除去フラグ
}

// グローバルにtokenizerを保持（初期化コストを削減）
let tokenizer: KuromojiTokenizer | null = null;

// デフォルト設定
const DEFAULT_CONFIG: TfidfConfig = {
  maxSentences: 20, // 最大20文まで
  minSentenceLength: 10, // 10文字未満の文は除外
  scoreThreshold: 1.2, // 平均の1.2倍以上
  removeShortSentences: true, // 短文を除去
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
 * テキストを文に分割
 */
const splitIntoSentences = (text: string): string[] => {
  // 文末記号で分割（日本語対応）
  const sentences = text
    .split(/[。！？．!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences;
};

/**
 * 文を形態素解析して単語配列を返す
 */
const tokenizeSentence = async (sentence: string): Promise<string[]> => {
  try {
    const _tokenizer = await initializeTokenizer();
    const tokens = _tokenizer.tokenize(sentence);

    // 名詞・動詞・形容詞のみ抽出
    const filteredTokens = tokens.filter((token) => {
      const pos = token.pos;
      const detail1 = token.pos_detail_1;
      return (
        (pos === "名詞" &&
          !["接続詞的", "数", "非自立", "代名詞"].includes(detail1)) ||
        (pos === "動詞" && detail1 !== "非自立") ||
        (pos === "形容詞" && detail1 !== "非自立")
      );
    });

    return filteredTokens
      .map((token) => token.basic_form || token.surface_form)
      .filter(
        (word) =>
          word &&
          word.length > 1 &&
          !/^[a-zA-Z0-9]+$/.test(word) &&
          !/^\d+$/.test(word)
      );
  } catch (error) {
    console.error("❌ 形態素解析エラー:", error);
    // フォールバック: 単純な分割
    return sentence
      .split(/\s+/)
      .filter((word) => word && word.length > 1)
      .slice(0, 10);
  }
};

/**
 * 自前TF-IDF計算: Term Frequency計算
 */
const calculateTF = (word: string, words: string[]): number => {
  const count = words.filter((w) => w === word).length;
  return count / words.length;
};

/**
 * 自前TF-IDF計算: Inverse Document Frequency計算
 */
const calculateIDF = (word: string, allSentences: SentenceInfo[]): number => {
  const documentCount = allSentences.length;
  const documentWithWord = allSentences.filter((sentence) =>
    sentence.words.includes(word)
  ).length;

  if (documentWithWord === 0) return 0;
  return Math.log(documentCount / documentWithWord);
};

/**
 * TF-IDFスコアを計算して文を評価（自前実装）
 */
const calculateTfidfScores = async (
  sentences: SentenceInfo[]
): Promise<void> => {
  try {
    console.log(`📚 ${sentences.length}文のTF-IDFスコアを計算中...`);

    // 全単語の語彙を作成
    const vocabulary = new Set<string>();
    sentences.forEach((sentence) => {
      sentence.words.forEach((word) => vocabulary.add(word));
    });

    console.log(`📖 語彙数: ${vocabulary.size}語`);

    // 各文のTF-IDFスコアを計算
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      if (sentence.words.length === 0) {
        sentence.tfidfScore = 0;
        continue;
      }

      let totalScore = 0;
      let validWordCount = 0;

      // 文内の各単語のTF-IDFスコアを計算
      for (const word of sentence.words) {
        const tf = calculateTF(word, sentence.words);
        const idf = calculateIDF(word, sentences);
        const tfidfScore = tf * idf;

        if (tfidfScore > 0) {
          totalScore += tfidfScore;
          validWordCount++;
        }
      }

      // 平均TF-IDFスコアを文のスコアとして設定
      sentence.tfidfScore =
        validWordCount > 0 ? totalScore / validWordCount : 0;
    }

    console.log(`✅ TF-IDFスコア計算完了 - 処理文数: ${sentences.length}`);

    // スコアの分布を表示（デバッグ用）
    const scores = sentences.map((s) => s.tfidfScore).filter((s) => s > 0);
    if (scores.length > 0) {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      console.log(
        `📊 スコア統計 - 平均: ${avgScore.toFixed(4)}, 最大: ${maxScore.toFixed(
          4
        )}, 最小: ${minScore.toFixed(4)}`
      );
    }
  } catch (error) {
    console.error("❌ TF-IDF計算エラー:", error);
    console.log("🔄 フォールバック処理を実行します...");

    // フォールバック: 単語頻度と文長ベースのスコア
    const allWords = new Set<string>();
    sentences.forEach((s) => s.words.forEach((w) => allWords.add(w)));

    for (const sentence of sentences) {
      if (sentence.words.length === 0) {
        sentence.tfidfScore = 0;
        continue;
      }

      // 単語の希少性 × 文の長さでスコア計算
      const uniqueWords = new Set(sentence.words);
      const uniqueRatio = uniqueWords.size / Math.max(sentence.words.length, 1);
      const lengthScore = Math.min(sentence.words.length / 20, 1); // 正規化

      sentence.tfidfScore = uniqueRatio * lengthScore * 0.5; // 0-0.5の範囲に調整
    }

    console.log("✅ フォールバックスコア計算完了");
  }
};

/**
 * 重複文を除去
 */
const removeDuplicateSentences = (
  sentences: SentenceInfo[],
  threshold: number = 0.8
): SentenceInfo[] => {
  const uniqueSentences: SentenceInfo[] = [];

  for (const sentence of sentences) {
    let isDuplicate = false;

    for (const existing of uniqueSentences) {
      // 単純な文字列類似度チェック
      const similarity = calculateStringSimilarity(
        sentence.text,
        existing.text
      );
      if (similarity > threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      uniqueSentences.push(sentence);
    }
  }

  return uniqueSentences;
};

/**
 * 文字列類似度計算（簡易版）
 */
const calculateStringSimilarity = (str1: string, str2: string): number => {
  const words1 = new Set(str1.split(""));
  const words2 = new Set(str2.split(""));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
};

/**
 * 上位スコア文を選択
 */
const selectTopSentences = (
  sentences: SentenceInfo[],
  config: TfidfConfig
): SentenceInfo[] => {
  // スコアが0より大きい文のみを対象
  const validSentences = sentences.filter((s) => s.tfidfScore > 0);

  if (validSentences.length === 0) {
    console.warn("⚠️ 有効なスコアを持つ文が見つかりませんでした");
    return sentences.slice(0, Math.min(config.maxSentences, sentences.length));
  }

  // 平均スコア計算
  const averageScore =
    validSentences.reduce((sum, s) => sum + s.tfidfScore, 0) /
    validSentences.length;
  const threshold = averageScore * config.scoreThreshold;

  console.log(
    `📊 平均スコア: ${averageScore.toFixed(4)}, 閾値: ${threshold.toFixed(4)}`
  );

  // 閾値以上の文を抽出
  let selectedSentences = validSentences.filter(
    (s) => s.tfidfScore >= threshold
  );

  // 閾値で十分な文が取れない場合は上位から選択
  if (
    selectedSentences.length <
    Math.min(config.maxSentences, validSentences.length * 0.3)
  ) {
    selectedSentences = validSentences
      .sort((a, b) => b.tfidfScore - a.tfidfScore)
      .slice(0, config.maxSentences);
  }

  // 最大文数制限
  return selectedSentences.slice(0, config.maxSentences);
};

/**
 * TF-IDFを使ったキーセンテンス抽出のメイン関数
 */
export const tfidfKeyphraseExtractor = async (
  text: string,
  config: Partial<TfidfConfig> = {}
): Promise<string[]> => {
  try {
    console.log("🔍 TF-IDFによるキーセンテンス抽出を開始...");

    // 設定をマージ
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // 1. 文分割
    const rawSentences = splitIntoSentences(text);
    console.log(`📝 ${rawSentences.length}文に分割しました`);

    if (rawSentences.length === 0) {
      console.warn("⚠️ 有効な文が見つかりませんでした");
      return [];
    }

    // 2. 短文フィルタリング
    let filteredSentences = rawSentences;
    if (finalConfig.removeShortSentences) {
      filteredSentences = rawSentences.filter(
        (s) => s.length >= finalConfig.minSentenceLength
      );
      console.log(`🔧 短文除去後: ${filteredSentences.length}文`);
    }

    if (filteredSentences.length === 0) {
      console.warn("⚠️ フィルタリング後に有効な文が残りませんでした");
      return rawSentences.slice(0, 5);
    }

    // 3. 各文を形態素解析
    const sentences: SentenceInfo[] = [];
    for (let i = 0; i < filteredSentences.length; i++) {
      const words = await tokenizeSentence(filteredSentences[i]);
      sentences.push({
        id: i,
        text: filteredSentences[i],
        words,
        tfidfScore: 0,
        originalPosition: rawSentences.indexOf(filteredSentences[i]),
      });
    }

    console.log(`✅ ${sentences.length}文の形態素解析完了`);

    if (sentences.length === 0) {
      console.warn("⚠️ 処理可能な文が見つかりませんでした");
      return [];
    }

    // 4. TF-IDFスコア計算
    await calculateTfidfScores(sentences);
    console.log("📊 TF-IDFスコア計算完了");

    // 5. 上位文選択
    const topSentences = selectTopSentences(sentences, finalConfig);
    console.log(`⭐ ${topSentences.length}文を重要文として選択`);

    // 6. 重複除去
    const uniqueSentences = removeDuplicateSentences(topSentences);
    console.log(`🔄 重複除去後: ${uniqueSentences.length}文`);

    // 7. 元の順序でソート
    const resultSentences = uniqueSentences
      .sort((a, b) => a.originalPosition - b.originalPosition)
      .map((s) => s.text);

    console.log(`🎯 最終結果: ${resultSentences.length}文を抽出`);

    // デバッグ情報出力
    if (resultSentences.length > 0) {
      console.log("🔍 抽出された文の例:");
      resultSentences.slice(0, 3).forEach((sentence, index) => {
        console.log(
          `${index + 1}. ${sentence.substring(0, 100)}${
            sentence.length > 100 ? "..." : ""
          }`
        );
      });
    }

    return resultSentences;
  } catch (error) {
    console.error("❌ TF-IDFキーセンテンス抽出でエラー:", error);

    // フォールバック: 先頭から数文を返す
    try {
      const fallbackSentences = splitIntoSentences(text);
      return fallbackSentences.slice(0, Math.min(5, fallbackSentences.length));
    } catch (fallbackError) {
      console.error("❌ フォールバック処理もエラー:", fallbackError);
      return [text.substring(0, 200) + "..."];
    }
  }
};

// デフォルトエクスポート
export default tfidfKeyphraseExtractor;
