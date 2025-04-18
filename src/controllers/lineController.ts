import { Request, Response } from "express";
import { RequestHandler } from "express";
import { 
  sendLineNotificationToUser, 
  sendEventCarouselToUser, 
  addBookmarkFromLine 
} from "../services/lineService";

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

/**
 * 特定のユーザーIDに対してイベントカルーセルを送信するコントローラー
 */
export const sendEventCarousel: RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId, eventIds } = req.body;

    if (!userId || !eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "ユーザーIDと少なくとも1つのイベントIDは必須です",
      });
      return;
    }

    try {
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

/**
 * LINEのWebhookを処理するコントローラー
 * postbackイベントからブックマーク追加などの処理を行う
 */
export const handleLineWebhook: RequestHandler = async (
  req: Request,
  res: Response
) => {
  try {
    // LINE Platformからのリクエストを検証（実際の実装では署名検証なども行う）
    const events = req.body.events;
    
    if (!events || !Array.isArray(events)) {
      // 検証用のレスポンスを返す（LINE Platformは200 OKを期待している）
      res.status(200).end();
      return;
    }

    // 各イベントを処理
    for (const event of events) {
      if (event.type === 'postback') {
        // postbackデータをパース
        const data = new URLSearchParams(event.postback.data);
        const action = data.get('action');
        
        if (action === 'bookmark') {
          const userId = data.get('userId');
          const eventId = data.get('eventId');
          
          if (userId && eventId) {
            try {
              const result = await addBookmarkFromLine(userId, eventId);
              
              // ユーザーに結果を通知
              await sendLineNotificationToUser(
                userId, 
                result.isNew 
                  ? `イベントをブックマークに追加しました！` 
                  : `このイベントは既にブックマークに追加されています`
              );
            } catch (error) {
              console.error('ブックマーク処理エラー:', error);
            }
          }
        }
      }
    }

    // LINE Platformには常に200 OKを返す
    res.status(200).end();
  } catch (error) {
    console.error("LINEウェブフックの処理に失敗しました:", error);
    // エラーが発生しても200を返す（LINE Platformの要件）
    res.status(200).end();
  }
};
