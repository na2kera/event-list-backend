import axios from "axios";
import prisma from "../config/prisma";
import crypto from "crypto";

// LINE Messaging APIのエンドポイント
const LINE_MESSAGING_API = "https://api.line.me/v2/bot/message/push";

/**
 * 特定のユーザーIDに対してLINE通知を送信する
 * @param userId ユーザーID
 * @param message 送信するメッセージ
 * @returns 送信結果
 */
export const sendLineNotificationToUser = async (
  userId: string,
  message: string
) => {
  try {
    // データベースからユーザーのLINE IDを取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.lineId) {
      throw new Error("ユーザーが見つからないか、LINE連携が行われていません");
    }

    // LINE Messaging APIを使用してメッセージを送信
    const response = await axios.post(
      LINE_MESSAGING_API,
      {
        to: user.lineId,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
      }
    );

    return {
      success: true,
      message: "LINE通知が送信されました",
      response: response.data,
    };
  } catch (error) {
    console.error("LINE通知の送信に失敗しました:", error);
    throw error;
  }
};

/**
 * LINE IDが設定されているすべてのユーザーを取得する
 * @returns LINE IDが設定されているユーザーの配列
 */
export const getUsersWithLineId = async () => {
  try {
    const users = await prisma.user.findMany({
      where: {
        lineId: {
          not: null,
        },
      },
    });

    return users;
  } catch (error) {
    console.error("LINE連携ユーザーの取得に失敗しました:", error);
    throw error;
  }
};

/**
 * 特定のイベントリストをカルーセルテンプレートでLINEに送信する
 * @param userId ユーザーID
 * @param eventIds 送信するイベントIDの配列
 * @returns 送信結果
 */
export const sendEventCarouselToUser = async (
  userId: string,
  eventIds: string[]
) => {
  try {
    // データベースからユーザーのLINE IDを取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.lineId) {
      throw new Error("ユーザーが見つからないか、LINE連携が行われていません");
    }

    // イベントIDリストからイベント情報を取得
    const events = await prisma.event.findMany({
      where: {
        id: {
          in: eventIds,
        },
      },
      include: {
        Organization: true,
        EventCategory: {
          include: {
            Category: true,
          },
        },
      },
    });

    if (events.length === 0) {
      throw new Error("指定されたイベントが見つかりません");
    }

    // カルーセルテンプレート用のバブルを作成（最大10件）
    const bubbles = events.slice(0, 10).map((event) => {
      // イベントの日付をフォーマット
      const eventDate = new Date(event.eventDate);
      const formattedDate = `${eventDate.getFullYear()}年${eventDate.getMonth() + 1}月${eventDate.getDate()}日`;
      
      // カテゴリ名を取得
      const categories = event.EventCategory.map(ec => ec.Category.name).join(', ');
      
      return {
        type: "bubble",
        hero: {
          type: "image",
          url: event.image || "https://via.placeholder.com/1024x400?text=No+Image",
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover",
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: event.title,
              weight: "bold",
              size: "xl",
              wrap: true,
            },
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: [
                {
                  type: "box",
                  layout: "baseline",
                  spacing: "sm",
                  contents: [
                    {
                      type: "text",
                      text: "日時",
                      color: "#aaaaaa",
                      size: "sm",
                      flex: 1,
                    },
                    {
                      type: "text",
                      text: `${formattedDate} ${event.startTime || ""}`,
                      wrap: true,
                      color: "#666666",
                      size: "sm",
                      flex: 5,
                    },
                  ],
                },
                {
                  type: "box",
                  layout: "baseline",
                  spacing: "sm",
                  contents: [
                    {
                      type: "text",
                      text: "場所",
                      color: "#aaaaaa",
                      size: "sm",
                      flex: 1,
                    },
                    {
                      type: "text",
                      text: event.venue || "オンライン",
                      wrap: true,
                      color: "#666666",
                      size: "sm",
                      flex: 5,
                    },
                  ],
                },
                {
                  type: "box",
                  layout: "baseline",
                  spacing: "sm",
                  contents: [
                    {
                      type: "text",
                      text: "カテゴリ",
                      color: "#aaaaaa",
                      size: "sm",
                      flex: 1,
                    },
                    {
                      type: "text",
                      text: categories || "なし",
                      wrap: true,
                      color: "#666666",
                      size: "sm",
                      flex: 5,
                    },
                  ],
                },
              ],
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              height: "sm",
              action: {
                type: "uri",
                label: "詳細を見る",
                uri: event.detailUrl || `https://event-list-frontend.vercel.app/events/${event.id}`,
              },
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "postback",
                label: "ブックマークに追加",
                data: `action=bookmark&eventId=${event.id}&userId=${userId}`,
              },
            },
          ],
          flex: 0,
        },
      };
    });

    // カルーセルテンプレートを作成
    const carouselMessage = {
      type: "flex",
      altText: "おすすめイベント情報",
      contents: {
        type: "carousel",
        contents: bubbles,
      },
    };

    // LINE Messaging APIを使用してカルーセルを送信
    const response = await axios.post(
      LINE_MESSAGING_API,
      {
        to: user.lineId,
        messages: [
          {
            type: "text",
            text: "あなたにおすすめのイベント情報をお届けします！",
          },
          carouselMessage,
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
      }
    );

    return {
      success: true,
      message: "イベント情報がLINEで送信されました",
      response: response.data,
    };
  } catch (error) {
    console.error("イベント情報のLINE送信に失敗しました:", error);
    throw error;
  }
};

/**
 * LINEのpostbackイベントからブックマークを追加する
 * @param userId ユーザーID
 * @param eventId イベントID
 * @returns 処理結果
 */
export const addBookmarkFromLine = async (
  userId: string,
  eventId: string
) => {
  try {
    // すでにブックマークが存在するか確認
    const existingBookmark = await prisma.bookmark.findFirst({
      where: {
        userId,
        eventId,
      },
    });

    if (existingBookmark) {
      return {
        success: true,
        message: "すでにブックマークに追加されています",
        isNew: false,
      };
    }

    // ブックマークを追加
    await prisma.bookmark.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        eventId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: "ブックマークに追加しました",
      isNew: true,
    };
  } catch (error) {
    console.error("ブックマーク追加エラー:", error);
    throw error;
  }
};
