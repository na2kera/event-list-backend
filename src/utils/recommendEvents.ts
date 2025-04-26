import { User, Event } from "@prisma/client";
import { getUserById } from "./userUtils";
import { getAllEvents, getFilteredEvents } from "./eventUtils";
import { hydeEventsForUser } from "./eventRag";
import { fetchAndConvertConnpassEvents, UserProfile } from "./connpassEventUtils";

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

    // ユーザーIDからユーザー情報を取得
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

    // Connpass APIからイベントを取得
    const apiKey = process.env.CONNPASS_API_KEY;
    if (!apiKey) {
      console.warn(
        "CONNPASS_API_KEYが設定されていません。Connpassイベントは取得されません。"
      );
    }

    let connpassEvents: Event[] = [];
    if (apiKey) {
      try {
        // ユーザープロファイルを作成
        // ユーザープロファイルを作成（場所情報のみ）
        const userProfile: UserProfile = {
          place: user.place || undefined
        };

        // Connpass APIからイベントを取得し、変換する
        connpassEvents = await fetchAndConvertConnpassEvents(userProfile, 14);
        console.log(`Connpass APIから${connpassEvents.length}件のイベントを取得しました`);
      } catch (error) {
        console.error("Connpass APIからのイベント取得に失敗しました:", error);
      }
    }

    // DBのイベントとConnpassのイベントを結合
    const combinedEvents = [...filteredEvents, ...connpassEvents];
    console.log(`合計イベント数: ${combinedEvents.length}`);

    // ユーザーオブジェクトを作成して渡す
    const recommendedEventIds = await hydeEventsForUser(
      {
        place: user.place,
        stack: user.stack,
        tag: user.tag,
        level: user.level,
        goal: user.goal,
      },
      combinedEvents // 結合されたイベントオブジェクトのリストを渡す
    );

    return recommendedEventIds;
  } catch (error) {
    console.error("イベント推薦エラー:", error);
    throw error;
  }
};
