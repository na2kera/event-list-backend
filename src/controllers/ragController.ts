import { RequestHandler } from "express";
import { searchEventsForUser } from "../services/eventRagService";
import fs from "fs";
import path from "path";

/**
 * RAGを使用したイベント検索
 * ユーザー情報に基づいてパーソナライズされたイベント検索を行う
 */
export const searchEventsByUserProfile: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const { location, skills, interests } = req.body;

    // 入力バリデーション
    if (!location || !Array.isArray(skills) || !Array.isArray(interests)) {
      res.status(400).json({
        success: false,
        error:
          "必須パラメータが不足しています: location (string), skills (array), interests (array)",
      });
      return;
    }

    // サービスレイヤーを呼び出してイベントを検索
    const events = await searchEventsForUser(location, skills, interests);

    // 最も関連性の高いイベント1つだけを返す
    const topEvent = events && events.length > 0 ? events[0] : null;

    // 結果を返す
    res.status(200).json({
      success: true,
      data: topEvent,
    });
  } catch (error) {
    console.error("RAG検索エラー:", error);
    next(error);
  }
};

/**
 * デバッグ用: 全てのモックイベントを取得
 */
export const getAllMockEvents: RequestHandler = (req, res, next) => {
  try {
    const mockEventsPath = path.join(__dirname, "../data/mockEvents.json");
    const events = JSON.parse(fs.readFileSync(mockEventsPath, "utf8"));

    res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("イベント取得エラー:", error);
    next(error);
  }
};
