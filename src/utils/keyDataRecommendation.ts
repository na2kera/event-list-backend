import {
  computeInterestWeightsFlexible,
  fuseRankings,
  InterestWeightMode,
  FuseMethod,
  ScoredEvent,
  filterEventsWithLLM,
} from "./ragUtils";

// イベント型（最低限 id, keyPhrases, keySentences があれば OK）
export interface EventKeyData {
  id: string;
  keyPhrases: string[];
  keySentences: string[];
  // その他のフィールドは許容
  [key: string]: any;
}

export interface RecommendationOptions {
  interestModes?: InterestWeightMode[]; // default ["concat"]
  fuseMethods?: FuseMethod[]; // default ["weighted"]
  similarityThreshold?: number; // default 0.35
  topN?: number; // default 5
}

export interface RecommendedEvent {
  event: EventKeyData;
  score: number; // RRF スコア (0〜∞)
  label: string; // 実験設定 (mode / fuse)
}

/**
 * keyPhrases と keySentences を用いてイベント推薦を行う関数
 * オリジナル scripts/similarityTest.ts のロジックを流用し、
 *   - キーワード → keyPhrases
 *   - スクリプト → 関数 API
 * に変更。
 * @param userTag  ユーザーの興味・目標などを 1 文で記述したテキスト
 * @param events   keyPhrases / keySentences を含むイベント配列
 * @param opts     オプション設定
 * @returns        推薦イベント (TopN) の配列（設定毎）
 */
export const recommendEventsWithKeyData = async (
  userTag: string,
  events: EventKeyData[],
  opts: RecommendationOptions = {}
): Promise<RecommendedEvent[]> => {
  // ===== オプション解決 =====
  // 引数で明示されない場合は 1 通りのみ実行する（デフォルト: concat + weighted）
  const interestModes = opts.interestModes ?? ["concat"];
  const fuseMethods = opts.fuseMethods ?? ["weighted"];
  const similarityThreshold = opts.similarityThreshold ?? 0.35;
  const topN = opts.topN ?? 5;

  // keyPhrases / keySentences を EventElement 形式に変換
  const phraseEvents = events.map((ev) => ({
    id: ev.id,
    keywords: ev.keyPhrases,
  }));
  const sentenceEvents = events.map((ev) => ({
    id: ev.id,
    keywords: ev.keySentences,
  }));

  const results: RecommendedEvent[] = [];

  for (const iMode of interestModes) {
    // 類似度スコア計算
    const phraseRank = await computeInterestWeightsFlexible(
      userTag,
      phraseEvents,
      { mode: iMode }
    );
    const sentenceRank = await computeInterestWeightsFlexible(
      userTag,
      sentenceEvents,
      { mode: iMode }
    );

    for (const fMethod of fuseMethods) {
      const fused: ScoredEvent[] = fuseRankings(fMethod, [
        phraseRank,
        sentenceRank,
      ]);

      // 厳格フィルタ: phrase/sentence 類似度平均が threshold 以上
      const pMap = new Map(phraseRank.map((e) => [e.id, e.score]));
      const sMap = new Map(sentenceRank.map((e) => [e.id, e.score]));

      const strictCandidates = fused.filter((e) => {
        const avg = ((pMap.get(e.id) ?? 0) + (sMap.get(e.id) ?? 0)) / 2;
        return avg >= similarityThreshold;
      });

      const top = strictCandidates.slice(0, topN);
      const label = `[mode:${iMode}][fuse:${fMethod}]`;

      // 結果を整形
      for (const evScore of top) {
        const evObj = events.find((ev) => ev.id === evScore.id);
        if (evObj) {
          results.push({ event: evObj, score: evScore.score, label });
        }
      }
    }
  }

  // LLMによる最終フィルタリング
  const filteredResults = await filterEventsWithLLM(userTag, results);

  return filteredResults;
};
