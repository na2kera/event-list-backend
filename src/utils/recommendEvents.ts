import prisma from "../config/prisma";
import { User, Event } from "@prisma/client";
import {
  getUserById,
  getUserWithDetailsById,
  getMockUserById,
} from "./userUtils";
import { getAllEvents, getFilteredEvents } from "./eventUtils";
import { hydeEventsForUser } from "./eventRag";

/**
 * ユーザーIDに基づいてイベントをレコメンドする
 * @param userId ユーザーID
 * @returns レコメンドされたイベントの配列
 */
export const recommendEventsForUser = async (userId: string) => {
  try {
    // まずすべてのイベントを取得
    const allEvents = await getAllEvents();
    console.log(`全イベント数: ${allEvents.length}`);

    // ユーザー情報を取得
    const user = await getUserById(userId);

    if (!user) {
      throw new Error(`ユーザー ${userId} が見つかりません。`);
    }

    // ユーザーの居住地と技術スタックに基づいてイベントをフィルタリング
    const filteredEvents = await getFilteredEvents({
      //   location: mockUser.location,
      //   skills: mockUser.techStack,
      // 現在以降のイベントのみを取得
      fromDate: new Date(),
    });

    console.log(`フィルタリング後のイベント数: ${filteredEvents.length}`);

    const recommendedEventIds = await hydeEventsForUser(
      user.place,
      user.stack,
      user.tag,
      user.level,
      user.goal
    );

    return recommendedEventIds;
  } catch (error) {
    console.error("イベント推薄エラー:", error);
    throw error;
  }
};
