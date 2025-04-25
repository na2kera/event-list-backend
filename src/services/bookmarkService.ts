import prisma from "../config/prisma";
import crypto from "crypto";

/**
 * LINEからのブックマーク追加処理
 * @param userId LINE ユーザーID
 * @param eventId イベントID
 * @returns 処理結果（新規追加かどうか）
 */
export const addBookmarkFromLine = async (
  userId: string,
  eventId: string
): Promise<{ success: boolean; message: string; isNew: boolean }> => {
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
