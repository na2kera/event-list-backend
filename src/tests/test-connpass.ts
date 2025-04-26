import { Event } from "@prisma/client";
import dotenv from "dotenv";
import {
  fetchAndConvertConnpassEvents,
  UserProfile,
  convertConnpassEventToPrismaEvent,
} from "../utils/connpassEventUtils";

// 環境変数の読み込み
dotenv.config();

// テスト用の関数
async function testConnpassConversion() {
  try {
    console.log("Connpass APIからイベントを取得中...");

    // テスト用のユーザープロファイルを作成（場所情報のみ）
    const userProfile: UserProfile = {
      place: "東京都",
    };

    // 新しく作成した関数を使用してイベントを取得
    console.log("fetchAndConvertConnpassEvents関数を使用してイベントを取得...");
    const events = await fetchAndConvertConnpassEvents(userProfile, 30); // 1ヶ月以内のイベントを取得

    if (events.length === 0) {
      console.log("イベントが見つかりませんでした。");
      return;
    }

    // 最初のイベントを取得
    const convertedEvent = events[0];

    // ベクトルDBに格納される情報を表示
    const venue = convertedEvent.venue || "";
    const address = convertedEvent.address || "";
    const location = venue + (address ? ` (${address})` : "");
    const eventDate = convertedEvent.eventDate
      ? convertedEvent.eventDate.toISOString().split("T")[0]
      : "";
    const detailUrl = convertedEvent.detailUrl || "";

    console.log("\n===== ベクトルDBに格納される情報 =====");
    console.log(`タイトル: ${convertedEvent.title}`);
    console.log(`開催地: ${location}`);
    console.log(`開催日: ${eventDate}`);
    console.log(`詳細URL: ${detailUrl}`);
    console.log(`概要: ${convertedEvent.description}`);

    // 元のイベントタイプと変換後のイベントタイプを表示
    console.log("\n===== イベント変換情報 =====");
    console.log(`イベントタイプ: ${convertedEvent.eventType}`);
    console.log(`開催形式: ${convertedEvent.format}`);
    console.log(`イベントID: ${convertedEvent.id}`);
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

// テスト実行
testConnpassConversion();
