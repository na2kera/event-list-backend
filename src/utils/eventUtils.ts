import prisma from "../config/prisma";
import { extractEventKeyData } from "./extractEventKeyData";
import crypto from "crypto";
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
      where.OR = [
        {
          location: {
            contains: options.location,
            mode: "insensitive",
          },
        },
        {
          location: "不明",
        },
      ];
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

/**
 * イベントをDBに保存または更新する
 * @param events 保存または更新するイベントの配列
 * @returns 保存または更新されたイベントの配列
 */
export const saveOrUpdateEvents = async (events: Event[]): Promise<Event[]> => {
  try {
    if (!events || events.length === 0) {
      console.log("保存するイベントがありません");
      return [];
    }

    console.log(`${events.length}件のイベントを保存または更新します`);

    // トランザクションを使用して一括処理
    const savedEvents = await prisma.$transaction(async (tx) => {
      const results: Event[] = [];

      for (const event of events) {
        // 説明文からキーデータ抽出
        const { keywords, keyPhrases, keySentences } =
          await extractEventKeyData(event.description || "");

        // イベントIDで既存のイベントを検索
        const existingEvent = await tx.event.findUnique({
          where: { id: event.id },
        });

        let savedEvent;
        if (existingEvent) {
          // 既存のイベントを更新
          console.log(`イベント「${event.title}」を更新します`);
          savedEvent = await tx.event.update({
            where: { id: event.id },
            data: {
              title: event.title,
              description: event.description,
              eventDate: event.eventDate,
              startTime: event.startTime,
              endTime: event.endTime,
              venue: event.venue,
              address: event.address,
              location: event.location,
              detailUrl: event.detailUrl,
              updatedAt: new Date(),
              format: event.format,
              difficulty: event.difficulty,
              price: event.price,
              eventType: event.eventType,
              keywords,
              keyPhrases,
              keySentences,
            },
          });
        } else {
          // 新規イベントを作成
          console.log(`新規イベント「${event.title}」を作成します`);
          savedEvent = await tx.event.create({
            data: {
              ...event,
              id: event.id ?? crypto.randomUUID(),
              keywords,
              keyPhrases,
              keySentences,
            },
          });
        }

        results.push(savedEvent);
      }

      return results;
    });

    console.log(`${savedEvents.length}件のイベントを保存または更新しました`);
    return savedEvents;
  } catch (error) {
    console.error("イベント保存エラー:", error);
    throw error;
  }
};
