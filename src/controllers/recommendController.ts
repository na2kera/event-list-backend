import { RequestHandler } from "express";
import { getUserWithDetailsById } from "../utils/userUtils";
import { getAllEvents } from "../utils/eventUtils";
import {
  recommendEventsWithKeyData,
  EventKeyData,
  RecommendedEvent,
} from "../utils/keyDataRecommendation";

/**
 * GET /api/recommend/:userId
 * ユーザーの興味タグごとにイベントレコメンドを実行して返す API
 * 返却形式:
 * {
 *   tag: string;
 *   recommendations: RecommendedEvent[];
 * }[]
 */
export const recommendEventsForUser: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const { userId } = req.params;

    // ユーザー情報取得
    const user = await getUserWithDetailsById(userId);
    if (!user) {
      res
        .status(404)
        .json({ message: `ユーザー ${userId} が見つかりません。` });
      return;
    }

    // 興味タグを取得 (string[] 想定)
    const tags: string[] = (user.tag as any) || [];
    if (tags.length === 0) {
      res.status(200).json({
        message: "興味タグが未設定のため、レコメンドできません。",
        data: [],
      });
      return;
    }

    // 全イベント取得 (keyPhrases / keySentences を含む)
    const events = await getAllEvents(false); // relations 不要

    // EventKeyData 形式に変換
    const eventKeyData: EventKeyData[] = events.map((ev: any) => ({
      id: ev.id,
      keyPhrases: ev.keyPhrases || [],
      keySentences: ev.keySentences || [],
      ...ev,
    }));

    // ------------- ユーザー所在地でフィルタリング -------------
    const userPlace = (user.place || "").toString().toLowerCase();
    const filteredByPlace = userPlace
      ? eventKeyData.filter((ev) => {
          const p = (ev.place || "").toString().toLowerCase();
          if (userPlace === "online") {
            // online 指定 → 場所が online もしくは未設定のイベント
            return p.includes("online") || p === "";
          }
          return p.includes(userPlace);
        })
      : eventKeyData;

    if (filteredByPlace.length === 0) {
      res
        .status(200)
        .json({ message: "該当する場所のイベントがありません。", data: [] });
      return;
    }

    const allResults: { tag: string; recommendations: RecommendedEvent[] }[] =
      [];

    for (const tag of tags) {
      const recs = await recommendEventsWithKeyData(tag, filteredByPlace);
      allResults.push({ tag, recommendations: recs });
    }

    res.json(allResults);
    return;
  } catch (error) {
    next(error);
  }
};
