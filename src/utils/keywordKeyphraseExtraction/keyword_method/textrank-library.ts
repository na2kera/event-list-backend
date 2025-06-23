// kuromoji.jsの型定義（既存TF-IDFライブラリから流用）
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
 * 日本語形態素解析器の初期化（既存TF-IDFライブラリから流用）
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
 * 日本語テキストを形態素解析してキーワード候補を返す
 */
const tokenizeJapaneseForTextRank = async (text: string): Promise<string[]> => {
  try {
    const _tokenizer = await initializeTokenizer();
    const tokens = _tokenizer.tokenize(text);

    const filteredTokens = tokens.filter((token) => {
      const pos = token.pos;
      const detail1 = token.pos_detail_1;
      // TextRankでは名詞と形容詞を主に使用
      return (
        (pos === "名詞" &&
          !["接続詞的", "数", "非自立", "代名詞"].includes(detail1)) ||
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
 * TextRankグラフの構築
 */
interface TextRankGraph {
  [word: string]: {
    score: number;
    connections: { [connectedWord: string]: number };
  };
}

const buildTextRankGraph = (
  words: string[],
  windowSize: number = 2
): TextRankGraph => {
  const graph: TextRankGraph = {};

  // 全ての単語をグラフに追加
  words.forEach((word) => {
    if (!graph[word]) {
      graph[word] = { score: 1.0, connections: {} };
    }
  });

  // 共起関係の構築（窓幅内の単語同士を接続）
  for (let i = 0; i < words.length; i++) {
    const currentWord = words[i];

    for (let j = i + 1; j < Math.min(i + windowSize + 1, words.length); j++) {
      const connectedWord = words[j];

      if (currentWord !== connectedWord) {
        // 双方向のエッジを追加（重みは共起頻度）
        if (!graph[currentWord].connections[connectedWord]) {
          graph[currentWord].connections[connectedWord] = 0;
        }
        if (!graph[connectedWord].connections[currentWord]) {
          graph[connectedWord].connections[currentWord] = 0;
        }

        graph[currentWord].connections[connectedWord] += 1;
        graph[connectedWord].connections[currentWord] += 1;
      }
    }
  }

  return graph;
};

/**
 * PageRankアルゴリズムの実行
 */
const calculatePageRank = (
  graph: TextRankGraph,
  dampingFactor: number = 0.85,
  iterations: number = 30,
  tolerance: number = 0.0001
): TextRankGraph => {
  const words = Object.keys(graph);
  const wordCount = words.length;

  if (wordCount === 0) return graph;

  // 初期スコアの設定
  words.forEach((word) => {
    graph[word].score = 1.0;
  });

  // PageRankの反復計算
  for (let iter = 0; iter < iterations; iter++) {
    const newScores: { [word: string]: number } = {};
    let maxChange = 0;

    words.forEach((word) => {
      let sum = 0;

      // 接続されている単語からのスコア計算
      Object.keys(graph[word].connections).forEach((connectedWord) => {
        const connectionWeight = graph[word].connections[connectedWord];
        const connectedWordTotalWeight = Object.values(
          graph[connectedWord].connections
        ).reduce((a, b) => a + b, 0);

        if (connectedWordTotalWeight > 0) {
          sum +=
            (connectionWeight / connectedWordTotalWeight) *
            graph[connectedWord].score;
        }
      });

      newScores[word] = 1 - dampingFactor + dampingFactor * sum;
      maxChange = Math.max(
        maxChange,
        Math.abs(newScores[word] - graph[word].score)
      );
    });

    // スコアの更新
    words.forEach((word) => {
      graph[word].score = newScores[word];
    });

    // 収束判定
    if (maxChange < tolerance) {
      console.log(`✅ TextRank収束: ${iter + 1}回目の反復で完了`);
      break;
    }
  }

  return graph;
};

/**
 * TextRankを使用したキーワード抽出メソッド
 * @param text 分析対象の文章
 * @returns キーワード配列（スコア順）
 */
export const textrankKeywordExtractor = async (
  text: string
): Promise<string[]> => {
  try {
    console.log("\n🎯 TextRank キーワード抽出開始");

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です。");
      return [];
    }

    // 1. 日本語形態素解析
    const words = await tokenizeJapaneseForTextRank(text);

    if (words.length < 3) {
      console.log("⚠️ 有効な単語が少なすぎます。");
      return words.slice(0, 10);
    }

    console.log(`📝 ${words.length}語を分析します...`);

    // 2. TextRankグラフの構築
    const graph = buildTextRankGraph(words, 2); // 窓幅2

    // 3. PageRankの計算
    const rankedGraph = calculatePageRank(graph, 0.85, 30);

    // 4. スコア順にソートして上位20件を返す
    const sortedKeywords = Object.entries(rankedGraph)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 20)
      .map(([word]) => word);

    console.log("🏆 TextRank最終結果:", sortedKeywords);
    return sortedKeywords;
  } catch (error) {
    console.error("❌ TextRank抽出処理で予期せぬエラー:", error);
    // フォールバック処理
    try {
      const fallbackWords = await tokenizeJapaneseForTextRank(text);
      return fallbackWords.slice(0, 10);
    } catch (fallbackError) {
      console.error("❌ フォールバック処理もエラー:", fallbackError);
      return [];
    }
  }
};
