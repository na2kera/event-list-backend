import prisma from "../config/prisma";
import { User, Event } from "@prisma/client";
import {
  getUserById,
  getUserWithDetailsById,
  getMockUserById,
} from "../utils/userUtils";
import { getAllEvents, getFilteredEvents } from "../utils/eventUtils";
import { rankEventsForUser } from "./eventRagService";

/**
 * ユーザーIDに基づいてイベントを推薄する
 * @param userId ユーザーID
 * @returns 推薄されたイベントの配列
 */
export const recommendEventsForUser = async (userId: string) => {
  try {
    // まずすべてのイベントを取得
    const allEvents = await getAllEvents();
    console.log(`全イベント数: ${allEvents.length}`);

    // ユーザー情報を取得
    const mockUser = getMockUserById(userId);

    if (!mockUser) {
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

    // フィルタリングされたイベントが少ない場合は、RAGを使用して推薄
    const recommendedEventIds = await rankEventsForUser(
      mockUser.location,
      mockUser.techStack,
      mockUser.interests,
      mockUser.skillLevel,
      mockUser.goals
    );

    return recommendedEventIds;
  } catch (error) {
    console.error("イベント推薄エラー:", error);
    throw error;
  }
};
