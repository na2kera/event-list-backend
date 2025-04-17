import { Request, Response } from "express";
import { RequestHandler } from "express";
import { sendLineNotificationToUser } from "../services/lineService";

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

    try {
      const result = await sendLineNotificationToUser(userId, message);
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
