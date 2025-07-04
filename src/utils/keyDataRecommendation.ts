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
  title: string; // イベントタイトル
  detail: string; // 詳細説明（長文可）
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
  /**
   * LLM が返す推薦理由（任意）。filterEventsWithLLM で付与される。
   */
  reason?: string;
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

  console.log("=== レコメンデーション開始 ===");
  console.log(`ユーザータグ: ${userTag}`);
  console.log(`類似度閾値: ${similarityThreshold}, 上位N件: ${topN}`);
  console.log(
    `興味モード: ${interestModes.join(", ")}, 融合方法: ${fuseMethods.join(
      ", "
    )}`
  );
  console.log(`イベント数: ${events.length}`);

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
    console.log(`\n=== 興味モード: ${iMode} ===`);

    // 類似度スコア計算
    console.log("キーフレーズ類似度計算中...");
    const phraseRank = await computeInterestWeightsFlexible(
      userTag,
      phraseEvents,
      { mode: iMode }
    );

    console.log("キーセンテンス類似度計算中...");
    const sentenceRank = await computeInterestWeightsFlexible(
      userTag,
      sentenceEvents,
      { mode: iMode }
    );

    // 類似度スコアのデバッグ出力
    console.log("\n=== 類似度スコア (上位5件) ===");
    console.log("キーフレーズ類似度 (降順):");
    phraseRank.slice(0, 5).forEach((item, i) => {
      console.log(
        `  ${i + 1}. イベントID: ${item.id}, スコア: ${item.score.toFixed(4)}`
      );
    });

    console.log("\nキーセンテンス類似度 (降順):");
    sentenceRank.slice(0, 5).forEach((item, i) => {
      console.log(
        `  ${i + 1}. イベントID: ${item.id}, スコア: ${item.score.toFixed(4)}`
      );
    });

    for (const fMethod of fuseMethods) {
      console.log(`\n=== ランキング融合: ${fMethod} ===`);

      const fused: ScoredEvent[] = fuseRankings(fMethod, [
        phraseRank,
        sentenceRank,
      ]);

      // 融合結果のデバッグ出力
      console.log("融合後ランキング (上位10件):");
      fused.slice(0, 10).forEach((item, i) => {
        console.log(
          `  ${i + 1}. イベントID: ${item.id}, スコア: ${item.score.toFixed(4)}`
        );
      });

      // 厳格フィルタ: phrase/sentence 類似度平均が threshold 以上
      const pMap = new Map(phraseRank.map((e) => [e.id, e.score]));
      const sMap = new Map(sentenceRank.map((e) => [e.id, e.score]));

      const strictCandidates = fused.filter((e) => {
        const avg = ((pMap.get(e.id) ?? 0) + (sMap.get(e.id) ?? 0)) / 2;
        return avg >= similarityThreshold;
      });

      console.log(`\n閾値フィルタ適用後 (閾値: ${similarityThreshold}):`);
      console.log(
        `  フィルタ前: ${fused.length}件 → フィルタ後: ${strictCandidates.length}件`
      );

      const top = strictCandidates.slice(0, topN);
      const label = `[mode:${iMode}][fuse:${fMethod}]`;

      // 結果を整形
      for (const evScore of top) {
        const evObj = events.find((ev) => ev.id === evScore.id);
        if (evObj) {
          results.push({ event: evObj, score: evScore.score, label });
        }
      }

      console.log("\n最終推薦結果 (上位5件):");
      results.slice(0, 5).forEach((item, i) => {
        console.log(
          `  ${i + 1}. イベントID: ${
            item.event.id
          }, スコア: ${item.score.toFixed(4)}, ラベル: ${item.label}`
        );
      });
    }
  }

  // LLMによる最終フィルタリング
  console.log("\n=== LLMによる最終フィルタリング開始 ===");
  const filteredResults = await filterEventsWithLLM(userTag, results);
  console.log("LLMフィルタリング完了");
  console.log(
    `  フィルタ前: ${results.length}件 → フィルタ後: ${filteredResults.length}件`
  );

  return filteredResults;
};
