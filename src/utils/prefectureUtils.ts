/**
 * 都道府県関連のユーティリティ関数
 */

/**
 * 日本語の都道府県名をConnpass APIで使用する英語コードに変換する
 * @param prefecture 日本語の都道府県名
 * @returns Connpass APIで使用する英語コード
 */
export const convertPrefectureToCode = (prefecture?: string | null): string => {
  if (!prefecture) {
    return "online";
  }

  if (prefecture.includes("東京")) {
    return "tokyo";
  } else if (prefecture.includes("大阪")) {
    return "osaka";
  } else if (prefecture.includes("京都")) {
    return "kyoto";
  } else if (prefecture.includes("兵庫")) {
    return "hyogo";
  } else if (prefecture.includes("福岡")) {
    return "fukuoka";
  } else if (prefecture.includes("北海道")) {
    return "hokkaido";
  } else if (prefecture.includes("愛知")) {
    return "aichi";
  } else if (prefecture.includes("神奈川")) {
    return "kanagawa";
  } else if (prefecture.includes("埼玉")) {
    return "saitama";
  } else if (prefecture.includes("千葉")) {
    return "chiba";
  } else if (prefecture.includes("静岡")) {
    return "shizuoka";
  } else if (prefecture.includes("広島")) {
    return "hiroshima";
  } else if (prefecture.includes("宮城")) {
    return "miyagi";
  } else if (prefecture.includes("沖縄")) {
    return "okinawa";
  } else if (prefecture.includes("茨城")) {
    return "ibaraki";
  } else if (prefecture.includes("栃木")) {
    return "tochigi";
  } else if (prefecture.includes("群馬")) {
    return "gunma";
  } else if (prefecture.includes("新潟")) {
    return "niigata";
  } else if (prefecture.includes("富山")) {
    return "toyama";
  } else if (prefecture.includes("石川")) {
    return "ishikawa";
  } else if (prefecture.includes("福井")) {
    return "fukui";
  } else if (prefecture.includes("山梨")) {
    return "yamanashi";
  } else if (prefecture.includes("長野")) {
    return "nagano";
  } else if (prefecture.includes("岐阜")) {
    return "gifu";
  } else if (prefecture.includes("三重")) {
    return "mie";
  } else if (prefecture.includes("滋賀")) {
    return "shiga";
  } else if (prefecture.includes("奈良")) {
    return "nara";
  } else if (prefecture.includes("和歌山")) {
    return "wakayama";
  } else if (prefecture.includes("鳥取")) {
    return "tottori";
  } else if (prefecture.includes("島根")) {
    return "shimane";
  } else if (prefecture.includes("岡山")) {
    return "okayama";
  } else if (prefecture.includes("山口")) {
    return "yamaguchi";
  } else if (prefecture.includes("徳島")) {
    return "tokushima";
  } else if (prefecture.includes("香川")) {
    return "kagawa";
  } else if (prefecture.includes("愛媛")) {
    return "ehime";
  } else if (prefecture.includes("高知")) {
    return "kochi";
  } else if (prefecture.includes("佐賀")) {
    return "saga";
  } else if (prefecture.includes("長崎")) {
    return "nagasaki";
  } else if (prefecture.includes("熊本")) {
    return "kumamoto";
  } else if (prefecture.includes("大分")) {
    return "oita";
  } else if (prefecture.includes("宮崎")) {
    return "miyazaki";
  } else if (prefecture.includes("鹿児島")) {
    return "kagoshima";
  } else if (prefecture.includes("青森")) {
    return "aomori";
  } else if (prefecture.includes("岩手")) {
    return "iwate";
  } else if (prefecture.includes("秋田")) {
    return "akita";
  } else if (prefecture.includes("山形")) {
    return "yamagata";
  } else if (prefecture.includes("福島")) {
    return "fukushima";
  }

  // その他の場合はオンラインも含めて取得
  return "online";
};
