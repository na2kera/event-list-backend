import { User, Event } from "@prisma/client";
import { getUserById } from "./userUtils";
import {
  getAllEvents,
  getFilteredEvents,
  saveOrUpdateEvents,
} from "./eventUtils";
import { hydeEventsForUser } from "./eventRag";
import {
  fetchAndConvertConnpassEvents,
  UserProfile,
} from "./connpassEventUtils";
import {
  generateKeywordsAndFetchEvents,
  LLMRecommendedEvent,
  rankEventsByKeywordMatch,
  selectOptimalEventsWithLLM,
  UserInfo,
} from "./keywordRecommendation";

/**
 * ユーザーIDに基づいてHyDEアルゴリズムでイベントをレコメンドする
 * @param userId ユーザーID
 * @returns レコメンドされたイベントの配列
 */
export const recommendEventsByHyDE = async (userId: string) => {
  try {
    // ユーザーIDからユーザー情報を取得
    const user = await getUserById(userId);

    if (!user) {
      throw new Error(`ユーザー ${userId} が見つかりません。`);
    }

    // ユーザーの居住地と技術スタックに基づいてイベントをフィルタリング
    const filteredEvents = await getFilteredEvents({
      // 現在以降のイベントのみを取得
      fromDate: new Date(),
      // ユーザーの居住地に基づいてフィルタリング
      location: user.place || undefined,
      // ユーザーの技術スタックに基づいてフィルタリング
      skills: user.stack || undefined,
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
          place: user.place || undefined,
        };

        // Connpass APIからイベントを取得し、変換する
        connpassEvents = await fetchAndConvertConnpassEvents(userProfile, 14);
        console.log(
          `Connpass APIから${connpassEvents.length}件のイベントを取得しました`
        );

        // 取得したイベントをDBに保存または更新する
        if (connpassEvents.length > 0) {
          try {
            const savedEvents = await saveOrUpdateEvents(connpassEvents);
            console.log(`${savedEvents.length}件のイベントをDBに保存しました`);
          } catch (saveError) {
            console.error(
              "ConnpassイベントのDB保存中にエラーが発生しました:",
              saveError
            );
            // 保存に失敗してもレコメンド処理は続行する
          }
        }
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

/**
 * ユーザーIDに基づいてキーワードを生成して、それに基づいてイベントを推薦する統合関数
 * @param userId ユーザーID
 * @param fromDate 検索開始日（YYYYMMDD形式、デフォルト：今日）
 * @param toDate 検索終了日（YYYYMMDD形式、デフォルト：14日後）
 * @returns LLMが選んだ推薦イベントの配列
 */
export const recommendEventsByKeyword = async (
  userId: string,
  fromDate?: string,
  toDate?: string
): Promise<LLMRecommendedEvent[]> => {
  try {
    console.log("イベント推薦プロセスを開始します...");

    // ユーザーIDからユーザー情報を取得
    const user = await getUserById(userId);

    if (!user) {
      throw new Error(`ユーザー ${userId} が見つかりません。`);
    }

    // UserInfoオブジェクトを作成
    const userInfo: UserInfo = {
      place: user.place,
      stack: user.stack,
      tag: user.tag,
      level: user.level,
      goal: user.goal,
    };

    // 1. キーワードを生成してConnpass APIでイベントを取得
    const { events, keywords } = await generateKeywordsAndFetchEvents(
      userInfo,
      fromDate,
      toDate
    );

    if (events.length === 0) {
      console.log("イベントが見つかりませんでした。");
      return [];
    }

    // 2. イベントの処理（取得したイベントが10個以上の場合のみランキング付けを行う）
    let rankedEvents;
    const LLM_MAX_EVENTS = 10; // LLMに渡す最大イベント数

    if (events.length <= LLM_MAX_EVENTS) {
      // 10個以下の場合はランキング付けせずにそのまま使用
      console.log(
        `イベント数が${events.length}個で${LLM_MAX_EVENTS}個以下のため、ランキング付けをスキップします`
      );

      // RankedEvent形式に変換（スコアは計算しないが形式を合わせる必要がある）
      rankedEvents = events.map((event) => ({
        event,
        score: 1, // ダミースコア
        matchedKeywords: [], // マッチしたキーワードは計算しない
      }));
    } else {
      // 10個以上の場合はキーワードマッチングでランキング付け
      console.log(
        `イベント数が${events.length}個で${LLM_MAX_EVENTS}個以上のため、ランキング付けを行います`
      );
      rankedEvents = rankEventsByKeywordMatch(
        events,
        keywords,
        userInfo,
        LLM_MAX_EVENTS // 上位10個に絞り込む
      );
    }

    if (rankedEvents.length === 0) {
      console.log("ランキング付けされたイベントがありません。");
      return [];
    }

    // 3. LLMに最適なイベントを選択させる
    const recommendedEvents = await selectOptimalEventsWithLLM(
      rankedEvents,
      userInfo
    );

    // 4. 関連性スコアが一定以上のイベントのみをフィルタリング
    const RELEVANCE_THRESHOLD = 70; // しきい値：70点以上
    const filteredEvents = recommendedEvents.filter(
      (event) => event.relevanceScore >= RELEVANCE_THRESHOLD
    );

    console.log(
      `${recommendedEvents.length}件のイベントから、スコア${RELEVANCE_THRESHOLD}以上の${filteredEvents.length}件を選出しました。`
    );
    console.log("イベント推薦プロセスが完了しました。");

    return filteredEvents;
  } catch (error) {
    console.error("イベント推薦エラー:", error);
    return [];
  }
};
