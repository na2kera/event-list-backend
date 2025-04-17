import { Request, Response, NextFunction } from "express";
import { RequestHandler } from "express";
import prisma from "../config/prisma";

/**
 * カテゴリ一覧を取得するコントローラー
 */
export const getCategories: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // カテゴリ一覧を取得
    const categories = await prisma.category.findMany({
      orderBy: {
        name: "asc", // 名前でソート
      },
    });

    // フロントエンドの要件に合わせたレスポンス形式
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('カテゴリ一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "カテゴリ一覧の取得中にエラーが発生しました"
    });
  }
};
