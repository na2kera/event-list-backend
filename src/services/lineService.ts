import axios from "axios";
import prisma from "../config/prisma";
import crypto from "crypto";
import {
  createEventRecommendlMessage,
  createEventReminderMessage,
} from "../utils/lineMessageTemplates";

// LINE Messaging APIのエンドポイント
const LINE_MESSAGING_API = "https://api.line.me/v2/bot/message/push";

/**
 * 特定のユーザーIDに対してLINE通知を送信する
 * @param lineUserId ユーザーID
 * @param message 送信するメッセージ
 * @returns 送信結果
 */
export const sendLineNotificationToUser = async (
  lineUserId: string,
  message: string
) => {
  try {
    // データベースからユーザーのLINE IDを取得
    const user = await prisma.user.findUnique({
      where: { lineId: lineUserId },
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
    // ユーザーIDでデータベースからユーザーを検索
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`ユーザー(${userId})が見つかりません`);
    }

    // イベント情報を取得
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

    // ユーザーのブックマーク情報を取得
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId: userId,
        eventId: {
          in: eventIds,
        },
      },
      select: {
        eventId: true, // ブックマークされているイベントIDだけ取得
      },
    });
    const bookmarkedEventIds = new Set(bookmarks.map((b) => b.eventId));

    // イベントデータにブックマーク状態を追加
    const eventsWithBookmarkStatus = events.map((event) => {
      const isBookmarked = bookmarkedEventIds.has(event.id);
      // Bookmark情報は不要なので含めない
      // (EventWithBookmarkStatus型にはBookmarkプロパティは含まれないため)
      return { ...event, isBookmarked };
    });

    // カルーセルメッセージを作成
    const carouselMessage = createEventRecommendlMessage(eventsWithBookmarkStatus, userId);

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
 * @param lineUserId ユーザーID
 * @param eventId イベントID
 * @returns 処理結果
 */
export const addBookmarkFromLine = async (
  lineUserId: string,
  eventId: string
) => {
  try {
    // LINEのユーザーIDからデータベースのユーザーを取得
    const user = await prisma.user.findUnique({
      where: { lineId: lineUserId },
    });

    if (!user) {
      throw new Error(`ユーザー(${lineUserId})が見つかりません`);
    }

    // すでにブックマークが存在するか確認
    const existingBookmark = await prisma.bookmark.findFirst({
      where: {
        userId: user.id,
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
        userId: user.id,
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

/**
 * LINE認証コードからアクセストークンを取得する
 * @param code LINE認証コード
 * @returns アクセストークン情報
 */
export const getLineTokenFromCode = async (code: string) => {
  try {
    // LINE Developersコンソールで設定した情報
    const clientId = process.env.LINE_AUTH_CLIENT_ID;
    const clientSecret = process.env.LINE_AUTH_CLIENT_SECRET;
    const redirectUri =
      process.env.LINE_AUTH_REDIRECT_URI ||
      "http://localhost:3000/line-callback";

    if (!clientId || !clientSecret) {
      throw new Error("LINE認証情報が設定されていません");
    }

    console.log("client id:", clientId);
    console.log("client secret:", clientSecret);
    console.log("redirect uri:", redirectUri);

    // LINE Token APIを呼び出し
    const tokenResponse = await axios.post(
      "https://api.line.me/oauth2/v2.1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return tokenResponse.data;
  } catch (error) {
    console.error("LINEトークン取得エラー:", error);

    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `LINEトークン取得エラー: ${
          error.response.data.error_description ||
          error.response.data.error ||
          error.message
        }`
      );
    }

    throw error;
  }
};

/**
 * LINEアクセストークンからプロフィール情報を取得する
 * @param accessToken LINEアクセストークン
 * @returns プロフィール情報
 */
export const getLineProfileFromToken = async (accessToken: string) => {
  try {
    // LINE Profile APIを呼び出し
    const profileResponse = await axios.get("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const { userId, displayName, pictureUrl } = profileResponse.data;

    return {
      userId,
      displayName,
      pictureUrl,
    };
  } catch (error) {
    console.error("LINEプロフィール取得エラー:", error);

    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `LINEプロフィール取得エラー: ${
          error.response.data.error_description ||
          error.response.data.error ||
          error.message
        }`
      );
    }

    throw error;
  }
};

/**
 * LINE認証コードからトークンとプロフィール情報を取得し、ユーザー情報を保存する
 * @param code LINE認証コード
 * @returns 処理結果とユーザー情報
 */
export const processLineAuthentication = async (code: string) => {
  try {
    // 1. LINEトークンを取得
    const tokenData = await getLineTokenFromCode(code);
    const { access_token } = tokenData;

    if (!access_token) {
      throw new Error("LINEアクセストークンの取得に失敗しました");
    }

    // 2. LINEプロフィール情報を取得
    const profileData = await getLineProfileFromToken(access_token);
    const { userId: lineId, displayName, pictureUrl } = profileData;

    if (!lineId) {
      throw new Error("LINEユーザーIDの取得に失敗しました");
    }

    // 3. ユーザー情報をデータベースに保存または更新
    // 既存のユーザーをチェック
    let user = await prisma.user.findFirst({
      where: { lineId },
    });

    if (user) {
      // 既存ユーザーのLINE情報を更新
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lineId,
        },
      });
    } else {
      // 新規ユーザーを作成
      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          lineId,
          name: displayName || "LINEユーザー",
          image: pictureUrl,
          email: null,
          stack: [],
          level: "BEGINNER",
          place: null,
          tag: [],
          goal: [],
          affiliation: null,
        },
      });
    }

    // 4. レスポンスを返す
    return {
      success: true,
      message: "LINE連携が完了しました",
      user: {
        id: user.id,
        lineId: user.lineId,
        name: user.name,
        image: user.image,
      },
      token: {
        access_token,
        ...tokenData,
      },
      profile: profileData,
    };
  } catch (error) {
    console.error("LINE認証処理エラー:", error);
    throw error;
  }
};

/**
 * 1週間後に開催されるイベントをブックマークしているユーザーにリマインドメッセージを送信する
 * @returns 処理結果
 */
export const sendEventReminders = async () => {
  try {
    // 現在の日付を取得
    const now = new Date();

    // 1週間後の日付を計算（時刻部分をリセット）
    const oneWeekLater = new Date(now);
    oneWeekLater.setDate(now.getDate() + 7);
    oneWeekLater.setHours(0, 0, 0, 0);

    // 翌日の日付を計算（時刻部分をリセット）
    const nextDay = new Date(oneWeekLater);
    nextDay.setDate(oneWeekLater.getDate() + 1);

    // 1週間後に開催されるイベントを検索
    const upcomingEvents = await prisma.event.findMany({
      where: {
        eventDate: {
          gte: oneWeekLater,
          lt: nextDay,
        },
      },
      include: {
        Bookmark: {
          include: {
            User: true,
          },
        },
      },
    });

    console.log(
      `1週間後（${
        oneWeekLater.toISOString().split("T")[0]
      }）に開催されるイベント数: ${upcomingEvents.length}`
    );

    // 送信結果を格納する配列
    interface ReminderResult {
      userId: string;
      lineId: string;
      eventId: string;
      eventTitle: string;
      success: boolean;
      error?: string;
    }

    const results: ReminderResult[] = [];

    // 各イベントについて処理
    for (const event of upcomingEvents) {
      // イベントをブックマークしているユーザーを取得
      const bookmarks = event.Bookmark;

      console.log(
        `イベント「${event.title}」のブックマーク数: ${bookmarks.length}`
      );

      // 各ブックマークについて処理
      for (const bookmark of bookmarks) {
        const user = bookmark.User;

        // ユーザーのLINE IDが存在する場合のみ通知を送信
        if (user && user.lineId) {
          try {
            // リマインドメッセージを作成
            const reminderMessage = createEventReminderMessage(
              event,
              oneWeekLater
            );

            // LINE通知を送信（カールセルメッセージ）
            const client = axios.create({
              baseURL: "https://api.line.me/v2/bot",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
              },
            });

            await client.post("/message/push", {
              to: user.lineId,
              messages: [reminderMessage],
            });

            results.push({
              userId: user.id,
              lineId: user.lineId,
              eventId: event.id,
              eventTitle: event.title,
              success: true,
            });
          } catch (error) {
            console.error(
              `ユーザー(${user.id})へのリマインド送信エラー:`,
              error
            );

            results.push({
              userId: user.id,
              lineId: user.lineId,
              eventId: event.id,
              eventTitle: event.title,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }

    return {
      success: true,
      message: `${results.length}件のリマインド通知を処理しました`,
      results,
    };
  } catch (error) {
    console.error("イベントリマインド送信エラー:", error);
    throw new Error(
      `イベントリマインドの送信に失敗しました: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};
