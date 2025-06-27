import { RequestHandler } from "express";
import { getUserWithDetailsById } from "../utils/userUtils";
import { getFilteredEvents } from "../utils/eventUtils";
import {
  recommendEventsWithKeyData,
  RecommendedEvent,
  EventKeyData,
} from "../utils/keyDataRecommendation";

/**
 * POST /api/recommend/user
 * body: { userId }
 * ユーザーの興味タグごとにレコメンドを返す
 */
export const recommendByUser: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ message: "userId は必須です" });
      return;
    }

    // ユーザー取得
    const user = await getUserWithDetailsById(userId);
    if (!user) {
      res
        .status(404)
        .json({ message: `ユーザー ${userId} が見つかりません。` });
      return;
    }

    const tags: string[] = (user.tag as any) || [];
    if (tags.length === 0) {
      res.status(200).json({ message: "興味タグが未設定", data: [] });
      return;
    }

    // 場所・形式で直接DBクエリ
    const locationRaw = (user.place || "").toString();
    const locLower = locationRaw.toLowerCase();
    const filterOpts: any = {};
    if (locationRaw) {
      if (locLower === "online") {
        filterOpts.format = "ONLINE"; // Prisma enum への一致を想定
      } else {
        filterOpts.location = locationRaw;
      }
    }

    const events = await getFilteredEvents(filterOpts);
    const eventKeyData: EventKeyData[] = events.map((ev: any) => ({
      id: ev.id,
      keyPhrases: ev.keyPhrases || [],
      keySentences: ev.keySentences || [],
      ...ev,
    }));

    if (eventKeyData.length === 0) {
      res
        .status(200)
        .json({ message: "該当する場所のイベントがありません。", data: [] });
      return;
    }

    const results: { tag: string; recommendations: RecommendedEvent[] }[] = [];
    for (const tag of tags) {
      const recs = await recommendEventsWithKeyData(tag, eventKeyData);
      results.push({ tag, recommendations: recs });
    }

    // 開発用ログ
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[recommendByUser] results:\n",
        JSON.stringify(results, null, 2)
      );
    }

    res.json(results);
    return;
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/recommend/tag
 * body: { userId, tag }
 * 指定タグでレコメンドを返す
 */
export const recommendByTag: RequestHandler = async (req, res, next) => {
  try {
    const { userId, tag } = req.body;
    if (!userId || !tag) {
      res.status(400).json({ message: "userId と tag の両方が必須です" });
      return;
    }

    const user = await getUserWithDetailsById(userId);
    if (!user) {
      res
        .status(404)
        .json({ message: `ユーザー ${userId} が見つかりません。` });
      return;
    }

    // 場所・形式で直接DBクエリ
    const locRaw = (user.place || "").toString();
    const locLower = locRaw.toLowerCase();
    const filterOpts: any = {};
    if (locRaw) {
      if (locLower === "online") filterOpts.format = "ONLINE";
      else filterOpts.location = locRaw;
    }

    const events = await getFilteredEvents(filterOpts);

    const eventKeyData: EventKeyData[] = events.map((ev: any) => ({
      id: ev.id,
      keyPhrases: ev.keyPhrases || [],
      keySentences: ev.keySentences || [],
      ...ev,
    }));

    if (eventKeyData.length === 0) {
      res
        .status(200)
        .json({ message: "該当する場所のイベントがありません。", data: [] });
      return;
    }

    const recommendations = await recommendEventsWithKeyData(tag, eventKeyData);

    // 開発用ログ
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[recommendByTag] tag=${tag} recommendations:\n`,
        JSON.stringify(recommendations, null, 2)
      );
    }

    res.json({ tag, recommendations });
    return;
  } catch (err) {
    next(err);
  }
};
