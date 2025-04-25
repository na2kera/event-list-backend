import { Request, Response } from "express";
import { RequestHandler } from "express";
import {
  sendLineNotificationToUser,
  sendEventCarouselToUser,
  addBookmarkFromLine,
  processLineAuthentication,
  sendEventReminders,
} from "../services/lineService";

import { recommendEventsForUser } from "../utils/recommendEvents";
import { getUserByLineId } from "../utils/userUtils";

/**
 * 特定のユーザーIDに対してLINE通知を送信するコントローラー
 */
export const sendLineNotification: RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      res.status(400).json({
        success: false,
        message: "ユーザーIDとメッセージは必須です",
      });
      return;
    }

    // データベースからユーザーのLINE IDを取得
    const user = await getUserByLineId(userId);

    if (!user || !user.lineId) {
      res.status(404).json({
        success: false,
        message: "ユーザーが見つからないか、LINE連携が行われていません",
      });
      return;
    }

    try {
      const result = await sendLineNotificationToUser(user.lineId, message);
      res.status(200).json(result);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("ユーザーが見つからない")
      ) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error("LINE通知の送信に失敗しました:", error);
    res.status(500).json({
      success: false,
      message: "LINE通知の送信に失敗しました",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * 特定のユーザーIDに対してレコメンドを決定して、イベントカルーセルを送信するコントローラー
 */
export const sendEventRecommend: RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: "ユーザーIDは必須です",
      });
      return;
    }

    try {
      // レコメンドイベントIDリストを取得
      const eventIds = await recommendEventsForUser(userId);

      // イベントカルーセルを送信
      const result = await sendEventCarouselToUser(userId, eventIds);
      res.status(200).json(result);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("ユーザーが見つからない") ||
          error.message.includes("指定されたイベントが見つかりません"))
      ) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error("イベントカルーセルの送信に失敗しました:", error);
    res.status(500).json({
      success: false,
      message: "イベントカルーセルの送信に失敗しました",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Webhook処理は webhookController.ts に移動しました

/**
 * LINE認証コードからトークンとプロフィール情報を取得し、ユーザー情報を保存するコントローラー
 */
export const processLineAuth: RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        message: "認証コードは必須です",
      });
      return;
    }

    try {
      // LINE認証処理を行い、ユーザー情報を保存
      const result = await processLineAuthentication(code);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error("LINE認証処理に失敗しました:", error);
    res.status(500).json({
      success: false,
      message: "LINE認証処理に失敗しました",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * 1週間後に開催されるイベントをブックマークしているユーザーにリマインドメッセージを送信するコントローラー
 */
export const sendEventReminderNotifications: RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    // リマインド通知を送信
    const result = await sendEventReminders();

    res.status(200).json(result);
  } catch (error) {
    console.error("イベントリマインド通知の送信に失敗しました:", error);
    res.status(500).json({
      success: false,
      message: "イベントリマインド通知の送信に失敗しました",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
