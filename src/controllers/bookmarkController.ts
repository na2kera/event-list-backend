import { Request, Response, RequestHandler } from "express";
import prisma from "../config/prisma";
import crypto from "crypto";

// ブックマークの追加
export const addBookmark: RequestHandler = async (req, res) => {
  try {
    // デバッグ用: リクエストbodyを出力
    console.log("addBookmark req.body:", req.body);
    const { userId, eventId } = req.body;

    // すでに存在するか確認
    const existing = await prisma.bookmark.findUnique({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
      include: {
        Event: true,
      },
    });

    if (existing) {
      // 既にブックマーク済み
      res
        .status(200)
        .json({ success: true, alreadyBookmarked: true, bookmark: existing });
      return;
    }

    // 新規作成
    const bookmark = await prisma.bookmark.create({
      data: {
        id: crypto.randomUUID(), // UUIDを生成
        userId,
        eventId,
        updatedAt: new Date(), // 現在の日時
      },
      include: {
        Event: true,
      },
    });

    res.status(201).json(bookmark);
    return;
  } catch (error) {
    // Prismaエラー詳細も出力
    console.error("Error adding bookmark:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      // PrismaClientKnownRequestErrorの場合
      if ((error as any).code) {
        console.error("Prisma error code:", (error as any).code);
        console.error("Prisma meta:", (error as any).meta);
      }
    }
    res.status(500).json({ error: "Failed to add bookmark" });
    return;
  }
};

// ブックマークの削除
export const removeBookmark: RequestHandler = async (req, res) => {
  try {
    const { userId, eventId } = req.params;

    await prisma.bookmark.delete({
      where: {
        userId_eventId: {
          userId,
          eventId,
        },
      },
    });

    res.status(200).json({ message: "Bookmark removed successfully" });
    return;
  } catch (error) {
    console.error("Error removing bookmark:", error);
    res.status(500).json({ error: "Failed to remove bookmark" });
    return;
  }
};

// ユーザーのブックマーク一覧取得
export const getUserBookmarks: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;

    const bookmarks = await prisma.bookmark.findMany({
      where: {
        userId,
      },
      include: {
        Event: {
          include: {
            Organization: true,
            EventCategory: {
              include: {
                Category: true,
              },
            },
            EventSkill: true,
            EventSpeaker: {
              include: {
                Speaker: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json(bookmarks);
    return;
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    res.status(500).json({ error: "Failed to fetch bookmarks" });
    return;
  }
};
