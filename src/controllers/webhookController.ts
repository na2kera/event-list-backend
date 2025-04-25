import { Request, Response, RequestHandler } from "express";
import { 
  sendLineNotificationToUser, 
  sendEventCarouselToUser,
  addBookmarkFromLine,
  sendEventReminders
} from "../services/lineService";
import { recommendEventsForUser } from "../utils/recommendEvents";
import { processRagQuery } from "../services/ragService";

/**
 * LINEのWebhookを処理するコントローラー
 * postbackイベントからブックマーク追加などの処理を行う
 * テキストメッセージからの特定のコマンド処理も行う
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
      // ユーザーIDを取得
      const userId = event.source?.userId;
      if (!userId) continue; // ユーザーIDがない場合は処理をスキップ

      // postbackイベントの処理
      if (event.type === "postback") {
        await handlePostbackEvent(event, userId);
      }
      
      // テキストメッセージの処理
      else if (event.type === "message" && event.message?.type === "text") {
        await handleTextMessageEvent(event, userId);
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

/**
 * postbackイベントを処理する関数
 */
const handlePostbackEvent = async (event: any, userId: string) => {
  try {
    // postbackデータをパース
    const data = new URLSearchParams(event.postback.data);
    const action = data.get("action");

    if (action === "bookmark") {
      const eventId = data.get("eventId");

      if (eventId) {
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
          console.error("ブックマーク処理エラー:", error);
        }
      }
    }
  } catch (error) {
    console.error("postbackイベント処理エラー:", error);
  }
};

/**
 * テキストメッセージイベントを処理する関数
 */
const handleTextMessageEvent = async (event: any, userId: string) => {
  try {
    const messageText = event.message.text;
    
    // 「レコメンド」というテキストを受け取った場合の処理
    if (messageText === "レコメンド") {
      try {
        console.log(`ユーザー ${userId} からレコメンドリクエストを受信しました`);
        
        // レコメンドAPIを呼び出す
        const eventIds = await recommendEventsForUser(userId);
        
        // イベントカルーセルを送信
        await sendEventCarouselToUser(userId, eventIds);
        
        console.log(`ユーザー ${userId} にレコメンド結果を送信しました`);
      } catch (error) {
        console.error("レコメンド処理エラー:", error);
        
        // エラーが発生した場合はユーザーに通知
        await sendLineNotificationToUser(
          userId,
          "レコメンドの取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。"
        );
      }
    }
    
    // 「リマインド」というテキストを受け取った場合の処理
    else if (messageText === "リマインド") {
      try {
        console.log(`ユーザー ${userId} からリマインドリクエストを受信しました`);
        
        // リマインド処理を実行
        const result = await sendEventReminders();
        
        // 結果をユーザーに通知
        const successCount = result.results.filter(r => r.success && r.lineId === userId).length;
        
        if (successCount > 0) {
          await sendLineNotificationToUser(
            userId,
            `${successCount}件のイベントリマインドを送信しました。ブックマークしたイベントをチェックしてください。`
          );
        } else {
          await sendLineNotificationToUser(
            userId,
            "リマインド対象のイベントが見つかりませんでした。イベントをブックマークすると、開催1週間前にリマインドが届きます。"
          );
        }
        
        console.log(`ユーザー ${userId} にリマインド結果を送信しました: ${successCount}件`);
      } catch (error) {
        console.error("リマインド処理エラー:", error);
        
        // エラーが発生した場合はユーザーに通知
        await sendLineNotificationToUser(
          userId,
          "リマインド処理中にエラーが発生しました。しばらく経ってからもう一度お試しください。"
        );
      }
    }
    
    // 上記以外のテキストメッセージはRAGで処理
    else {
      try {
        console.log(`ユーザー ${userId} からの質問: ${messageText}`);
        
        // RAG処理を実行
        const answer = await processRagQuery(messageText);
        
        // 回答を送信
        await sendLineNotificationToUser(userId, answer);
        
        console.log(`ユーザー ${userId} にRAG回答を送信しました`);
      } catch (error) {
        console.error("RAG処理エラー:", error);
        
        // エラーが発生した場合はユーザーに通知
        await sendLineNotificationToUser(
          userId,
          "質問の処理中にエラーが発生しました。しばらく経ってからもう一度お試しください。"
        );
      }
    }
  } catch (error) {
    console.error("テキストメッセージ処理エラー:", error);
  }
};
