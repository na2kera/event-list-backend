import axios from "axios";
import prisma from "../config/prisma";

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
