import { Request, Response, RequestHandler } from "express";
import {
  sendLineNotificationToUser,
  sendEventCarouselToUser,
  addBookmarkFromLine,
  sendEventReminders,
} from "../services/lineService";
import {
  recommendEventsByHyDE,
  recommendEventsByKeyword,
} from "../utils/recommendEvents";
import { processRagQuery } from "../services/ragService";
import { getUserByLineId } from "../utils/userUtils";
import prisma from "../config/prisma"; // ★ Prisma Client をインポート

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
      const lineUserId = event.source?.userId;
      if (!lineUserId) continue; // ユーザーIDがない場合は処理をスキップ

      // postbackイベントの処理
      if (event.type === "postback") {
        await handlePostbackEvent(event, lineUserId);
      }

      // テキストメッセージの処理
      else if (event.type === "message" && event.message?.type === "text") {
        await handleTextMessageEvent(event, lineUserId);
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
const handlePostbackEvent = async (event: any, lineUserId: string) => {
  try {
    // postbackデータをパース
    const data = new URLSearchParams(event.postback.data);
    const action = data.get("action");
    const eventId = data.get("eventId"); // eventId はどちらのアクションでも使う可能性があるのでここで取得

    // 内部ユーザーIDを取得（ブックマーク操作に必要）
    const user = await getUserByLineId(lineUserId);
    if (!user) {
      console.error(`LINEユーザーID ${lineUserId} に対応するユーザーが見つかりません`);
      // 必要に応じてユーザーにエラー通知を送ることも検討
      // await sendLineNotificationToUser(lineUserId, "ユーザー情報が見つかりませんでした。");
      return; // ユーザーが見つからない場合は処理を中断
    }

    if (!eventId) {
      console.error("PostbackデータにeventIdが含まれていません", event.postback.data);
      // 必要に応じてユーザーにエラー通知
      return;
    }

    if (action === "bookmark") {
      try {
        // ★ 内部ユーザーID (user.id) を使うように修正
        const result = await addBookmarkFromLine(user.id, eventId);

        // ユーザーに結果を通知
        await sendLineNotificationToUser(
          lineUserId,
          result.isNew
            ? `イベントをブックマークに追加しました！`
            : `このイベントは既にブックマークに追加されています`
        );
      } catch (error) {
        console.error("ブックマーク追加処理エラー:", error);
        await sendLineNotificationToUser(
          lineUserId,
          "ブックマークの追加中にエラーが発生しました。"
        );
      }
    } else if (action === "unbookmark") { // ★ ブックマーク解除処理
      try {
        const deleteResult = await prisma.bookmark.deleteMany({
          where: {
            userId: user.id, // ★ 内部ユーザーID
            eventId: eventId,
          },
        });

        if (deleteResult.count > 0) {
          console.log(
            `ユーザー ${user.id} のイベント ${eventId} のブックマークを削除しました`
          );
          await sendLineNotificationToUser(
            lineUserId,
            "イベントのブックマークを解除しました。"
          );
        } else {
          // 削除対象が見つからなかった場合（念のため）
          console.log(
            `ユーザー ${user.id} のイベント ${eventId} のブックマークが見つかりませんでした（削除スキップ）`
          );
          // 必要であればユーザーに通知しても良い
          // await sendLineNotificationToUser(lineUserId, "対象のブックマークが見つかりませんでした。");
        }
      } catch (error) {
        console.error("ブックマーク解除処理エラー:", error);
        await sendLineNotificationToUser(
          lineUserId,
          "ブックマークの解除中にエラーが発生しました。"
        );
      }
    }

  } catch (error) {
    console.error("postbackイベント処理エラー:", error);
    // postback処理全体のエラーはユーザーに通知しない（個別処理内で通知済みのため）
  }
};

/**
 * テキストメッセージイベントを処理する関数
 */
const handleTextMessageEvent = async (event: any, lineUserId: string) => {
  try {
    const messageText = event.message.text;

    // 「レコメンド１」というテキストを受け取った場合の処理（HyDEベース）
    if (messageText === "レコメンド１") {
      try {
        console.log(
          `ユーザー ${lineUserId} からレコメンドリクエストを受信しました`
        );

        const user = await getUserByLineId(lineUserId);
        if (!user) {
          throw new Error(`ユーザー ${lineUserId} が見つかりません。`);
        }

        // HyDEベースのレコメンドAPIを呼び出す
        const eventIds = await recommendEventsByHyDE(user.id);

        // イベントカルーセルを送信
        await sendEventCarouselToUser(user.id, eventIds);

        // ユーザーにレコメンドタイプを通知
        await sendLineNotificationToUser(
          lineUserId,
          "ベクトル検索（HyDE）によるレコメンド結果です。"
        );

        console.log(`ユーザー ${lineUserId} にレコメンド結果を送信しました`);
      } catch (error) {
        console.error("レコメンド処理エラー:", error);

        // エラーが発生した場合はユーザーに通知
        await sendLineNotificationToUser(
          lineUserId,
          "レコメンドの取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。"
        );
      }
    }

    // 「レコメンド２」というテキストを受け取った場合の処理（キーワードベース）
    else if (messageText === "レコメンド２") {
      try {
        console.log(
          `ユーザー ${lineUserId} からキーワードベースのレコメンドリクエストを受信しました`
        );

        // ユーザー情報が必要
        const user = await getUserByLineId(lineUserId);
        if (!user) {
          await sendLineNotificationToUser(
            lineUserId,
            "ユーザー情報が見つかりません。まずはプロフィール設定をお願いします。"
          );
          return;
        }

        // キーワードベースのレコメンドAPIを呼び出す
        const recommendedEvents = await recommendEventsByKeyword(user.id);

        // イベントIDの配列を取得
        const eventIds = recommendedEvents.map((event) => event.eventId);

        // イベントカルーセルを送信
        await sendEventCarouselToUser(user.id, eventIds);

        // ユーザーにレコメンドタイプを通知
        await sendLineNotificationToUser(
          lineUserId,
          "キーワードベースのレコメンド結果です。関連性スコア70以上のイベントを表示しています。"
        );

        console.log(
          `ユーザー ${lineUserId} にキーワードベースのレコメンド結果を送信しました`
        );
      } catch (error) {
        console.error("レコメンド処理エラー:", error);

        // エラーが発生した場合はユーザーに通知
        await sendLineNotificationToUser(
          lineUserId,
          "レコメンドの取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。"
        );
      }
    }

    // 「リマインド」というテキストを受け取った場合の処理
    else if (messageText === "リマインド") {
      try {
        console.log(
          `ユーザー ${lineUserId} からリマインドリクエストを受信しました`
        );

        // リマインド処理を実行
        const result = await sendEventReminders();

        // 結果をユーザーに通知
        const successCount = result.results.filter(
          (r) => r.success && r.lineId === lineUserId
        ).length;

        console.log("リマインド結果:", successCount);

        if (successCount > 0) {
          await sendLineNotificationToUser(
            lineUserId,
            `${successCount}件のイベントリマインドを送信しました。ブックマークしたイベントをチェックしてください。`
          );
        } else {
          await sendLineNotificationToUser(
            lineUserId,
            "リマインド対象のイベントが見つかりませんでした。イベントをブックマークすると、開催1週間前にリマインドが届きます。"
          );
        }

        console.log(
          `ユーザー ${lineUserId} にリマインド結果を送信しました: ${successCount}件`
        );
      } catch (error) {
        console.error("リマインド処理エラー:", error);

        // エラーが発生した場合はユーザーに通知
        await sendLineNotificationToUser(
          lineUserId,
          "リマインド処理中にエラーが発生しました。しばらく経ってからもう一度お試しください。"
        );
      }
    }

    // 上記以外のテキストメッセージはRAGで処理
    else {
      try {
        console.log(`ユーザー ${lineUserId} からの質問: ${messageText}`);

        // RAG処理を実行
        const answer = await processRagQuery(messageText);

        // 回答を送信
        await sendLineNotificationToUser(lineUserId, answer);

        console.log(`ユーザー ${lineUserId} にRAG回答を送信しました`);
      } catch (error) {
        console.error("RAG処理エラー:", error);

        // エラーが発生した場合はユーザーに通知
        await sendLineNotificationToUser(
          lineUserId,
          "質問の処理中にエラーが発生しました。しばらく経ってからもう一度お試しください。"
        );
      }
    }
  } catch (error) {
    console.error("テキストメッセージ処理エラー:", error);
  }
};
