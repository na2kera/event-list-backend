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
import { getUserByLineId, getUserWithDetailsById } from "../utils/userUtils";
import { recommendEventsByQuery } from "../utils/queryRecommendation";
import prisma from "../config/prisma"; // ★ Prisma Client をインポート
import { getFilteredEvents } from "../utils/eventUtils";
import { recommendEventsWithKeyData } from "../utils/keyDataRecommendation";

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
      console.error(
        `LINEユーザーID ${lineUserId} に対応するユーザーが見つかりません`
      );
      // 必要に応じてユーザーにエラー通知を送ることも検討
      // await sendLineNotificationToUser(lineUserId, "ユーザー情報が見つかりませんでした。");
      return; // ユーザーが見つからない場合は処理を中断
    }

    if (!eventId) {
      console.error(
        "PostbackデータにeventIdが含まれていません",
        event.postback.data
      );
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
    } else if (action === "unbookmark") {
      // ★ ブックマーク解除処理
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

    // 「レコメンド」というテキストを受け取った場合の処理（recommendController.tsのロジックを使用）
    if (messageText === "レコメンド") {
      try {
        console.log(
          `ユーザー ${lineUserId} からレコメンドリクエストを受信しました`
        );

        // ユーザー情報取得（lineUserIdから内部userIdを取得）
        const user = await getUserByLineId(lineUserId);
        console.log("user", user);
        if (!user) {
          await sendLineNotificationToUser(
            lineUserId,
            "ユーザー情報が見つかりません。まずはプロフィール設定をお願いします。"
          );
          return;
        }

        // recommendController.tsのrecommendByUserロジックを実装
        const userDetails = await getUserWithDetailsById(user.id);
        if (!userDetails) {
          await sendLineNotificationToUser(
            lineUserId,
            "ユーザー詳細情報が見つかりません。まずはプロフィール設定をお願いします。"
          );
          return;
        }

        const tags: string[] = (userDetails.tag as any) || [];
        if (tags.length === 0) {
          await sendLineNotificationToUser(
            lineUserId,
            "興味タグが未設定です。プロフィールから興味タグを設定してください。"
          );
          return;
        }

        // 場所・形式でイベントをフィルタ
        const locationRaw = (userDetails.place || "").toString();
        const locLower = locationRaw.toLowerCase();
        const filterOpts: any = {};
        if (locationRaw) {
          if (locLower === "online") {
            filterOpts.format = "ONLINE";
          } else {
            filterOpts.location = locationRaw;
          }
        }

        const events = await getFilteredEvents(filterOpts);
        const eventKeyData = events.map((ev: any) => ({
          id: ev.id,
          title: ev.title,
          detail: ev.detail,
          keyPhrases: ev.keyPhrases || [],
          keySentences: ev.keySentences || [],
        }));

        if (eventKeyData.length === 0) {
          await sendLineNotificationToUser(
            lineUserId,
            "該当する場所のイベントがありません。"
          );
          return;
        }

        // 興味タグごとにレコメンド（recommendController.tsと同じロジック）
        let allEventIds: string[] = [];
        for (const tag of tags) {
          const recs = await recommendEventsWithKeyData(tag, eventKeyData);
          allEventIds.push(...recs.map((rec) => rec.event.id));
        }
        // 重複排除
        allEventIds = [...new Set(allEventIds)];

        if (allEventIds.length === 0) {
          await sendLineNotificationToUser(
            lineUserId,
            "ご希望に合うイベントが見つかりませんでした。条件を変えて再度お試しください。"
          );
          return;
        }

        // イベントカルーセルを送信
        await sendEventCarouselToUser(user.id, allEventIds);
        await sendLineNotificationToUser(
          lineUserId,
          "興味タグベースのレコメンド結果です。"
        );
        console.log(`ユーザー ${lineUserId} にレコメンド結果を送信しました`);
      } catch (error) {
        console.error("レコメンド処理エラー:", error);
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

    // 上記以外のテキストメッセージはkeyDataベースのテキストレコメンドに統一
    else {
      try {
        console.log(`ユーザー ${lineUserId} からの質問: ${messageText}`);
        // ユーザー情報を取得（lineUserIdから内部userIdを取得）
        const user = await getUserByLineId(lineUserId);
        if (!user) {
          await sendLineNotificationToUser(
            lineUserId,
            "ユーザー情報が見つかりません。まずはプロフィール設定をお願いします。"
          );
          return;
        }
        // 内部userIdで詳細情報を取得
        const userDetails = await getUserWithDetailsById(user.id);
        if (!userDetails) {
          await sendLineNotificationToUser(
            lineUserId,
            "ユーザー詳細情報が見つかりません。まずはプロフィール設定をお願いします。"
          );
          return;
        }
        // 場所・形式でイベントをフィルタ
        const locationRaw = (userDetails.place || "").toString();
        const locLower = locationRaw.toLowerCase();
        const filterOpts: any = {};
        if (locationRaw) {
          if (locLower === "online") {
            filterOpts.format = "ONLINE";
          } else {
            filterOpts.location = locationRaw;
          }
        }
        const events = await getFilteredEvents(filterOpts);
        const eventKeyData = events.map((ev: any) => ({
          id: ev.id,
          title: ev.title,
          detail: ev.detail,
          keyPhrases: ev.keyPhrases || [],
          keySentences: ev.keySentences || [],
        }));
        if (eventKeyData.length === 0) {
          await sendLineNotificationToUser(
            lineUserId,
            "該当する場所のイベントがありません。"
          );
          return;
        }
        // テキストでレコメンド
        const recs = await recommendEventsWithKeyData(
          messageText,
          eventKeyData
        );
        const eventIds = recs.map((rec) => rec.event.id);
        if (eventIds.length === 0) {
          await sendLineNotificationToUser(
            lineUserId,
            "ご希望に合うイベントが見つかりませんでした。条件を変えて再度お試しください。"
          );
          return;
        }
        await sendEventCarouselToUser(user.id, eventIds);
        await sendLineNotificationToUser(
          lineUserId,
          "keyData（キーフレーズ/キーセンテンス）ベースのテキストレコメンド結果です。"
        );
        console.log(
          `ユーザー ${lineUserId} にkeyDataベースのテキストレコメンド結果を送信しました`
        );
      } catch (error) {
        console.error("テキストレコメンド処理エラー:", error);
        await sendLineNotificationToUser(
          lineUserId,
          "テキストレコメンドの取得中にエラーが発生しました。しばらく経ってからもう一度お試しください。"
        );
      }
    }
  } catch (error) {
    console.error("テキストメッセージ処理エラー:", error);
  }
};
