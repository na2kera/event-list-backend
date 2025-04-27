import { Event, EventType, EventFormat, DifficultyLevel } from "@prisma/client";
import {
  fetchConnpassEventsV2,
  ConnpassEventV2,
  ConnpassSearchParamsV2,
} from "../services/connpassService";
import { getDateRangeWithDefaults } from "./dateUtils";
import { convertPrefectureToCode } from "./prefectureUtils";

/**
 * ユーザープロファイル型定義
 * シンプルに場所情報のみを持つ
 */
export interface UserProfile {
  place?: string; // 居住地（都道府県）
}

/**
 * ConnpassイベントをPrismaのEvent型に変換する関数
 * レコメンド情報に必要な最小限のフィールドのみを設定
 * @param connpassEvent Connpass APIから取得したイベント
 * @returns Prisma Event型に変換されたイベント
 */
export const convertConnpassEventToPrismaEvent = (
  connpassEvent: ConnpassEventV2
): Event => {
  // イベントタイプの判定（タイトルやタグから推測）
  let eventType: EventType = EventType.WORKSHOP; // デフォルト値
  const title = connpassEvent.title.toLowerCase();
  const description = (connpassEvent.description || "").toLowerCase();
  const tags = connpassEvent.tags
    ? connpassEvent.tags.map((tag: string) => tag.toLowerCase())
    : [];

  // タグとタイトルからイベントタイプを判定
  if (
    title.includes("ハッカソン") ||
    tags.includes("hackathon") ||
    tags.includes("ハッカソン")
  ) {
    eventType = EventType.HACKATHON;
  } else if (
    title.includes("コンテスト") ||
    tags.includes("contest") ||
    tags.includes("コンテスト")
  ) {
    eventType = EventType.CONTEST;
  } else if (
    title.includes("lt") ||
    title.includes("ライトニングトーク") ||
    tags.includes("lightning_talk") ||
    tags.includes("lt") ||
    tags.includes("ライトニングトーク")
  ) {
    eventType = EventType.LIGHTNING_TALK;
  }

  // 開催形式の判定（開催場所のみを見るように改善）
  let format: EventFormat = EventFormat.OFFLINE; // デフォルト値

  const place = connpassEvent.place?.toLowerCase() || "";

  if (
    place.includes("オンライン") ||
    place.includes("online") ||
    place.includes("zoom") ||
    place.includes("teams") ||
    place.includes("meet") ||
    place.includes("virtual")
  ) {
    format = EventFormat.ONLINE;
  } else if (place.includes("ハイブリッド") || place.includes("hybrid")) {
    format = EventFormat.HYBRID;
  }

  // 日付と時間の変換
  const startDate = new Date(connpassEvent.started_at);

  // 開催場所の設定
  const venue = connpassEvent.place || "未定";
  const address = connpassEvent.address || null;

  // 必要最小限のフィールドのみを設定
  return {
    id: `connpass_${connpassEvent.id}`,
    title: connpassEvent.title,
    description: connpassEvent.description || connpassEvent.catch || "",
    eventDate: startDate,
    startTime: startDate.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    endTime: connpassEvent.ended_at
      ? new Date(connpassEvent.ended_at).toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null,
    venue: venue,
    address: address,
    location: null,
    detailUrl: connpassEvent.url,
    organizationId: "cm8h2ibpv0000rycorzgynzp4",
    createdAt: new Date(),
    updatedAt: new Date(),
    image: null,
    format: format,
    difficulty: DifficultyLevel.FOR_EVERYONE,
    price: 0,
    eventType: eventType,
  } as Event;
};

/**
 * Connpass APIからイベントを取得し、PrismaのEvent型に変換する
 * @param userProfile ユーザープロファイル
 * @param days 今日から何日後までのイベントを取得するか（デフォルト：14日）
 * @returns 変換されたEvent型の配列
 */
export const fetchAndConvertConnpassEvents = async (
  userProfile: UserProfile,
  days: number = 14
): Promise<Event[]> => {
  try {
    // 居住地から都道府県を抽出
    const place = userProfile.place || "";
    let prefecture = place
      ? place.split("都")[0].split("道")[0].split("府")[0].split("県")[0]
      : "";

    // 日付範囲の設定（今日からdays日後まで）
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + days);

    // 日付をYYYYMMDD形式に変換
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const ymd = `${year}${month}${day}`;

    const yearEnd = endDate.getFullYear();
    const monthEnd = String(endDate.getMonth() + 1).padStart(2, "0");
    const dayEnd = String(endDate.getDate()).padStart(2, "0");
    const ymdEnd = `${yearEnd}${monthEnd}${dayEnd}`;

    // APIリクエストパラメータを準備
    const params: ConnpassSearchParamsV2 = {
      api_key: process.env.CONNPASS_API_KEY || "", // APIキーがない場合は空文字列
      order: 2, // 開催日時順
      ymd: ymd, // 今日以降
      ymd_end: ymdEnd, // 指定日数後まで
      count: 100, // 取得件数を最大の100件に設定
    };

    // 居住地が設定されている場合は、その地域のイベントをフィルタリング
    // 注意: prefectureパラメータは英語で指定する必要がある
    if (prefecture) {
      // 都道府県名を英語表記に変換
      const prefectureCode = convertPrefectureToCode(prefecture);

      params.prefectures = prefectureCode;
    } else {
      // 居住地が指定されていない場合はオンラインイベントを取得
      params.prefectures = "online";
    }

    // 取得件数を最大値に設定
    params.count = 100;

    const response = await fetchConnpassEventsV2(params);
    console.log(`Connpass API V2: ${response.events.length}件取得しました`);

    // 取得したイベントを開催地でフィルタリング
    const filteredEvents = response.events.filter((event) => {
      const eventPlace = event.place || "";
      const eventAddress = event.address || "";
      const location = eventPlace + " " + eventAddress;

      // オンラインイベントかチェック
      const isOnlineEvent =
        location.toLowerCase().includes("オンライン") ||
        location.toLowerCase().includes("online") ||
        eventPlace.toLowerCase().includes("オンライン") ||
        eventPlace.toLowerCase().includes("online") ||
        eventPlace.toLowerCase().includes("teams") ||
        eventPlace.toLowerCase().includes("zoom");

      // ユーザーの居住地に近いイベントかチェック
      const isNearUserLocation = prefecture && location.includes(prefecture);

      // オンラインイベントか、ユーザーの居住地に近いイベントのみを残す
      return isOnlineEvent || isNearUserLocation;
    });

    console.log(
      `地域フィルタリング後: ${filteredEvents.length}件のイベントが残りました`
    );

    // フィルタリングしたイベントをPrismaのEvent型に変換
    const events = filteredEvents.map(convertConnpassEventToPrismaEvent);
    return events;
  } catch (error) {
    console.error("Connpass APIからイベントを取得できませんでした:", error);
    return [];
  }
};

/**
 * キーワードを直接指定してConnpassAPIでイベントを検索する関数
 * @param requiredKeywords 必須キーワード（AND条件）この中のどれか1つは含まれる必要があります
 * @param optionalKeywords オプションキーワード（OR条件）
 * @param place 場所/都道府県
 * @param fromDate 検索開始日（YYYYMMDD形式、デフォルト：今日）
 * @param toDate 検索終了日（YYYYMMDD形式、デフォルト：14日後）
 * @returns 変換されたPrismaのEvent型の配列
 */
export const fetchConnpassEventsByKeywords = async (
  requiredKeywords: string[],
  optionalKeywords: string[] = [],
  place?: string | null,
  fromDate?: string,
  toDate?: string
): Promise<Event[]> => {
  try {
    // 日付範囲の取得（デフォルト：今日から14日後まで）
    const [ymd, ymdEnd] = getDateRangeWithDefaults(fromDate, toDate);

    // ConnpassAPI検索パラメータの設定
    const params: ConnpassSearchParamsV2 = {
      api_key: process.env.CONNPASS_API_KEY || "",
      order: 2, // 開催日時順
      ymd: ymd,
      ymd_end: ymdEnd,
      count: 100, // 最大取得件数
    };

    // 必須キーワードをAND条件で設定（この中のどれか1つは含まれる必要がある）
    if (requiredKeywords.length > 0) {
      params.keyword = requiredKeywords;
    }

    // オプションキーワードをOR条件で設定
    if (optionalKeywords.length > 0) {
      params.keyword_or = optionalKeywords;
    }

    // 居住地が設定されている場合は、その地域のイベントをフィルタリング
    if (place) {
      let prefecture = place
        ? place.split("都")[0].split("道")[0].split("府")[0].split("県")[0]
        : "";

      // 都道府県名を英語表記に変換（prefectureUtils.tsの関数を使用）
      const prefectureCode = convertPrefectureToCode(prefecture);

      // オンライン以外の場合のみprefecturesパラメータを設定
      if (prefectureCode !== "online") {
        params.prefectures = prefectureCode;
      }
    }

    console.log("ConnpassAPIにリクエストを送信します...");
    const apiResponse = await fetchConnpassEventsV2(params);
    console.log(
      `Connpass API: ${apiResponse.events.length}件取得（全${apiResponse.total}件中）`
    );

    // 取得したイベントをPrismaのEvent型に変換
    const events = apiResponse.events.map(convertConnpassEventToPrismaEvent);
    return events;
  } catch (error) {
    console.error("Connpassイベント取得エラー:", error);
    return [];
  }
};
