import "dotenv/config";
import {
  computeInterestWeightsFlexible,
  fuseRankings,
  EventElement,
  InterestWeightMode,
  FuseMethod,
} from "../src/utils/similarityUtils";
import { detailedEvents } from "./mockEventData";

(async () => {
  try {
    const userTag = "Webアプリのバックエンドを勉強したい";

    // --- イベントデータを読み込み ------------------------
    const kwEvents: EventElement[] = detailedEvents.map((ev) => ({
      id: ev.id,
      keywords: ev.keywords,
    }));

    const sentenceEvents: EventElement[] = detailedEvents.map((ev) => ({
      id: ev.id,
      keywords: ev.keySentences, // センテンスを keywords とみなす
    }));

    // 比較設定
    const interestModes: InterestWeightMode[] = ["concat", "per_keyword"];
    const fuseMethods: FuseMethod[] = ["rrf", "weighted"];

    for (const iMode of interestModes) {
      // interest weights 計算（keyword / sentence）
      const kwRank = await computeInterestWeightsFlexible(userTag, kwEvents, {
        mode: iMode,
      });
      const sentenceRank = await computeInterestWeightsFlexible(
        userTag,
        sentenceEvents,
        { mode: iMode }
      );

      for (const fMethod of fuseMethods) {
        const fused = fuseRankings(fMethod, [kwRank, sentenceRank]);

        const label = `[mode:${iMode}][fuse:${fMethod}]`;

        // ================= 厳格フィルタ =================
        const similarityThreshold = 0.35;
        const kwMap = new Map(kwRank.map((e) => [e.id, e.score]));
        const sentMap = new Map(sentenceRank.map((e) => [e.id, e.score]));

        const strictCandidates = fused.filter((e) => {
          const avg = ((kwMap.get(e.id) ?? 0) + (sentMap.get(e.id) ?? 0)) / 2;
          return avg >= similarityThreshold;
        });

        console.log(`\n=== ${label} top5 ===`);
        const top5 = strictCandidates.slice(0, 5);
        console.table(top5);

        // フルオブジェクトも見たい場合
        const detailObjs = top5.map((e) => {
          const ev = detailedEvents.find((d) => d.id === e.id)!;
          return { ...ev, score: e.score.toFixed(4) };
        });
        console.log("詳細: \n" + JSON.stringify(detailObjs, null, 2));
      }
    }

    // 以降の ChatGPT への推薦は比較用には不要なのでコメントアウト
  } catch (err) {
    console.error(err);
  }
})();
