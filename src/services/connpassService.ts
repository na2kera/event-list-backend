import axios from "axios";

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
  total: number; // 全件数
  count: number; // 取得件数
  offset: number; // オフセット
  events: ConnpassEventV2[]; // イベント一覧
}

/**
 * V1 API互換のためのインターフェース
 */
export interface ConnpassEvent {
  event_id: number;
  title: string;
  catch: string;
  description: string;
  event_url: string;
  started_at: string;
  ended_at: string;
  limit: number;
  hash_tag: string;
  event_type: string;
  accepted: number;
  waiting: number;
  updated_at: string;
  owner_id: number;
  owner_nickname: string;
  owner_display_name: string;
  place: string;
  address: string;
  lat: string;
  lon: string;
  series: {
    id: number;
    title: string;
    url: string;
  };
}

export interface ConnpassResponse {
  results_returned: number;
  results_available: number;
  results_start: number;
  events: ConnpassEvent[];
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
  nickname?: string | string[]; // 主催者のニックネーム
  group_id?: number | number[]; // グループID（旧series_id）
  tag?: string | string[]; // タグ（新機能）
  offset?: number; // オフセット（旧start）
  order?: 1 | 2 | 3; // 表示順（1: 更新日時順、2: 開催日時順、3: 新着順）
  count?: number; // 取得件数（最大100）
}

/**
 * V1 API互換のためのインターフェース
 */
export interface ConnpassSearchParams {
  event_id?: number | number[]; // イベントID
  keyword?: string | string[]; // キーワード（複数指定時はAND）
  keyword_or?: string | string[]; // キーワード（複数指定時はOR）
  ym?: string | string[]; // イベント開催年月（YYYYMM形式、複数指定可）
  ymd?: string | string[]; // イベント開催年月日（YYYYMMDD形式、複数指定可）
  nickname?: string | string[]; // 主催者のニックネーム
  owner_nickname?: string | string[]; // 管理者のニックネーム
  series_id?: number | number[]; // グループID
  start?: number; // 検索の開始位置（1〜100）
  order?: 1 | 2 | 3; // 検索結果の表示順（1: 更新日時順、2: 開催日時順、3: 新着順）
  count?: number; // 取得件数（1〜100）
  format?: string; // レスポンス形式（json固定）
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

    console.log(
      `Connpass API V2: ${response.data.count}件取得（全${response.data.total}件中）`
    );

    return response.data;
  } catch (error) {
    console.error("Connpass API V2呼び出しエラー:", error);
    throw error;
  }
};

/**
 * 後方互換性のためのV1 APIラッパー（非推奨）
 * @param params 検索パラメータ
 * @returns APIレスポンス
 */
export const fetchConnpassEvents = async (
  params: ConnpassSearchParams
): Promise<ConnpassResponse> => {
  console.warn(
    "Connpass API V1は非推奨で、2025年末に廃止予定です。V2への移行を検討してください。"
  );

  try {
    // パラメータの整形
    const queryParams: Record<string, string> = {};

    // 配列パラメータの処理
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        queryParams[key] = value.join(",");
      } else if (value !== undefined) {
        queryParams[key] = value.toString();
      }
    });

    // format=jsonを強制
    queryParams.format = "json";

    // APIリクエスト
    const response = await axios.get("https://connpass.com/api/v1/event/", {
      params: queryParams,
    });

    console.log(
      `Connpass API V1: ${response.data.results_returned}件取得（全${response.data.results_available}件中）`
    );

    return response.data;
  } catch (error) {
    console.error("Connpass API V1呼び出しエラー:", error);
    throw error;
  }
};

/**
 * キーワードでConnpassイベントを検索する
 * @param keyword 検索キーワード
 * @param count 取得件数（デフォルト20件）
 * @param order 並び順（デフォルト開催日時順）
 * @returns 検索結果
 */
/**
 * キーワードでConnpassイベントを検索する（V2 API）
 * @param apiKey APIキー
 * @param keyword 検索キーワード
 * @param count 取得件数（デフォルト20件）
 * @param order 並び順（デフォルト開催日時順）
 * @returns 検索結果
 */
export const searchConnpassEventsByKeywordV2 = async (
  apiKey: string,
  keyword: string,
  count: number = 20,
  order: 1 | 2 | 3 = 2
): Promise<ConnpassEventV2[]> => {
  const response = await fetchConnpassEventsV2({
    api_key: apiKey,
    keyword,
    count,
    order,
  });

  return response.events;
};

/**
 * キーワードでConnpassイベントを検索する（V1 API互換）
 * @param keyword 検索キーワード
 * @param count 取得件数（デフォルト20件）
 * @param order 並び順（デフォルト開催日時順）
 * @returns 検索結果
 */
export const searchConnpassEventsByKeyword = async (
  keyword: string,
  count: number = 20,
  order: 1 | 2 | 3 = 2
): Promise<ConnpassEvent[]> => {
  const response = await fetchConnpassEvents({
    keyword,
    count,
    order,
  });

  return response.events;
};

/**
 * 開催日でConnpassイベントを検索する
 * @param year 年
 * @param month 月
 * @param day 日（省略可）
 * @param count 取得件数（デフォルト20件）
 * @returns 検索結果
 */
/**
 * 開催日でConnpassイベントを検索する（V2 API）
 * @param apiKey APIキー
 * @param year 年
 * @param month 月
 * @param day 日（省略可）
 * @param count 取得件数（デフォルト20件）
 * @returns 検索結果
 */
export const searchConnpassEventsByDateV2 = async (
  apiKey: string,
  year: number,
  month: number,
  day?: number,
  count: number = 20
): Promise<ConnpassEventV2[]> => {
  // 月のフォーマット（1桁の場合は0埋め）
  const monthStr = month.toString().padStart(2, "0");

  if (day) {
    // 日付指定がある場合はymdパラメータを使用
    const dayStr = day.toString().padStart(2, "0");
    const ymd = `${year}${monthStr}${dayStr}`;

    const response = await fetchConnpassEventsV2({
      api_key: apiKey,
      ymd,
      count,
      order: 2, // 開催日時順
    });

    return response.events;
  } else {
    // 月のみ指定の場合はymパラメータを使用
    const ym = `${year}${monthStr}`;

    const response = await fetchConnpassEventsV2({
      api_key: apiKey,
      ym,
      count,
      order: 2, // 開催日時順
    });

    return response.events;
  }
};

/**
 * 開催日でConnpassイベントを検索する（V1 API互換）
 * @param year 年
 * @param month 月
 * @param day 日（省略可）
 * @param count 取得件数（デフォルト20件）
 * @returns 検索結果
 */
export const searchConnpassEventsByDate = async (
  year: number,
  month: number,
  day?: number,
  count: number = 20
): Promise<ConnpassEvent[]> => {
  // 月のフォーマット（1桁の場合は0埋め）
  const monthStr = month.toString().padStart(2, "0");

  if (day) {
    // 日付指定がある場合はymdパラメータを使用
    const dayStr = day.toString().padStart(2, "0");
    const ymd = `${year}${monthStr}${dayStr}`;

    const response = await fetchConnpassEvents({
      ymd,
      count,
      order: 2, // 開催日時順
    });

    return response.events;
  } else {
    // 月のみ指定の場合はymパラメータを使用
    const ym = `${year}${monthStr}`;

    const response = await fetchConnpassEvents({
      ym,
      count,
      order: 2, // 開催日時順
    });

    return response.events;
  }
};

/**
 * 複数のキーワードでOR検索する
 * @param keywords キーワードの配列
 * @param count 取得件数（デフォルト20件）
 * @returns 検索結果
 */
/**
 * 複数のキーワードでOR検索する（V2 API）
 * @param apiKey APIキー
 * @param keywords キーワードの配列
 * @param count 取得件数（デフォルト20件）
 * @returns 検索結果
 */
export const searchConnpassEventsByKeywordsOrV2 = async (
  apiKey: string,
  keywords: string[],
  count: number = 20
): Promise<ConnpassEventV2[]> => {
  const response = await fetchConnpassEventsV2({
    api_key: apiKey,
    keyword_or: keywords,
    count,
    order: 2, // 開催日時順
  });

  return response.events;
};

/**
 * 複数のキーワードでOR検索する（V1 API互換）
 * @param keywords キーワードの配列
 * @param count 取得件数（デフォルト20件）
 * @returns 検索結果
 */
export const searchConnpassEventsByKeywordsOr = async (
  keywords: string[],
  count: number = 20
): Promise<ConnpassEvent[]> => {
  const response = await fetchConnpassEvents({
    keyword_or: keywords,
    count,
    order: 2, // 開催日時順
  });

  return response.events;
};

/**
 * 現在から指定日数以内に開催されるイベントを検索する
 * @param days 日数（デフォルト30日）
 * @param keyword 検索キーワード（省略可）
 * @param count 取得件数（デフォルト20件）
 * @returns 検索結果
 */
/**
 * 現在から指定日数以内に開催されるイベントを検索する（V2 API）
 * @param apiKey APIキー
 * @param days 日数（デフォルト30日）
 * @param keyword 検索キーワード（省略可）
 * @param count 取得件数（デフォルト20件）
 * @returns 検索結果
 */
export const searchUpcomingConnpassEventsV2 = async (
  apiKey: string,
  days: number = 30,
  keyword?: string,
  count: number = 20
): Promise<ConnpassEventV2[]> => {
  // 今日の日付
  const today = new Date();

  // 指定日数後の日付
  const endDate = new Date();
  endDate.setDate(today.getDate() + days);

  // 年月日の配列を生成（YYYYMMDD形式）
  const dateArray: string[] = [];
  const currentDate = new Date(today);

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
    const day = currentDate.getDate().toString().padStart(2, "0");

    dateArray.push(`${year}${month}${day}`);

    // 次の日に進める
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // APIパラメータ
  const params: ConnpassSearchParamsV2 = {
    api_key: apiKey,
    ymd: dateArray,
    count,
    order: 2, // 開催日時順
  };

  // キーワードが指定されている場合は追加
  if (keyword) {
    params.keyword = keyword;
  }

  const response = await fetchConnpassEventsV2(params);

  return response.events;
};

/**
 * 現在から指定日数以内に開催されるイベントを検索する（V1 API互換）
 * @param days 日数（デフォルト30日）
 * @param keyword 検索キーワード（省略可）
 * @param count 取得件数（デフォルト20件）
 * @returns 検索結果
 */
export const searchUpcomingConnpassEvents = async (
  days: number = 30,
  keyword?: string,
  count: number = 20
): Promise<ConnpassEvent[]> => {
  // 今日の日付
  const today = new Date();

  // 指定日数後の日付
  const endDate = new Date();
  endDate.setDate(today.getDate() + days);

  // 年月日の配列を生成（YYYYMMDD形式）
  const dateArray: string[] = [];
  const currentDate = new Date(today);

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
    const day = currentDate.getDate().toString().padStart(2, "0");

    dateArray.push(`${year}${month}${day}`);

    // 次の日に進める
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // APIパラメータ
  const params: ConnpassSearchParams = {
    ymd: dateArray,
    count,
    order: 2, // 開催日時順
  };

  // キーワードが指定されている場合は追加
  if (keyword) {
    params.keyword = keyword;
  }

  const response = await fetchConnpassEvents(params);

  return response.events;
};

/**
 * Connpassイベントをデータベース形式に変換する
 * @param connpassEvent Connpassイベント
 * @returns 変換後のイベントオブジェクト
 */
/**
 * ConnpassイベントV2をデータベース形式に変換する
 * @param connpassEvent ConnpassイベントV2
 * @returns 変換後のイベントオブジェクト
 */
export const convertConnpassEventV2ToDbFormat = (
  connpassEvent: ConnpassEventV2
) => {
  return {
    title: connpassEvent.title,
    description: `${connpassEvent.catch}\n\n${connpassEvent.description}`,
    eventDate: connpassEvent.started_at
      ? new Date(connpassEvent.started_at)
      : null,
    location: connpassEvent.place || connpassEvent.address || "オンライン",
    format: connpassEvent.address ? "オフライン" : "オンライン",
    url: connpassEvent.url,
    // タグをカテゴリとして抽出
    categories:
      connpassEvent.tags ||
      (connpassEvent.hash_tag ? [connpassEvent.hash_tag.replace("#", "")] : []),
    // その他の情報
    additionalInfo: {
      connpassId: connpassEvent.id,
      limit: connpassEvent.limit,
      accepted: connpassEvent.accepted,
      waiting: connpassEvent.waiting,
      ended_at: connpassEvent.ended_at,
      owner: {
        id: connpassEvent.owner.id,
        nickname: connpassEvent.owner.nickname,
        displayName: connpassEvent.owner.display_name,
      },
      group: connpassEvent.group,
      lat: connpassEvent.lat,
      lon: connpassEvent.lon,
      tags: connpassEvent.tags,
    },
  };
};

/**
 * ConnpassイベントV1をデータベース形式に変換する（互換性のため）
 * @param connpassEvent ConnpassイベントV1
 * @returns 変換後のイベントオブジェクト
 */
export const convertConnpassEventToDbFormat = (
  connpassEvent: ConnpassEvent
) => {
  return {
    title: connpassEvent.title,
    description: `${connpassEvent.catch}\n\n${connpassEvent.description}`,
    eventDate: connpassEvent.started_at
      ? new Date(connpassEvent.started_at)
      : null,
    location: connpassEvent.place || connpassEvent.address || "オンライン",
    format: connpassEvent.address ? "オフライン" : "オンライン",
    url: connpassEvent.event_url,
    // タグをカテゴリとして抽出
    categories: connpassEvent.hash_tag
      ? [connpassEvent.hash_tag.replace("#", "")]
      : [],
    // その他の情報
    additionalInfo: {
      connpassId: connpassEvent.event_id,
      limit: connpassEvent.limit,
      accepted: connpassEvent.accepted,
      waiting: connpassEvent.waiting,
      ended_at: connpassEvent.ended_at,
      owner: {
        id: connpassEvent.owner_id,
        nickname: connpassEvent.owner_nickname,
        displayName: connpassEvent.owner_display_name,
      },
      series: connpassEvent.series,
      lat: connpassEvent.lat,
      lon: connpassEvent.lon,
    },
  };
};

/**
 * 複数の検索条件を指定できる汎用的なConnpassイベント検索関数（V2 API）
 * @param apiKey APIキー（必須）
 * @param options 検索オプション
 * @returns 検索結果
 */
export interface ConnpassSearchOptionsV2 {
  keywords?: string[]; // キーワード（AND条件）
  keywordsOr?: string[]; // キーワード（OR条件）
  startDate?: Date; // 検索開始日
  endDate?: Date; // 検索終了日
  tags?: string[]; // タグ
  nickname?: string; // 主催者ニックネーム
  groupId?: number; // グループID
  count?: number; // 取得件数（最大100）
  offset?: number; // オフセット
  order?: 1 | 2 | 3; // 表示順（1: 更新日時順、2: 開催日時順、3: 新着順）
}

export const searchConnpassEventsV2 = async (
  apiKey: string,
  options: ConnpassSearchOptionsV2 = {}
): Promise<ConnpassEventV2[]> => {
  // APIパラメータの初期化
  const params: ConnpassSearchParamsV2 = {
    api_key: apiKey,
    count: options.count || 20,
    order: options.order || 2, // デフォルトは開催日時順
  };

  // オフセットの設定
  if (options.offset !== undefined) {
    params.offset = options.offset;
  }

  // キーワード（AND条件）
  if (options.keywords && options.keywords.length > 0) {
    params.keyword = options.keywords;
  }

  // キーワード（OR条件）
  if (options.keywordsOr && options.keywordsOr.length > 0) {
    params.keyword_or = options.keywordsOr;
  }

  // 日付範囲の処理
  if (options.startDate || options.endDate) {
    const dateArray: string[] = [];

    // 開始日と終了日の設定
    const startDate = options.startDate || new Date();
    const endDate = options.endDate || new Date(startDate);
    if (options.endDate === undefined) {
      // 終了日が指定されていない場合は30日後まで
      endDate.setDate(startDate.getDate() + 30);
    }

    // 日付の範囲を生成
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
      const day = currentDate.getDate().toString().padStart(2, "0");

      dateArray.push(`${year}${month}${day}`);

      // 次の日に進める
      currentDate.setDate(currentDate.getDate() + 1);
    }

    params.ymd = dateArray;
  }

  // タグ
  if (options.tags && options.tags.length > 0) {
    params.tag = options.tags;
  }

  // 主催者ニックネーム
  if (options.nickname) {
    params.nickname = options.nickname;
  }

  // グループID
  if (options.groupId) {
    params.group_id = options.groupId;
  }

  // API呼び出し
  const response = await fetchConnpassEventsV2(params);
  return response.events;
};

/**
 * 複数の検索条件を指定できる汎用的なConnpassイベント検索関数（V1 API互換）
 * @param options 検索オプション
 * @returns 検索結果
 */
export interface ConnpassSearchOptions {
  keywords?: string[]; // キーワード（AND条件）
  keywordsOr?: string[]; // キーワード（OR条件）
  startDate?: Date; // 検索開始日
  endDate?: Date; // 検索終了日
  nickname?: string; // 主催者ニックネーム
  ownerNickname?: string; // 管理者ニックネーム
  seriesId?: number; // グループID
  count?: number; // 取得件数（最大100）
  start?: number; // 検索開始位置
  order?: 1 | 2 | 3; // 表示順（1: 更新日時順、2: 開催日時順、3: 新着順）
}

export const searchConnpassEvents = async (
  options: ConnpassSearchOptions = {}
): Promise<ConnpassEvent[]> => {
  console.warn(
    "Connpass API V1は非推奨で、2025年末に廃止予定です。V2への移行を検討してください。"
  );

  // APIパラメータの初期化
  const params: ConnpassSearchParams = {
    count: options.count || 20,
    order: options.order || 2, // デフォルトは開催日時順
  };

  // 検索開始位置の設定
  if (options.start !== undefined) {
    params.start = options.start;
  }

  // キーワード（AND条件）
  if (options.keywords && options.keywords.length > 0) {
    params.keyword = options.keywords;
  }

  // キーワード（OR条件）
  if (options.keywordsOr && options.keywordsOr.length > 0) {
    params.keyword_or = options.keywordsOr;
  }

  // 日付範囲の処理
  if (options.startDate || options.endDate) {
    const dateArray: string[] = [];

    // 開始日と終了日の設定
    const startDate = options.startDate || new Date();
    const endDate = options.endDate || new Date(startDate);
    if (options.endDate === undefined) {
      // 終了日が指定されていない場合は30日後まで
      endDate.setDate(startDate.getDate() + 30);
    }

    // 日付の範囲を生成
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
      const day = currentDate.getDate().toString().padStart(2, "0");

      dateArray.push(`${year}${month}${day}`);

      // 次の日に進める
      currentDate.setDate(currentDate.getDate() + 1);
    }

    params.ymd = dateArray;
  }

  // 主催者ニックネーム
  if (options.nickname) {
    params.nickname = options.nickname;
  }

  // 管理者ニックネーム
  if (options.ownerNickname) {
    params.owner_nickname = options.ownerNickname;
  }

  // グループID
  if (options.seriesId) {
    params.series_id = options.seriesId;
  }

  // API呼び出し
  const response = await fetchConnpassEvents(params);
  return response.events;
};
