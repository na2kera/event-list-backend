import prisma from "../../config/prisma";
import { Event } from "@prisma/client";

/**
 * イベントテーブルから5件のデータをフェッチする
 * @param includeRelations 関連するデータ（Organization、Category、Skill、Speaker）も含めるかどうか（デフォルト: true）
 * @returns 最大5件のイベントデータの配列
 */
export const fetchFiveEventData = async (includeRelations: boolean = true) => {
  try {
    // 関連データを含める場合の設定
    const include = includeRelations
      ? {
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
          EventGoal: true,
        }
      : {};

    // Prismaでイベントを5件取得（日付の昇順でソート）
    const events = await prisma.event.findMany({
      include,
      orderBy: {
        eventDate: "asc",
      },
      take: 5, // 最大5件に制限
    });

    return events;
  } catch (error) {
    console.error("5件イベント取得エラー:", error);
    throw new Error(
      `イベントデータの取得に失敗しました: ${
        error instanceof Error ? error.message : "不明なエラー"
      }`
    );
  }
};

/**
 * 作成日でソートして最新の5件のイベントを取得する
 * @param includeRelations 関連するデータも含めるかどうか（デフォルト: true）
 * @returns 最新の5件のイベントデータの配列
 */
export const fetchLatestFiveEventData = async (
  includeRelations: boolean = true
) => {
  try {
    const include = includeRelations
      ? {
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
          EventGoal: true,
        }
      : {};

    // 作成日の降順でソート（最新が先頭）
    const events = await prisma.event.findMany({
      include,
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    return events;
  } catch (error) {
    console.error("最新5件イベント取得エラー:", error);
    throw new Error(
      `最新イベントデータの取得に失敗しました: ${
        error instanceof Error ? error.message : "不明なエラー"
      }`
    );
  }
};

// デフォルトエクスポートとして基本の関数を提供
export default fetchFiveEventData;
