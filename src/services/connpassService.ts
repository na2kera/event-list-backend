import axios from "axios";
import prisma from "../config/prisma";
import {
  convertConnpassEventToPrismaEvent,
  detectLocationFromAddress,
} from "../utils/connpassEventUtils";
import { extractEventKeyData } from "../utils/extractEventKeyData";

/**
 * Connpass API V2のレスポンス型定義
 */
export interface ConnpassEventV2 {
  id: number; // イベントID
  title: string; // イベントタイトル
  catch: string; // キャッチ
  description: string; // 詳細
  url: string; // イベントURL
  started_at: string; // 開始日時
  ended_at: string; // 終了日時
  limit: number | null; // 定員
  hash_tag: string | null; // ハッシュタグ
  event_type: string; // イベントタイプ
  accepted: number; // 参加者数
  waiting: number; // 補欠者数
  updated_at: string; // 更新日時
  owner: {
    id: number; // 主催者ID
    nickname: string; // 主催者ニックネーム
    display_name: string; // 主催者表示名
  };
  place: string | null; // 開催場所
  address: string | null; // 住所
  lat: number | null; // 緯度
  lon: number | null; // 経度
  group: {
    id: number; // グループID
    title: string; // グループ名
    url: string; // グループURL
  } | null;
  tags: string[]; // タグ一覧
}

export interface ConnpassResponseV2 {
  total?: number; // 全件数 (v2 は results_available などの場合あり)
  count?: number; // 取得件数
  offset?: number; // オフセット
  events: ConnpassEventV2[]; // イベント一覧
}

/**
 * Connpass API V2検索パラメータ
 */
export interface ConnpassSearchParamsV2 {
  api_key: string; // APIキー（必須）
  event_id?: number | number[]; // イベントID
  keyword?: string | string[]; // キーワード（複数指定時はAND）
  keyword_or?: string | string[]; // キーワード（複数指定時はOR）
  ym?: string | string[]; // イベント開催年月（YYYYMM形式、複数指定可）
  ymd?: string | string[]; // イベント開催年月日（YYYYMMDD形式、複数指定可）
  ymd_end?: string; // イベント開催年月日（終了日、YYYYMMDD形式）
  nickname?: string | string[]; // 主催者のニックネーム
  group_id?: number | number[]; // グループID（旧series_id）
  tag?: string | string[]; // タグ（新機能）
  prefectures?: string; // 都道府県（カンマ区切り）
  offset?: number; // オフセット（旧start）
  start?: number; // ページ開始インデックス（v2 でも利用可能）
  order?: 1 | 2 | 3; // 表示順（1: 更新日時順、2: 開催日時順、3: 新着順）
  count?: number; // 取得件数（最大100）
}

/**
 * Connpass API V2を呼び出す関数
 * @param params 検索パラメータ
 * @returns APIレスポンス
 */
export const fetchConnpassEventsV2 = async (
  params: ConnpassSearchParamsV2
): Promise<ConnpassResponseV2> => {
  try {
    if (!params.api_key) {
      throw new Error("APIキーが必要です");
    }

    // パラメータの整形
    const queryParams: Record<string, string> = {};

    // 配列パラメータの処理
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        queryParams[key] = value.join(",");
      } else if (value !== undefined && value !== null) {
        queryParams[key] = value.toString();
      }
    });

    // APIリクエスト
    const response = await axios.get("https://connpass.com/api/v2/events/", {
      params: queryParams,
      headers: {
        "X-API-Key": params.api_key,
      },
    });

    const got = Array.isArray(response.data.events)
      ? response.data.events.length
      : 0;
    const total = (response.data.total as number | undefined) ?? "?";
    console.log(`Connpass API V2: ${got}件取得（全${total}件中）`);

    return response.data;
  } catch (error) {
    console.error("Connpass API V2呼び出しエラー:", error);
    throw error;
  }
};

/**
 * Connpass APIから最新100件のイベントを取得して Event テーブルに upsert
 * @param apiKey Connpass APIキー
 * @returns 取得件数と保存件数
 */
export const fetchAndSaveLatestEvents = async (
  apiKey: string
): Promise<{ fetched: number; saved: number }> => {
  if (!apiKey) throw new Error("CONNPASS_API_KEY is required");

  // 新着順で100件取得
  const response = await fetchConnpassEventsV2({
    api_key: apiKey,
    order: 3, // 新着順
    count: 100,
  });

  const events = response.events.map((event) => {
    // address/placeからlocationを判定
    const location = detectLocationFromAddress(event.place, event.address);
    return convertConnpassEventToPrismaEvent(event, location);
  });

  let saved = 0;
  for (const ev of events) {
    try {
      // メタデータ抽出
      const { keywords, keyPhrases, keySentences } = await extractEventKeyData(
        ev.description || ""
      );

      await prisma.event.upsert({
        where: { id: ev.id },
        create: { ...ev, keywords, keyPhrases, keySentences },
        update: {
          title: ev.title,
          description: ev.description,
          eventDate: ev.eventDate,
          startTime: ev.startTime,
          endTime: ev.endTime,
          venue: ev.venue,
          address: ev.address,
          detailUrl: ev.detailUrl,
          keywords,
          keyPhrases,
          keySentences,
          updatedAt: new Date(),
        },
      });
      saved++;
    } catch (e) {
      console.error("Event upsert failed", e);
    }
  }

  return { fetched: events.length, saved };
};

/**
 * 47都道府県＋オンラインごとにConnpass APIからイベントを取得し、locationに都道府県名または「オンライン」をセットして保存
 * @param apiKey Connpass APIキー
 * @param days 取得する期間（日数、デフォルト30）
 * @returns 取得件数と保存件数
 */
export const fetchAndSaveAllPrefectureEvents = async (
  apiKey: string,
  days: number = 30
): Promise<{ fetched: number; saved: number }> => {
  if (!apiKey) throw new Error("CONNPASS_API_KEY is required");
  let fetched = 0;
  let saved = 0;
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + days);
  const ymd = today.toISOString().split("T")[0].replace(/-/g, "");
  const ymd_end = end.toISOString().split("T")[0].replace(/-/g, "");

  // 47都道府県＋オンライン
  const PREFECTURES = [
    { en: "hokkaido", ja: "北海道" },
    { en: "aomori", ja: "青森県" },
    { en: "iwate", ja: "岩手県" },
    { en: "miyagi", ja: "宮城県" },
    { en: "akita", ja: "秋田県" },
    { en: "yamagata", ja: "山形県" },
    { en: "fukushima", ja: "福島県" },
    { en: "ibaraki", ja: "茨城県" },
    { en: "tochigi", ja: "栃木県" },
    { en: "gunma", ja: "群馬県" },
    { en: "saitama", ja: "埼玉県" },
    { en: "chiba", ja: "千葉県" },
    { en: "tokyo", ja: "東京都" },
    { en: "kanagawa", ja: "神奈川県" },
    { en: "niigata", ja: "新潟県" },
    { en: "toyama", ja: "富山県" },
    { en: "ishikawa", ja: "石川県" },
    { en: "fukui", ja: "福井県" },
    { en: "yamanashi", ja: "山梨県" },
    { en: "nagano", ja: "長野県" },
    { en: "gifu", ja: "岐阜県" },
    { en: "shizuoka", ja: "静岡県" },
    { en: "aichi", ja: "愛知県" },
    { en: "mie", ja: "三重県" },
    { en: "shiga", ja: "滋賀県" },
    { en: "kyoto", ja: "京都府" },
    { en: "osaka", ja: "大阪府" },
    { en: "hyogo", ja: "兵庫県" },
    { en: "nara", ja: "奈良県" },
    { en: "wakayama", ja: "和歌山県" },
    { en: "tottori", ja: "鳥取県" },
    { en: "shimane", ja: "島根県" },
    { en: "okayama", ja: "岡山県" },
    { en: "hiroshima", ja: "広島県" },
    { en: "yamaguchi", ja: "山口県" },
    { en: "tokushima", ja: "徳島県" },
    { en: "kagawa", ja: "香川県" },
    { en: "ehime", ja: "愛媛県" },
    { en: "kochi", ja: "高知県" },
    { en: "fukuoka", ja: "福岡県" },
    { en: "saga", ja: "佐賀県" },
    { en: "nagasaki", ja: "長崎県" },
    { en: "kumamoto", ja: "熊本県" },
    { en: "oita", ja: "大分県" },
    { en: "miyazaki", ja: "宮崎県" },
    { en: "kagoshima", ja: "鹿児島県" },
    { en: "okinawa", ja: "沖縄県" },
    { en: "online", ja: "オンライン" },
  ];

  for (const pref of PREFECTURES) {
    // 2秒sleepしてレート制限回避
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const response = await fetchConnpassEventsV2({
      api_key: apiKey,
      prefectures: pref.en,
      ymd,
      ymd_end,
      count: 100,
    });
    fetched += response.events.length;
    for (const ev of response.events) {
      try {
        const { keywords, keyPhrases, keySentences } =
          await extractEventKeyData(ev.description || "");
        // address/placeからlocationを判定
        const locationToSave = detectLocationFromAddress(ev.place, ev.address);
        const eventData = convertConnpassEventToPrismaEvent(ev, locationToSave);
        await prisma.event.upsert({
          where: { id: eventData.id },
          create: { ...eventData, keywords, keyPhrases, keySentences },
          update: {
            ...eventData,
            keywords,
            keyPhrases,
            keySentences,
            updatedAt: new Date(),
          },
        });
        saved++;
      } catch (e) {
        console.error("Event upsert failed", e);
      }
    }
  }
  return { fetched, saved };
};
