import prisma from "../config/prisma";
import {
  Event,
  Category,
  Speaker,
  EventCategory,
  EventSkill,
  EventSpeaker,
  EventGoal,
} from "@prisma/client";

/**
 * すべてのイベントを取得する
 * @param includeRelations 関連するデータ（カテゴリ、スキル、スピーカー、ゴール）も含めるかどうか
 * @returns イベントの配列
 */
export const getAllEvents = async (includeRelations: boolean = true) => {
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

    // Prismaでイベントを全件取得
    const events = await prisma.event.findMany({
      include,
      orderBy: {
        eventDate: "asc",
      },
    });

    return events;
  } catch (error) {
    console.error("イベント取得エラー:", error);
    throw error;
  }
};

/**
 * イベントIDに基づいて特定のイベントを取得する
 * @param eventId イベントID
 * @param includeRelations 関連するデータも含めるかどうか
 * @returns イベント情報、見つからない場合はnull
 */
export const getEventById = async (
  eventId: string,
  includeRelations: boolean = true
) => {
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

    // Prismaでイベントを検索
    const event = await prisma.event.findUnique({
      include,
      where: {
        id: eventId,
      },
    });

    return event;
  } catch (error) {
    console.error(`イベントID ${eventId} 取得エラー:`, error);
    throw error;
  }
};

/**
 * 条件に基づいてイベントをフィルタリングする
 * @param options フィルタリングオプション
 * @returns フィルタリングされたイベントの配列
 */
export const getFilteredEvents = async (options: {
  categoryIds?: string[];
  skills?: string[];
  location?: string;
  fromDate?: Date;
  toDate?: Date;
  format?: string;
  difficulty?: string;
  searchTerm?: string;
}) => {
  try {
    // 検索条件を構築
    const where: any = {};

    // カテゴリでフィルタリング
    if (options.categoryIds && options.categoryIds.length > 0) {
      where.EventCategory = {
        some: {
          CategoryId: {
            in: options.categoryIds,
          },
        },
      };
    }

    // スキルでフィルタリング
    if (options.skills && options.skills.length > 0) {
      where.EventSkill = {
        some: {
          name: {
            in: options.skills,
          },
        },
      };
    }

    // 場所でフィルタリング
    if (options.location) {
      where.location = {
        contains: options.location,
        mode: "insensitive",
      };
    }

    // 日付範囲でフィルタリング
    if (options.fromDate || options.toDate) {
      where.eventDate = {};
      if (options.fromDate) {
        where.eventDate.gte = options.fromDate;
      }
      if (options.toDate) {
        where.eventDate.lte = options.toDate;
      }
    }

    // 形式でフィルタリング
    if (options.format) {
      where.format = options.format;
    }

    // 難易度でフィルタリング
    if (options.difficulty) {
      where.difficulty = options.difficulty;
    }

    // キーワード検索
    if (options.searchTerm) {
      where.OR = [
        {
          title: {
            contains: options.searchTerm,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: options.searchTerm,
            mode: "insensitive",
          },
        },
      ];
    }

    // Prismaでイベントを検索
    const events = await prisma.event.findMany({
      where,
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
        EventGoal: true,
      },
      orderBy: {
        eventDate: "asc",
      },
    });

    return events;
  } catch (error) {
    console.error("イベントフィルタリングエラー:", error);
    throw error;
  }
};
