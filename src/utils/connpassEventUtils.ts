import { Event, EventType, EventFormat, DifficultyLevel } from "@prisma/client";
import { fetchConnpassEventsV2, ConnpassEventV2, ConnpassSearchParamsV2 } from "../services/connpassService";

/**
 * ユーザープロファイル型定義
 * シンプルに場所情報のみを持つ
 */
export interface UserProfile {
  place?: string; // 居住地（都道府県）
};

/**
 * ConnpassイベントをPrismaのEvent型に変換する関数
 * レコメンド情報に必要な最小限のフィールドのみを設定
 * @param connpassEvent Connpass APIから取得したイベント
 * @returns Prisma Event型に変換されたイベント
 */
export const convertConnpassEventToPrismaEvent = (connpassEvent: ConnpassEventV2): Event => {
  // イベントタイプの判定（タイトルやタグから推測）
  let eventType: EventType = EventType.WORKSHOP; // デフォルト値
  const title = connpassEvent.title.toLowerCase();
  const description = (connpassEvent.description || '').toLowerCase();
  const tags = connpassEvent.tags ? connpassEvent.tags.map((tag: string) => tag.toLowerCase()) : [];
  
  // タグとタイトルからイベントタイプを判定
  if (title.includes('ハッカソン') || tags.includes('hackathon') || tags.includes('ハッカソン')) {
    eventType = EventType.HACKATHON;
  } else if (title.includes('コンテスト') || tags.includes('contest') || tags.includes('コンテスト')) {
    eventType = EventType.CONTEST;
  } else if (title.includes('lt') || title.includes('ライトニングトーク') || 
            tags.includes('lightning_talk') || tags.includes('lt') || 
            tags.includes('ライトニングトーク')) {
    eventType = EventType.LIGHTNING_TALK;
  }
  
  // 開催形式の判定
  let format: EventFormat = EventFormat.OFFLINE; // デフォルト値
  if (title.includes('オンライン') || description.includes('オンライン') || 
      tags.includes('online') || tags.includes('オンライン') || 
      connpassEvent.place?.includes('オンライン') || 
      connpassEvent.place?.toLowerCase().includes('online')) {
    format = EventFormat.ONLINE;
  } else if (title.includes('ハイブリッド') || description.includes('ハイブリッド') || 
             tags.includes('hybrid') || tags.includes('ハイブリッド')) {
    format = EventFormat.HYBRID;
  }
  
  // 日付と時間の変換
  const startDate = new Date(connpassEvent.started_at);
  
  // 開催場所の設定
  const venue = connpassEvent.place || '未定';
  const address = connpassEvent.address || null;
  
  // 必要最小限のフィールドのみを設定
  return {
    id: `connpass_${connpassEvent.id}`,
    title: connpassEvent.title,
    description: connpassEvent.description || connpassEvent.catch || "",
    eventDate: startDate,
    startTime: startDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    endTime: connpassEvent.ended_at ? new Date(connpassEvent.ended_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : null,
    venue: venue,
    address: address,
    location: null,
    detailUrl: connpassEvent.url,
    organizationId: "connpass_org_default", // 組織IDはデフォルト値を使用
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
    const place = userProfile.place || '';
    let prefecture = place ? place.split('都')[0].split('道')[0].split('府')[0].split('県')[0] : '';

    // 日付範囲の設定（今日からdays日後まで）
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + days);

    // 日付をYYYYMMDD形式に変換
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const ymd = `${year}${month}${day}`;

    const yearEnd = endDate.getFullYear();
    const monthEnd = String(endDate.getMonth() + 1).padStart(2, '0');
    const dayEnd = String(endDate.getDate()).padStart(2, '0');
    const ymdEnd = `${yearEnd}${monthEnd}${dayEnd}`;

    // APIリクエストパラメータを準備
    const params: ConnpassSearchParamsV2 = {
      api_key: process.env.CONNPASS_API_KEY || "", // APIキーがない場合は空文字列
      order: 1, // 開催日順
      ymd: ymd, // 今日以降
      ymd_end: ymdEnd, // 指定日数後まで
    };

    // 居住地が設定されている場合は、その地域のイベントをフィルタリング
    if (prefecture) {
      params.prefectures = prefecture;
    }

    const response = await fetchConnpassEventsV2(params);
    console.log(`Connpass API V2: ${response.events.length}件取得しました`);

    // 取得したイベントをPrismaのEvent型に変換
    const events = response.events.map(convertConnpassEventToPrismaEvent);
    return events;
  } catch (error) {
    console.error('Connpass APIからイベントを取得できませんでした:', error);
    return [];
  }
};
