import { Request, Response, NextFunction } from "express";
import { RequestHandler } from "express";
import {
  fetchConnpassEventsV2,
  ConnpassSearchParamsV2,
  fetchAndSaveLatestEvents,
} from "../services/connpassService";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

// Connpass APIキーの取得
const CONNPASS_API_KEY = process.env.CONNPASS_API_KEY;

/**
 * Connpass APIを使ってイベントを検索する
 * @param req リクエスト
 * @param res レスポンス
 * @param next 次のミドルウェア
 */
export const searchConnpassEvents: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // APIキーのチェック
    if (!CONNPASS_API_KEY) {
      res.status(500).json({
        success: false,
        message:
          "Connpass APIキーが設定されていません。環境変数CONNPASS_API_KEYを設定してください。",
      });
      return;
    }

    // リクエストパラメータの取得
    const options: ConnpassSearchParamsV2 = {
      api_key: CONNPASS_API_KEY,
    };

    // キーワード（AND条件）
    if (req.query.keywords) {
      options.keyword = Array.isArray(req.query.keywords)
        ? (req.query.keywords as string[])
        : [req.query.keywords as string];
    }

    // キーワード（OR条件）
    if (req.query.keywordsOr) {
      options.keyword_or = Array.isArray(req.query.keywordsOr)
        ? (req.query.keywordsOr as string[])
        : [req.query.keywordsOr as string];
    }

    // 日付範囲
    if (req.query.startDate) {
      const startDate = new Date(req.query.startDate as string);
      options.ymd = startDate.toISOString().split("T")[0].replace(/-/g, "");
    }

    if (req.query.endDate) {
      const endDate = new Date(req.query.endDate as string);
      options.ymd_end = endDate.toISOString().split("T")[0].replace(/-/g, "");
    }

    // タグ
    if (req.query.tags) {
      options.tag = Array.isArray(req.query.tags)
        ? (req.query.tags as string[])
        : [req.query.tags as string];
    }

    // 主催者ニックネーム
    if (req.query.nickname) {
      options.nickname = req.query.nickname as string;
    }

    // グループID
    if (req.query.groupId) {
      options.group_id = parseInt(req.query.groupId as string, 10);
    }

    // 取得件数
    if (req.query.count) {
      options.count = parseInt(req.query.count as string, 10);
    }

    // オフセット
    if (req.query.offset) {
      options.offset = parseInt(req.query.offset as string, 10);
    }

    // 表示順
    if (req.query.order) {
      const orderValue = parseInt(req.query.order as string, 10);
      if (orderValue >= 1 && orderValue <= 3) {
        options.order = orderValue as 1 | 2 | 3;
      }
    }

    // イベント検索の実行
    const response = await fetchConnpassEventsV2(options);

    // レスポンスの返却
    res.status(200).json({
      success: true,
      count: response.count,
      events: response.events,
    });
  } catch (error) {
    console.error("Connpassイベント検索エラー:", error);
    res.status(500).json({
      success: false,
      message: "イベント検索中にエラーが発生しました",
      error: (error as Error).message,
    });
    return;
  }
};

/**
 * Connpassイベントの詳細を取得する
 * @param req リクエスト
 * @param res レスポンス
 * @param next 次のミドルウェア
 */
export const getConnpassEventById: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // APIキーのチェック
    if (!CONNPASS_API_KEY) {
      res.status(500).json({
        success: false,
        message:
          "Connpass APIキーが設定されていません。環境変数CONNPASS_API_KEYを設定してください。",
      });
      return;
    }

    const eventId = parseInt(req.params.id, 10);

    if (isNaN(eventId)) {
      res.status(400).json({
        success: false,
        message: "有効なイベントIDを指定してください",
      });
      return;
    }

    // イベントIDで検索
    const response = await fetchConnpassEventsV2({
      api_key: CONNPASS_API_KEY,
      count: 100, // 多めに取得してからフィルタリング
    });

    // IDでフィルタリング
    const filteredEvents = response.events.filter(
      (event) => event.id === eventId
    );

    if (filteredEvents.length === 0) {
      res.status(404).json({
        success: false,
        message: "指定されたIDのイベントが見つかりませんでした",
      });
      return;
    }

    // 最初のイベントを返す
    res.status(200).json({
      success: true,
      event: filteredEvents[0],
    });
    return;
  } catch (error) {
    console.error("Connpassイベント取得エラー:", error);
    res.status(500).json({
      success: false,
      message: "イベント取得中にエラーが発生しました",
      error: (error as Error).message,
    });
    return;
  }
};

/**
 * 今後開催されるConnpassイベントを検索する
 * @param req リクエスト
 * @param res レスポンス
 * @param next 次のミドルウェア
 */
export const getUpcomingConnpassEvents: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // APIキーのチェック
    if (!CONNPASS_API_KEY) {
      res.status(500).json({
        success: false,
        message:
          "Connpass APIキーが設定されていません。環境変数CONNPASS_API_KEYを設定してください。",
      });
      return;
    }

    // 日数の取得（デフォルト30日）
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    // キーワード（オプション）
    const keyword = req.query.keyword as string | undefined;

    // 取得件数（デフォルト20件）
    const count = req.query.count
      ? parseInt(req.query.count as string, 10)
      : 20;

    // 今日の日付
    const today = new Date();

    // 指定日数後の日付
    const endDate = new Date();
    endDate.setDate(today.getDate() + days);

    // イベント検索の実行
    const todayStr = today.toISOString().split("T")[0].replace(/-/g, "");
    const endDateStr = endDate.toISOString().split("T")[0].replace(/-/g, "");

    const response = await fetchConnpassEventsV2({
      api_key: CONNPASS_API_KEY,
      ymd: todayStr,
      ymd_end: endDateStr,
      keyword: keyword ? [keyword] : undefined,
      count,
    });

    // レスポンスの返却
    res.status(200).json({
      success: true,
      count: response.count,
      events: response.events,
    });
    return;
  } catch (error) {
    console.error("Connpassイベント検索エラー:", error);
    res.status(500).json({
      success: false,
      message: "イベント検索中にエラーが発生しました",
      error: (error as Error).message,
    });
    return;
  }
};

/**
 * 今後開催されるConnpassイベントを同期する
 * @param req リクエスト
 * @param res レスポンス
 */
export const syncUpcomingConnpassEvents: RequestHandler = async (req, res) => {
  try {
    if (!CONNPASS_API_KEY) {
      res
        .status(500)
        .json({ success: false, message: "CONNPASS_API_KEY not set" });
      return;
    }
    const { fetched, saved } = await fetchAndSaveLatestEvents(CONNPASS_API_KEY);
    res.json({ success: true, fetched, saved });
    return;
  } catch (error) {
    console.error("syncUpcomingConnpassEvents error", error);
    res.status(500).json({
      success: false,
      message: "sync error",
      error: (error as Error).message,
    });
    return;
  }
};
