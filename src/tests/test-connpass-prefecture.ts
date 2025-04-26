import { fetchConnpassEventsV2 } from "../services/connpassService";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

/**
 * Connpass APIのprefecturesパラメータをテストする関数
 */
async function testConnpassPrefectureFilter() {
  console.log("===== Connpass API prefecturesパラメータのテスト開始 =====");

  try {
    // 日付範囲の設定（今日から14日後まで）
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 14);

    // 日付をYYYYMMDD形式に変換
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const ymd = `${year}${month}${day}`;

    const yearEnd = endDate.getFullYear();
    const monthEnd = String(endDate.getMonth() + 1).padStart(2, "0");
    const dayEnd = String(endDate.getDate()).padStart(2, "0");
    const ymdEnd = `${yearEnd}${monthEnd}${dayEnd}`;

    // 東京のイベントを取得
    console.log("\n1. 東京のイベントを取得");
    const tokyoResponse = await fetchConnpassEventsV2({
      api_key: process.env.CONNPASS_API_KEY || "",
      order: 1,
      ymd: ymd,
      ymd_end: ymdEnd,
      prefectures: "東京",
      count: 10
    });

    console.log(`東京のイベント: ${tokyoResponse.events.length}件取得`);
    
    // 各イベントの開催地を表示
    console.log("東京のイベント開催地:");
    tokyoResponse.events.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title}`);
      console.log(`   場所: ${event.place || "不明"} (${event.address || "住所不明"})`);
      console.log(`   開催日: ${event.started_at}`);
    });

    // 大阪のイベントを取得
    console.log("\n2. 大阪のイベントを取得");
    const osakaResponse = await fetchConnpassEventsV2({
      api_key: process.env.CONNPASS_API_KEY || "",
      order: 1,
      ymd: ymd,
      ymd_end: ymdEnd,
      prefectures: "大阪",
      count: 10
    });

    console.log(`大阪のイベント: ${osakaResponse.events.length}件取得`);
    
    // 各イベントの開催地を表示
    console.log("大阪のイベント開催地:");
    osakaResponse.events.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title}`);
      console.log(`   場所: ${event.place || "不明"} (${event.address || "住所不明"})`);
      console.log(`   開催日: ${event.started_at}`);
    });

    // 複数県のイベントを取得
    console.log("\n3. 東京と大阪のイベントを取得");
    const multiPrefResponse = await fetchConnpassEventsV2({
      api_key: process.env.CONNPASS_API_KEY || "",
      order: 1,
      ymd: ymd,
      ymd_end: ymdEnd,
      prefectures: "東京,大阪",
      count: 10
    });

    console.log(`東京と大阪のイベント: ${multiPrefResponse.events.length}件取得`);
    
    // 各イベントの開催地を表示
    console.log("東京と大阪のイベント開催地:");
    multiPrefResponse.events.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title}`);
      console.log(`   場所: ${event.place || "不明"} (${event.address || "住所不明"})`);
      console.log(`   開催日: ${event.started_at}`);
    });

  } catch (error) {
    console.error("テスト中にエラーが発生しました:", error);
  }

  console.log("===== Connpass API prefecturesパラメータのテスト終了 =====");
}

// テストを実行
testConnpassPrefectureFilter();
