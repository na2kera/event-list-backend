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
      title: ev.title,
      detail: ev.detail,
      keyPhrases: ev.keyPhrases || [],
      keySentences: ev.keySentences || [],
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
 * POST /api/recommend/message
 * body: { message, userId? }
 * フリーテキスト（メッセージ）でレコメンドを返す
 */
export const recommendByMessage: RequestHandler = async (req, res, next) => {
  try {
    const { userId, message, tags } = req.body;
    if (!message && (!tags || tags.length === 0)) {
      res
        .status(400)
        .json({ message: "message または tags のいずれかは必須です" });
      return;
    }

    // ユーザーが指定されている場合のみユーザー情報を取得し、場所フィルタを適用
    let filterOpts: any = {};
    if (userId) {
      const user = await getUserWithDetailsById(userId);
      if (!user) {
        res
          .status(404)
          .json({ message: `ユーザー ${userId} が見つかりません。` });
        return;
      }

      const locRaw = (user.place || "").toString();
      const locLower = locRaw.toLowerCase();
      if (locRaw) {
        if (locLower === "online") filterOpts.format = "ONLINE";
        else filterOpts.location = locRaw;
      }
    }
    const events = await getFilteredEvents(filterOpts);

    const eventKeyData: EventKeyData[] = events.map((ev: any) => ({
      id: ev.id,
      title: ev.title,
      detail: ev.detail,
      keyPhrases: ev.keyPhrases || [],
      keySentences: ev.keySentences || [],
    }));

    if (eventKeyData.length === 0) {
      res
        .status(200)
        .json({ message: "該当する場所のイベントがありません。", data: [] });
      return;
    }

    // messageとtags両方を考慮してレコメンド
    let recommendInput = message;
    if (!recommendInput && tags && tags.length > 0) {
      recommendInput = tags.join("・");
    } else if (recommendInput && tags && tags.length > 0) {
      recommendInput = message + "・" + tags.join("・");
    }

    const recommendations = await recommendEventsWithKeyData(
      recommendInput,
      eventKeyData
    );

    if (!recommendations || recommendations.length === 0) {
      res.status(200).json({
        query: recommendInput,
        recommendations: [],
        message:
          "ご希望に合うイベントが見つかりませんでした。条件を変えて再度お試しください。",
      });
      return;
    }

    // 開発用ログ
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[recommendByMessage] message/tags=\"${recommendInput}\" recommendations:\n`,
        JSON.stringify(recommendations, null, 2)
      );
    }

    res.json({ query: recommendInput, recommendations });
    return;
  } catch (err) {
    next(err);
  }
};
