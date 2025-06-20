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

// TopicRank専用の型定義
interface PhraseCandidate {
  phrase: string;
  tokens: string[];
  startPosition: number;
  endPosition: number;
  frequency: number;
  posSequence: string[];
}

interface TopicCluster {
  id: string;
  phrases: PhraseCandidate[];
  representative: PhraseCandidate | null;
  score: number;
  connections: { [clusterId: string]: number };
}

interface TopicGraph {
  [clusterId: string]: TopicCluster;
}

interface TopicRankConfig {
  maxPhraseLength: number;
  similarityThreshold: number;
  maxCandidates: number;
  dampingFactor: number;
  iterations: number;
  topK: number;
}

// グローバルにtokenizerを保持（初期化コストを削減）
let tokenizer: KuromojiTokenizer | null = null;

// デフォルト設定（日本語最適化）
const DEFAULT_CONFIG: TopicRankConfig = {
  maxPhraseLength: 4, // 最大4語のフレーズ
  similarityThreshold: 0.3, // 日本語向け調整
  maxCandidates: 100, // 計算量制限
  dampingFactor: 0.85, // PageRankの標準値
  iterations: 30, // 最大反復回数
  topK: 20, // 返すキーワード数
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
 * 日本語テキストからフレーズ候補を抽出
 */
const extractPhraseCandidates = async (
  text: string,
  config: TopicRankConfig
): Promise<PhraseCandidate[]> => {
  try {
    const _tokenizer = await initializeTokenizer();
    const tokens = _tokenizer.tokenize(text);

    // 名詞・形容詞のフィルタリング
    const validTokens = tokens.filter((token) => {
      const pos = token.pos;
      const detail1 = token.pos_detail_1;
      return (
        (pos === "名詞" &&
          !["接続詞的", "数", "非自立", "代名詞"].includes(detail1)) ||
        (pos === "形容詞" && detail1 !== "非自立")
      );
    });

    const phrases: PhraseCandidate[] = [];
    const phraseFrequency = new Map<string, number>();

    // N-gramフレーズの生成（1語から最大長まで）
    for (let i = 0; i < validTokens.length; i++) {
      for (
        let j = 1;
        j <= config.maxPhraseLength && i + j <= validTokens.length;
        j++
      ) {
        const phraseTokens = validTokens.slice(i, i + j);
        const phraseText = phraseTokens
          .map((token) => token.basic_form || token.surface_form)
          .join("");

        if (phraseText.length > 1 && !/^[a-zA-Z0-9]+$/.test(phraseText)) {
          // 頻度をカウント
          const currentFreq = phraseFrequency.get(phraseText) || 0;
          phraseFrequency.set(phraseText, currentFreq + 1);

          // 初回出現時のみフレーズ候補として追加
          if (currentFreq === 0) {
            phrases.push({
              phrase: phraseText,
              tokens: phraseTokens.map((t) => t.basic_form || t.surface_form),
              startPosition: i,
              endPosition: i + j - 1,
              frequency: 1,
              posSequence: phraseTokens.map((t) => t.pos),
            });
          }
        }
      }
    }

    // 頻度情報を更新
    phrases.forEach((phrase) => {
      phrase.frequency = phraseFrequency.get(phrase.phrase) || 1;
    });

    // 頻度順にソートして上位候補を返す
    return phrases
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, config.maxCandidates);
  } catch (error) {
    console.error("❌ フレーズ抽出エラー:", error);
    return [];
  }
};

/**
 * Jaro-Winkler距離を計算
 */
const jaroWinklerDistance = (s1: string, s2: string): number => {
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  if (matchWindow < 0) return 0.0;

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // マッチする文字を見つける
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // 転置をカウント
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / len1 +
      matches / len2 +
      (matches - transpositions / 2) / matches) /
    3.0;

  // Winkler プレフィックス補正
  let prefix = 0;
  for (let i = 0; i < Math.min(len1, len2, 4); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + 0.1 * prefix * (1.0 - jaro);
};

/**
 * Jaccard類似度を計算
 */
const jaccardSimilarity = (tokensA: string[], tokensB: string[]): number => {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
};

/**
 * フレーズ間の類似度を計算
 */
const calculatePhraseSimilarity = (
  phraseA: PhraseCandidate,
  phraseB: PhraseCandidate
): number => {
  // 文字列レベルの類似度（Jaro-Winkler）
  const stringSimilarity = jaroWinklerDistance(phraseA.phrase, phraseB.phrase);

  // トークンレベルの類似度（Jaccard）
  const tokenSimilarity = jaccardSimilarity(phraseA.tokens, phraseB.tokens);

  // 重み付け平均（文字列重視）
  return stringSimilarity * 0.7 + tokenSimilarity * 0.3;
};

/**
 * 階層的クラスタリングでトピックを形成
 */
const hierarchicalClustering = (
  phrases: PhraseCandidate[],
  config: TopicRankConfig
): TopicCluster[] => {
  const clusters: TopicCluster[] = [];

  // 初期状態：各フレーズが独立したクラスタ
  const activeClusters: TopicCluster[] = phrases.map((phrase, index) => ({
    id: `cluster_${index}`,
    phrases: [phrase],
    representative: phrase,
    score: 0,
    connections: {},
  }));

  // 類似度が閾値を超える場合にクラスタを統合
  let merged = true;
  while (merged && activeClusters.length > 1) {
    merged = false;
    let maxSimilarity = 0;
    let mergeIndices: [number, number] = [0, 0];

    // 最も類似度の高いクラスタペアを見つける
    for (let i = 0; i < activeClusters.length; i++) {
      for (let j = i + 1; j < activeClusters.length; j++) {
        // クラスタ間の平均類似度を計算
        let totalSimilarity = 0;
        let pairCount = 0;

        for (const phraseA of activeClusters[i].phrases) {
          for (const phraseB of activeClusters[j].phrases) {
            totalSimilarity += calculatePhraseSimilarity(phraseA, phraseB);
            pairCount++;
          }
        }

        const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;

        if (
          avgSimilarity > maxSimilarity &&
          avgSimilarity >= config.similarityThreshold
        ) {
          maxSimilarity = avgSimilarity;
          mergeIndices = [i, j];
          merged = true;
        }
      }
    }

    // クラスタを統合
    if (merged) {
      const [i, j] = mergeIndices;
      const mergedCluster: TopicCluster = {
        id: `merged_${activeClusters[i].id}_${activeClusters[j].id}`,
        phrases: [...activeClusters[i].phrases, ...activeClusters[j].phrases],
        representative: activeClusters[i].representative, // 暫定的に最初のクラスタの代表を使用
        score: 0,
        connections: {},
      };

      // 新しい代表フレーズを選択（最高頻度）
      mergedCluster.representative = mergedCluster.phrases.reduce(
        (max, phrase) => (phrase.frequency > max.frequency ? phrase : max)
      );

      // 統合済みクラスタを削除し、新クラスタを追加
      activeClusters.splice(Math.max(i, j), 1);
      activeClusters.splice(Math.min(i, j), 1);
      activeClusters.push(mergedCluster);
    }
  }

  return activeClusters;
};

/**
 * トピック間のグラフを構築
 */
const buildTopicGraph = (clusters: TopicCluster[]): TopicGraph => {
  const graph: TopicGraph = {};

  // グラフにクラスタを追加
  clusters.forEach((cluster) => {
    graph[cluster.id] = { ...cluster };
  });

  // トピック間の関係性を計算（出現位置の近さで重み付け）
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const clusterA = clusters[i];
      const clusterB = clusters[j];

      let totalWeight = 0;
      let connectionCount = 0;

      // 各クラスタのフレーズ間の位置関係を計算
      for (const phraseA of clusterA.phrases) {
        for (const phraseB of clusterB.phrases) {
          const distance = Math.abs(
            phraseA.startPosition - phraseB.startPosition
          );
          if (distance > 0) {
            totalWeight += 1 / distance; // 距離の逆数
            connectionCount++;
          }
        }
      }

      if (connectionCount > 0) {
        const avgWeight = totalWeight / connectionCount;
        graph[clusterA.id].connections[clusterB.id] = avgWeight;
        graph[clusterB.id].connections[clusterA.id] = avgWeight;
      }
    }
  }

  return graph;
};

/**
 * PageRankアルゴリズムでトピックの重要度を計算
 */
const calculateTopicRank = (
  graph: TopicGraph,
  config: TopicRankConfig
): TopicGraph => {
  const clusterIds = Object.keys(graph);
  const clusterCount = clusterIds.length;

  if (clusterCount === 0) return graph;

  // 初期スコアの設定
  clusterIds.forEach((clusterId) => {
    graph[clusterId].score = 1.0;
  });

  // PageRankの反復計算
  for (let iter = 0; iter < config.iterations; iter++) {
    const newScores: { [clusterId: string]: number } = {};
    let maxChange = 0;

    clusterIds.forEach((clusterId) => {
      let sum = 0;

      // 接続されているクラスタからのスコア計算
      Object.keys(graph[clusterId].connections).forEach((connectedId) => {
        const connectionWeight = graph[clusterId].connections[connectedId];
        const connectedTotalWeight = Object.values(
          graph[connectedId].connections
        ).reduce((a, b) => a + b, 0);

        if (connectedTotalWeight > 0) {
          sum +=
            (connectionWeight / connectedTotalWeight) *
            graph[connectedId].score;
        }
      });

      newScores[clusterId] =
        1 - config.dampingFactor + config.dampingFactor * sum;
      maxChange = Math.max(
        maxChange,
        Math.abs(newScores[clusterId] - graph[clusterId].score)
      );
    });

    // スコアの更新
    clusterIds.forEach((clusterId) => {
      graph[clusterId].score = newScores[clusterId];
    });

    // 収束判定
    if (maxChange < 0.0001) {
      console.log(`✅ TopicRank収束: ${iter + 1}回目の反復で完了`);
      break;
    }
  }

  return graph;
};

/**
 * 各トピックから代表フレーズを選択
 */
const selectRepresentativePhrases = (
  rankedGraph: TopicGraph,
  config: TopicRankConfig
): string[] => {
  // スコア順にクラスタをソート
  const sortedClusters = Object.values(rankedGraph)
    .sort((a, b) => b.score - a.score)
    .slice(0, config.topK);

  const representatives: string[] = [];

  sortedClusters.forEach((cluster) => {
    if (cluster.representative) {
      representatives.push(cluster.representative.phrase);
    } else if (cluster.phrases.length > 0) {
      // フォールバック：最高頻度のフレーズを選択
      const bestPhrase = cluster.phrases.reduce((max, phrase) =>
        phrase.frequency > max.frequency ? phrase : max
      );
      representatives.push(bestPhrase.phrase);
    }
  });

  return representatives;
};

/**
 * TopicRankを使用したキーワード抽出メイン関数
 * @param text 分析対象の文章
 * @returns キーワード配列（重要度順）
 */
export const topicrankKeywordExtractor = async (
  text: string
): Promise<string[]> => {
  try {
    console.log("\n🎯 TopicRank キーワード抽出開始");

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.log("⚠️ 入力テキストが無効です。");
      return [];
    }

    const config = DEFAULT_CONFIG;

    // 1. フレーズ候補の抽出
    const phrases = await extractPhraseCandidates(text, config);

    if (phrases.length < 2) {
      console.log("⚠️ 有効なフレーズが少なすぎます。");
      return phrases.map((p) => p.phrase).slice(0, 10);
    }

    console.log(`📝 ${phrases.length}個のフレーズ候補を分析します...`);

    // 2. 階層的クラスタリングでトピック形成
    const clusters = hierarchicalClustering(phrases, config);
    console.log(`🔗 ${clusters.length}個のトピッククラスタを形成しました`);

    // 3. トピック間グラフの構築
    const graph = buildTopicGraph(clusters);

    // 4. PageRankでトピック重要度を計算
    const rankedGraph = calculateTopicRank(graph, config);

    // 5. 代表フレーズの選択
    const keywords = selectRepresentativePhrases(rankedGraph, config);

    console.log("🏆 TopicRank最終結果:", keywords);
    return keywords;
  } catch (error) {
    console.error("❌ TopicRank抽出処理で予期せぬエラー:", error);
    // フォールバック処理
    try {
      const _tokenizer = await initializeTokenizer();
      const tokens = _tokenizer.tokenize(text);
      const fallbackWords = tokens
        .filter(
          (token) => token.pos === "名詞" && token.pos_detail_1 !== "非自立"
        )
        .map((token) => token.basic_form || token.surface_form)
        .filter((word) => word && word.length > 1)
        .slice(0, 10);
      return fallbackWords;
    } catch (fallbackError) {
      console.error("❌ フォールバック処理もエラー:", fallbackError);
      return [];
    }
  }
};
