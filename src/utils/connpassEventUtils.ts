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

// 都道府県リスト（短縮形→正式名称マッピング）
const PREF_MAP: { [key: string]: string } = {
  北海道: "北海道",
  青森: "青森県",
  岩手: "岩手県",
  宮城: "宮城県",
  秋田: "秋田県",
  山形: "山形県",
  福島: "福島県",
  茨城: "茨城県",
  栃木: "栃木県",
  群馬: "群馬県",
  埼玉: "埼玉県",
  千葉: "千葉県",
  東京: "東京都",
  神奈川: "神奈川県",
  新潟: "新潟県",
  富山: "富山県",
  石川: "石川県",
  福井: "福井県",
  山梨: "山梨県",
  長野: "長野県",
  岐阜: "岐阜県",
  静岡: "静岡県",
  愛知: "愛知県",
  三重: "三重県",
  滋賀: "滋賀県",
  京都: "京都府",
  大阪: "大阪府",
  兵庫: "兵庫県",
  奈良: "奈良県",
  和歌山: "和歌山県",
  鳥取: "鳥取県",
  島根: "島根県",
  岡山: "岡山県",
  広島: "広島県",
  山口: "山口県",
  徳島: "徳島県",
  香川: "香川県",
  愛媛: "愛媛県",
  高知: "高知県",
  福岡: "福岡県",
  佐賀: "佐賀県",
  長崎: "長崎県",
  熊本: "熊本県",
  大分: "大分県",
  宮崎: "宮崎県",
  鹿児島: "鹿児島県",
  沖縄: "沖縄県",
};
const PREF_SHORTS = Object.keys(PREF_MAP);

/**
 * ConnpassイベントをPrismaのEvent型に変換する関数
 * レコメンド情報に必要な最小限のフィールドのみを設定
 * @param connpassEvent Connpass APIから取得したイベント
 * @param locationOverride 都道府県名を直接指定してlocationを上書きする場合に使用
 * @returns Prisma Event型に変換されたイベント
 */
export const convertConnpassEventToPrismaEvent = (
  connpassEvent: ConnpassEventV2,
  locationOverride?: string
): Event => {
  // イベントタイプの判定（タイトルやタグから推測）
  let eventType: EventType = EventType.WORKSHOP; // デフォルト値
  const title = connpassEvent.title.toLowerCase();
  const description = (connpassEvent.description || "").toLowerCase();
  const tags = connpassEvent.tags
    ? connpassEvent.tags.map((tag: string) => tag.toLowerCase())
    : [];

  // 修正が必要
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

  // --- ここで都道府県（短縮形）を抽出し、正式名称でlocationに格納 ---
  let location = null;
  const locationSource = `${venue} ${address ?? ""}`;
  for (const short of PREF_SHORTS) {
    if (locationSource.includes(short)) {
      location = PREF_MAP[short];
      break;
    }
  }
  // オンラインイベントの場合は"オンライン"を格納
  if (!location) {
    const lower = locationSource.toLowerCase();
    if (
      lower.includes("オンライン") ||
      lower.includes("online") ||
      lower.includes("zoom") ||
      lower.includes("teams") ||
      lower.includes("virtual")
    ) {
      location = "オンライン";
    }
  }
  // それでも抽出できなければ「不明」
  if (!location) {
    location = "不明";
  }
  // locationOverrideが指定されていれば必ず上書き
  if (locationOverride) {
    location = locationOverride;
  }

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
    location: location,
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
    const events = filteredEvents.map((event) =>
      convertConnpassEventToPrismaEvent(event)
    );
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
    const events = apiResponse.events.map((event) =>
      convertConnpassEventToPrismaEvent(event)
    );
    return events;
  } catch (error) {
    console.error("Connpassイベント取得エラー:", error);
    return [];
  }
};

/**
 * place/addressからlocation（都道府県名 or オンライン or 不明）を判定
 * @param place 開催場所
 * @param address 住所
 * @returns 都道府県名（例：東京都）、オンライン、不明
 */
export function detectLocationFromAddress(
  place?: string | null,
  address?: string | null
): string {
  const locationSource = `${place ?? ""} ${address ?? ""}`.toLowerCase();
  // オンライン判定
  if (
    locationSource.includes("オンライン") ||
    locationSource.includes("online") ||
    locationSource.includes("zoom") ||
    locationSource.includes("teams") ||
    locationSource.includes("virtual")
  ) {
    return "オンライン";
  }
  // 都道府県名判定
  for (const short of PREF_SHORTS) {
    if (locationSource.includes(short)) {
      return PREF_MAP[short];
    }
  }
  // どちらも該当しなければ「不明」
  return "不明";
}
