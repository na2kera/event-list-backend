import dotenv from "dotenv";
dotenv.config();
import fs from "fs/promises";
import path from "path";
import { fetchConnpassEventsV2 } from "./src/services/connpassService";

/**
 * 日付を YYYYMMDD 文字列に変換
 */
const formatDate = (d: Date): string =>
  d.toISOString().split("T")[0].replace(/-/g, "");

/**
 * Connpass イベントを 300 件程度取得し、id・title・detail のみを JSON ファイルに保存するスクリプト。
 *
 * 環境変数:
 *   CONNPASS_API_KEY  Connpass API v2 の API キー
 *
 * 実行例:
 *   npx ts-node scripts/fetchConnpassEvents.ts
 */
async function main() {
  const apiKey = process.env.CONNPASS_API_KEY;
  if (!apiKey) {
    console.error(
      "CONNPASS_API_KEY が未設定です (.env などに設定してください)"
    );
    process.exit(1);
  }

  // 日付フィルタを指定しない（全期間対象）
  const stripHtml = (html: string): string =>
    html
      .replace(/<[^>]*>/g, " ") // タグ削除
      .replace(/&[a-z]+;/g, " ") // エンティティ簡易除去
      .replace(/\s+/g, " ")
      .trim();

  const collected: { id: string; title: string; detail: string }[] = [];
  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const SLEEP_MS = 800; // Connpass 公式は連続リクエストを控えるよう推奨しているため
  const pageSize = 40; // Connpass v2 の上限
  let start = 0; // ページ先頭インデックス
  const seenIds = new Set<string>();

  while (collected.length < 300) {
    const resp = await fetchConnpassEventsV2({
      api_key: apiKey,
      order: 3, // 新着順
      count: pageSize,
      start,
    });

    if (resp.events.length === 0) break; // これ以上データなし

    resp.events.forEach((ev) => {
      if (seenIds.has(ev.id.toString())) return; // 重複除外
      seenIds.add(ev.id.toString());
      const detailText = ev.description || ev.catch || "";
      collected.push({
        id: `cp_${ev.id}`,
        title: ev.title,
        detail: detailText,
      });
    });

    start += pageSize;

    // 次ページ取得前に待機してサーバー負荷を軽減
    if (collected.length < 300) {
      await sleep(SLEEP_MS);
    }
  }

  // 重複除去し 300 件に制限
  const unique = collected.slice(0, 300);

  const outPath = path.resolve(
    __dirname,
    "../recommend-fine-turning/events_raw.json"
  );
  await fs.writeFile(outPath, JSON.stringify(unique, null, 2), "utf-8");
  console.log(`Saved ${unique.length} events to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
