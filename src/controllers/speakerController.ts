import { Request, Response, NextFunction, RequestHandler } from "express";
import prisma from "../config/prisma";
import crypto from "crypto";

export const getSpeakers: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const speakers = await prisma.speaker.findMany({
      orderBy: {
        name: "asc",
      },
    });

    // フロントエンドの要件に合わせたレスポンス形式
    res.status(200).json({
      success: true,
      data: speakers,
    });
  } catch (error) {
    console.error("スピーカー一覧取得エラー:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "スピーカー一覧の取得中にエラーが発生しました",
    });
  }
};

export const createSpeaker: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const speaker = await prisma.speaker.create({
      data: {
        id: crypto.randomUUID(), // UUIDを生成
        name: req.body.name,
        occupation: req.body.occupation,
        affiliation: req.body.affiliation,
        bio: req.body.bio,
        updatedAt: new Date(), // 現在の日時
      },
    });

    // フロントエンドの要件に合わせたレスポンス形式
    res.status(201).json({
      success: true,
      data: speaker,
      message: "スピーカーが正常に作成されました",
    });
  } catch (error) {
    console.error("スピーカー作成エラー:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "スピーカーの作成中にエラーが発生しました",
    });
  }
};
