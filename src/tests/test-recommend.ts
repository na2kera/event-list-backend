import { recommendEventsByHyDE } from "../utils/recommendEvents";
import { getUserById } from "../utils/userUtils";
import { Event } from "@prisma/client";
import dotenv from "dotenv";
import { recommendEventsByKeyword } from "../utils/recommendEvents";
// 環境変数の読み込み
dotenv.config();

/**
 * レコメンド機能のテスト関数
 * 実際のユーザーIDを使用してレコメンド機能をテストします
 */
async function testRecommendEvents() {
  console.log("===== レコメンド機能のテスト開始 =====");

  try {
    // テスト用のユーザーIDを指定（実際のDBに存在するユーザーIDを使用）
    // 注意: 実際のユーザーIDに置き換えてください
    const testUserId = "2bf76f4b-824e-449a-a1d7-3348b696e0c9"; // ここを実際のユーザーIDに変更

    // ユーザー情報を取得
    const user = await getUserById(testUserId);
    if (!user) {
      console.error(
        `ユーザーID ${testUserId} が見つかりません。有効なユーザーIDを指定してください。`
      );
      return;
    }

    console.log(`テストユーザー情報:`);
    console.log(`- 名前: ${user.name || "未設定"}`);
    console.log(`- 居住地: ${user.place || "未設定"}`);
    console.log(`- 技術スタック: ${user.stack?.join(", ") || "未設定"}`);
    console.log(`- 興味タグ: ${user.tag?.join(", ") || "未設定"}`);
    console.log(`- 技術レベル: ${user.level || "未設定"}`);
    console.log(`- 目標: ${user.goal?.join(", ") || "未設定"}`);

    console.log("\nレコメンド処理を実行中...");

    // レコメンド処理の実行
    const startTime = Date.now();
    const recommendedEventIds = await recommendEventsByKeyword(testUserId);
    const endTime = Date.now();

    console.log(
      `レコメンド処理が完了しました（処理時間: ${
        (endTime - startTime) / 1000
      }秒）`
    );
    console.log(`レコメンドされたイベント数: ${recommendedEventIds.length}件`);

    if (recommendedEventIds.length > 0) {
      console.log("\nレコメンドされたイベント:");
      recommendedEventIds.forEach((event, index) => {
        console.log(`${index + 1}. ID: ${event.eventId}`);
        console.log(`   タイトル: ${event.title}`);
        console.log(`   関連性スコア: ${event.relevanceScore}`);
        console.log('---');
      });
    } else {
      console.log("レコメンドされたイベントはありませんでした。");
    }

    console.log("\n===== レコメンド機能のテスト完了 =====");
  } catch (error) {
    console.error("テスト中にエラーが発生しました:", error);
  }
}

// テストの実行
testRecommendEvents();
