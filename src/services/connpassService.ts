import axios from "axios";
import prisma from "../config/prisma";
import { convertConnpassEventToPrismaEvent } from "../utils/connpassEventUtils";
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
 * 今日から days 日後までのイベントを取得して Event テーブルに upsert
 * @param days 何日後まで取得するか (デフォルト 30 日)
 * @returns 取得件数と保存件数
 */
export const fetchAndSaveUpcomingEvents = async (
  apiKey: string,
  days: number = 30
): Promise<{ fetched: number; saved: number }> => {
  if (!apiKey) throw new Error("CONNPASS_API_KEY is required");

  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + days);

  const ymd = today.toISOString().split("T")[0].replace(/-/g, "");
  const ymdEnd = end.toISOString().split("T")[0].replace(/-/g, "");

  const response = await fetchConnpassEventsV2({
    api_key: apiKey,
    ymd,
    ymd_end: ymdEnd,
    order: 2,
    count: 100,
  });

  const events = response.events.map(convertConnpassEventToPrismaEvent);

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
