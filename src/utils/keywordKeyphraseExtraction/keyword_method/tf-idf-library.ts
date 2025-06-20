import natural from "natural";

// kuromoji.jsの型定義（簡易版）
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

// グローバルにtokenizerを保持（初期化コストを削減）
let tokenizer: KuromojiTokenizer | null = null;

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
 * 日本語テキストを形態素解析して単語配列を返す
 */
const tokenizeJapaneseToArray = async (text: string): Promise<string[]> => {
  try {
    const _tokenizer = await initializeTokenizer();
    const tokens = _tokenizer.tokenize(text);

    const filteredTokens = tokens.filter((token) => {
      const pos = token.pos;
      const detail1 = token.pos_detail_1;
      // 名詞（非自立、数、接続詞的、代名詞を除く）、動詞（非自立を除く）、形容詞を抽出
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
    return text.split(/\s+/).filter((w) => w && w.length > 1);
  }
};

/**
 * 文書の有効性をチェックする（より厳密な検証）
 */
const validateDocument = (doc: any, minWords: number = 3): doc is string => {
  // 型チェック
  if (typeof doc !== "string") {
    console.log(`⚠️ 文字列ではない文書: ${typeof doc} - ${doc}`);
    return false;
  }

  // null/undefined チェック
  if (!doc || doc === null || doc === undefined) {
    console.log(`⚠️ null/undefinedの文書`);
    return false;
  }

  // 空文字列チェック
  const trimmed = doc.trim();
  if (trimmed.length === 0) {
    console.log(`⚠️ 空の文書`);
    return false;
  }

  // 単語数チェック
  const words = trimmed.split(/\s+/).filter((word) => word && word.length > 0);
  if (words.length < minWords) {
    console.log(
      `⚠️ 短すぎる文書（${words.length}語）: ${trimmed.substring(0, 50)}`
    );
    return false;
  }

  return true;
};

/**
 * TF-IDFを使用したキーワード抽出メソッド（natural.js版）
 */
export const tfidfKeywordExtractor = async (
  text: string
): Promise<string[]> => {
  try {
    console.log("\n🎯 TF-IDF キーワード抽出開始 (Natural.js版)");

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です。");
      return [];
    }

    // 日本語形態素解析
    const words = await tokenizeJapaneseToArray(text);

    if (words.length < 10) {
      console.log("⚠️ 有効な単語が少なすぎます。");
      return words.slice(0, 10);
    }

    console.log(`📝 ${words.length}語を分析します...`);

    // Natural.jsのTfIdfインスタンスを作成
    const tfidf = new natural.TfIdf();

    // 文書分割（15語ずつのチャンクに分割）
    const chunkSize = 15;
    const documents: string[][] = [];

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize);
      if (chunk.length >= 3) {
        // 最小3語以上のチャンクのみ使用
        documents.push(chunk);
      }
    }

    if (documents.length < 2) {
      console.log("⚠️ TF-IDFを適用できる文書が不足しています。");
      return words.slice(0, 20);
    }

    console.log(`✅ ${documents.length}個の文書を生成しました。`);

    // 各文書をTfIdfインスタンスに追加
    documents.forEach((doc) => {
      tfidf.addDocument(doc);
    });

    // 全文書から重要度の高い語句を抽出
    const allTerms = new Map<string, number>();

    // 各文書の重要語句を取得してスコアを集計
    for (let i = 0; i < documents.length; i++) {
      const terms = tfidf.listTerms(i);

      // 上位10語まで取得
      terms.slice(0, 10).forEach((item) => {
        const currentScore = allTerms.get(item.term) || 0;
        allTerms.set(item.term, Math.max(currentScore, item.tfidf));
      });
    }

    if (allTerms.size === 0) {
      console.log("⚠️ キーワードが抽出できませんでした。");
      return words.slice(0, 20);
    }

    // スコア順にソートして上位20件を返す
    const sortedKeywords = Array.from(allTerms.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term]) => term);

    console.log("🏆 最終キーワード抽出結果:", sortedKeywords);
    return sortedKeywords;
  } catch (error) {
    console.error("❌ TF-IDF抽出処理で予期せぬエラー:", error);
    // フォールバック処理
    try {
      const fallbackWords = await tokenizeJapaneseToArray(text);
      return fallbackWords.slice(0, 10);
    } catch (fallbackError) {
      console.error("❌ フォールバック処理もエラー:", fallbackError);
      return text
        .split(/\s+/)
        .filter((word) => word && word.length > 1)
        .slice(0, 10);
    }
  }
};

/**
 * 同期版（後方互換性のため）
 */
export const tfidfKeywordExtractorSync = (text: string): string[] => {
  console.warn(
    "⚠️ 同期版 tfidfKeywordExtractorSync は非推奨です。async版の使用を強く推奨します。"
  );

  // 非常に簡易的なフォールバック
  return text
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 10);
};

export default tfidfKeywordExtractor;
