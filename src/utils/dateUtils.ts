/**
 * 日付ユーティリティ関数
 */

/**
 * 日付をYYYYMMDD形式の文字列に変換する
 * @param date 変換する日付
 * @returns YYYYMMDD形式の文字列
 */
export const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

/**
 * 現在日から指定日数後までの日付範囲を取得する
 * @param daysAhead 先の日数（デフォルト: 14日）
 * @returns [開始日(YYYYMMDD), 終了日(YYYYMMDD)]
 */
export const getDateRange = (daysAhead: number = 14): [string, string] => {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + daysAhead);
  
  return [formatDateToYYYYMMDD(today), formatDateToYYYYMMDD(endDate)];
};

/**
 * 開始日と終了日を取得する（指定がない場合は現在から14日後までをデフォルトとする）
 * @param fromDate 開始日（YYYYMMDD形式、オプション）
 * @param toDate 終了日（YYYYMMDD形式、オプション）
 * @returns [開始日(YYYYMMDD), 終了日(YYYYMMDD)]
 */
export const getDateRangeWithDefaults = (
  fromDate?: string,
  toDate?: string,
  daysAhead: number = 14
): [string, string] => {
  if (fromDate && toDate) {
    return [fromDate, toDate];
  }
  
  const [defaultFromDate, defaultToDate] = getDateRange(daysAhead);
  
  return [fromDate || defaultFromDate, toDate || defaultToDate];
};
