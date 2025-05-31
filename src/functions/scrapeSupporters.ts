import puppeteer, { Browser, Page } from "puppeteer";
import prisma from "../config/prisma";
import fs from "fs";
import path from "path";

// 出力ディレクトリの設定
const OUTPUT_DIR = path.join(__dirname, "../../output");

// JSON保存用の設定
const SUPPORTERS_JSON_PATH = path.join(OUTPUT_DIR, "supporters_events.json");

// テスト用の設定を修正
const TEST_MODE = false; // ★★★ デバッグモードを解除 ★★★
const TEST_EVENT_LIMIT = 3; // TEST_MODE = false の場合は使用されない
const INCLUDE_DETAIL_PAGES = true; // 詳細ページも取得する

// サーバー負荷軽減のための待機時間設定（ミリ秒）
const RATE_LIMIT_DELAYS = {
  INITIAL_PAGE_LOAD: { min: 5000, max: 8000 }, // 初期ページロード後: 5-8秒
  BETWEEN_CLICKS: { min: 4000, max: 7000 }, // クリック間: 4-7秒
  AFTER_CLICK: { min: 3000, max: 5000 }, // クリック後: 3-5秒
  PAGE_NAVIGATION: { min: 4000, max: 6000 }, // ページ遷移後: 4-6秒
  DETAIL_PAGE_ACCESS: { min: 8000, max: 12000 }, // 詳細ページアクセス間: 8-12秒
  DETAIL_PAGE_LOAD: { min: 4000, max: 6000 }, // 詳細ページロード後: 4-6秒
};

// イベント情報を格納するインターフェース
export interface SupporterzEventInfo {
  title: string;
  companyName: string;
  organizationId?: string;
  jobType: string;
  eventFormat: string;
  date: string;
  thumbnailUrl: string;
  eventUrl: string; // イベント詳細ページのURL
  description?: string;
  capacity?: string;
  deadline?: string;
  // 詳細ページから取得する追加情報
  detailedDescription?: string;
  requirements?: string;
  benefits?: string;
  schedule?: string;
  // 新たに追加: 詳細ページの包括的な文章内容
  fullPageText?: string; // ページ全体のテキスト
  mainContent?: string; // メインコンテンツのテキスト
  eventDetails?: string; // イベント詳細セクション
  applicationInfo?: string; // 応募情報
  companyInfo?: string; // 会社情報
  additionalInfo?: string; // その他の情報
}

// ランダムな待機時間を生成する関数（ミリ秒）
function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 待機時間設定を使用したsleep関数
function sleepWithDelay(delayConfig: {
  min: number;
  max: number;
}): Promise<void> {
  const delay = getRandomDelay(delayConfig.min, delayConfig.max);
  console.log(`⏱️ ${delay}ms 待機中...`);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// 指定された時間だけ待機する関数
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 詳細ページのHTMLを保存する関数
async function saveDetailPageHtml(
  page: Page,
  eventUrl: string,
  index: number
): Promise<void> {
  try {
    const html = await page.content();
    const outputPath = path.join(
      OUTPUT_DIR,
      `supporters_detail_${index + 1}.html`
    );

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(outputPath, html, "utf-8");
    console.log(`💾 詳細ページのHTMLを保存しました: ${outputPath}`);
  } catch (error) {
    console.error(`❌ HTMLの保存中にエラーが発生しました: ${eventUrl}`, error);
  }
}

// イベント詳細ページから詳細情報を取得する関数
async function scrapeEventDetails(
  page: Page,
  eventUrl: string,
  index: number
): Promise<Partial<SupporterzEventInfo>> {
  const detailData: Partial<SupporterzEventInfo> = {};

  try {
    console.log(`🔍 詳細ページに移動します: ${eventUrl}`);
    await page.goto(eventUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // ページの読み込み完了を待つ（負荷軽減）
    await sleepWithDelay(RATE_LIMIT_DELAYS.DETAIL_PAGE_LOAD);

    // 詳細情報を取得
    const details = await page.evaluate(() => {
      const result: Partial<SupporterzEventInfo> = {};

      // ページ全体のテキストを取得（不要なナビゲーション等を除外）
      const bodyElement = document.body;
      if (bodyElement) {
        // スクリプトタグやスタイルタグを除外してテキストを取得
        const clone = bodyElement.cloneNode(true) as HTMLElement;

        // 不要な要素を削除
        const elementsToRemove = clone.querySelectorAll(
          "script, style, nav, header, footer, .navigation, .breadcrumb, .sidebar"
        );
        elementsToRemove.forEach((el) => el.remove());

        result.fullPageText =
          clone.textContent?.trim().replace(/\s+/g, " ") || "";
      }

      // メインコンテンツエリアを特定して取得
      const mainContentSelectors = [
        "main",
        '[role="main"]',
        ".main-content",
        ".content",
        ".event-detail",
        ".detail-content",
        '[class*="main"]',
        '[class*="content"]',
      ];

      for (const selector of mainContentSelectors) {
        const mainEl = document.querySelector(selector);
        if (mainEl) {
          result.mainContent =
            mainEl.textContent?.trim().replace(/\s+/g, " ") || "";
          break;
        }
      }

      // イベント詳細セクションを取得
      const eventDetailSelectors = [
        '[class*="event-detail"]',
        '[class*="description"]',
        '[class*="detail"]',
        ".event-info",
        ".event-content",
        "section",
        ".content-section",
      ];

      for (const selector of eventDetailSelectors) {
        const detailEl = document.querySelector(selector);
        if (
          detailEl &&
          detailEl.textContent &&
          detailEl.textContent.length > 100
        ) {
          result.eventDetails =
            detailEl.textContent?.trim().replace(/\s+/g, " ") || "";
          break;
        }
      }

      // 応募情報を取得
      const applicationSelectors = [
        '[class*="application"]',
        '[class*="apply"]',
        '[class*="recruitment"]',
        '[class*="job"]',
      ];

      for (const selector of applicationSelectors) {
        const appEl = document.querySelector(selector);
        if (appEl) {
          result.applicationInfo =
            appEl.textContent?.trim().replace(/\s+/g, " ") || "";
          break;
        }
      }

      // 会社情報を取得
      const companySelectors = [
        '[class*="company"]',
        '[class*="organization"]',
        '[class*="corporate"]',
      ];

      for (const selector of companySelectors) {
        const companyEl = document.querySelector(selector);
        if (companyEl) {
          result.companyInfo =
            companyEl.textContent?.trim().replace(/\s+/g, " ") || "";
          break;
        }
      }

      // 既存の詳細情報も取得（後方互換性のため）
      const descriptionEl = document.querySelector(
        '.event-detail-description, .description, [class*="description"]'
      );
      if (descriptionEl) {
        result.detailedDescription =
          descriptionEl.textContent?.trim().replace(/\s+/g, " ") || "";
      }

      // 応募要件を取得
      const requirementsEl = document.querySelector(
        '.requirements, [class*="requirement"]'
      );
      if (requirementsEl) {
        result.requirements =
          requirementsEl.textContent?.trim().replace(/\s+/g, " ") || "";
      }

      // 特典・待遇を取得
      const benefitsEl = document.querySelector(
        '.benefits, [class*="benefit"]'
      );
      if (benefitsEl) {
        result.benefits =
          benefitsEl.textContent?.trim().replace(/\s+/g, " ") || "";
      }

      // スケジュールを取得
      const scheduleEl = document.querySelector(
        '.schedule, [class*="schedule"]'
      );
      if (scheduleEl) {
        result.schedule =
          scheduleEl.textContent?.trim().replace(/\s+/g, " ") || "";
      }

      // 段落要素からテキストを収集（追加情報として）
      const paragraphs = document.querySelectorAll("p");
      const paragraphTexts: string[] = [];
      paragraphs.forEach((p) => {
        const text = p.textContent?.trim();
        if (text && text.length > 20) {
          // 短すぎるテキストは除外
          paragraphTexts.push(text);
        }
      });

      if (paragraphTexts.length > 0) {
        result.additionalInfo = paragraphTexts.join(" ").replace(/\s+/g, " ");
      }

      return result;
    });

    // 取得した詳細情報をマージ
    Object.assign(detailData, details);

    // HTMLを保存
    await saveDetailPageHtml(page, eventUrl, index);

    // 取得した情報の概要をログ出力
    console.log(`✅ 詳細ページからの情報取得が完了しました: ${eventUrl}`);
    if (detailData.fullPageText) {
      console.log(
        `📄 ページ全体テキスト: ${detailData.fullPageText.substring(0, 150)}...`
      );
    }
    if (detailData.mainContent) {
      console.log(
        `📋 メインコンテンツ: ${detailData.mainContent.substring(0, 150)}...`
      );
    }
  } catch (error) {
    console.error(
      `❌ 詳細ページの取得中にエラーが発生しました: ${eventUrl}`,
      error
    );
  }

  return detailData;
}

// クリックイベントをシミュレートして詳細ページのURLを取得
async function getEventDetailUrls(
  page: Page,
  browser: Browser,
  eventCount: number // このeventCountは処理対象の最大件数として利用
): Promise<string[]> {
  const eventUrls: string[] = [];
  const eventListPageUrl = "https://talent.supporterz.jp/events/";

  console.log(`📖 ${eventCount}件のイベント詳細URLを取得します...`);

  try {
    // 初回: イベント一覧ページに移動し、全スクロール
    console.log(`🔄 イベント一覧ページに移動: ${eventListPageUrl}`);
    await page.goto(eventListPageUrl, { waitUntil: "networkidle2" });
    await sleepWithDelay(RATE_LIMIT_DELAYS.INITIAL_PAGE_LOAD);

    console.log("📜 ページ全体を初回スクロールします...");
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 200; // スクロール距離を少し増やす
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 150); // スクロール間隔も調整
      });
    });
    console.log("📜 ページ全体の初回スクロールが完了しました。");
    await sleepWithDelay({ min: 4000, max: 6000 }); // スクロール後のコンテンツ読み込み待機

    const initialEventButtons = await page.$$(
      'button.MuiButtonBase-root[data-gtm-click="events"]'
    );
    console.log(
      `${initialEventButtons.length}個のイベントボタンを初回確認しました（スクロール後）。`
    );

    const targetProcessCount = TEST_MODE
      ? Math.min(initialEventButtons.length, TEST_EVENT_LIMIT)
      : initialEventButtons.length;

    console.log(`🔄 ${targetProcessCount}件のイベントを処理します。`);

    for (let i = 0; i < targetProcessCount; i++) {
      try {
        console.log(
          `🔍 イベント ${i + 1}/${targetProcessCount} の詳細URLを取得中...`
        );

        // ★★★ 変更点: ループの各反復で、一覧ページを再読み込みし、再スクロールする ★★★
        if (i > 0) {
          // 最初のイベント以外の場合
          console.log(`🔄 イベント一覧ページに再移動: ${eventListPageUrl}`);
          await page.goto(eventListPageUrl, { waitUntil: "networkidle2" });
          await sleepWithDelay(RATE_LIMIT_DELAYS.PAGE_NAVIGATION);

          console.log(
            `📜 再度ページ全体をスクロールします... (イベント ${i + 1})`
          );
          await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
              let totalHeight = 0;
              const distance = 200;
              const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                  clearInterval(timer);
                  resolve();
                }
              }, 150);
            });
          });
          console.log(`📜 再スクロール完了 (イベント ${i + 1})`);
          await sleepWithDelay({ min: 4000, max: 6000 });
        }
        // ★★★ 変更点ここまで ★★★

        const eventButtonsOnPage = await page.$$(
          'button.MuiButtonBase-root[data-gtm-click="events"]'
        );

        if (i >= eventButtonsOnPage.length) {
          console.warn(
            `⚠️ イベントボタン ${
              i + 1
            } がページ上で見つかりません。スキップします。(インデックス: ${i}, 発見ボタン数: ${
              eventButtonsOnPage.length
            })`
          );
          eventUrls.push(
            `https://talent.supporterz.jp/events/error_button_not_found_at_index_${
              i + 1
            }`
          );
          continue;
        }
        const buttonToClick = eventButtonsOnPage[i];

        const originalUrl = page.url();
        const navigationPromise = page
          .waitForNavigation({
            waitUntil: "networkidle2",
            timeout: 20000, // タイムアウトを延長
          })
          .catch(() => null);

        await buttonToClick.click();
        await sleepWithDelay(RATE_LIMIT_DELAYS.AFTER_CLICK);

        const currentUrl = page.url();

        if (
          currentUrl !== originalUrl &&
          currentUrl !== eventListPageUrl &&
          !currentUrl.includes("about:blank")
        ) {
          eventUrls.push(currentUrl);
          console.log(`✅ 詳細URL取得成功: ${currentUrl}`);
          // 詳細ページに遷移したので、次のループで一覧ページに戻る
        } else {
          const pages = await browser.pages();
          if (pages.length > 1) {
            const newPage = pages[pages.length - 1];
            const newUrl = newPage.url();
            if (
              newUrl &&
              newUrl !== "about:blank" &&
              newUrl !== eventListPageUrl
            ) {
              eventUrls.push(newUrl);
              console.log(`✅ 詳細URL取得成功（新しいタブ）: ${newUrl}`);
              await newPage.close();
              console.log("📑 新しいタブを閉じました。");
            } else {
              console.warn(
                `⚠️ 新しいタブのURLが無効でした (${newUrl})。スキップします。`
              );
              eventUrls.push(
                `https://talent.supporterz.jp/events/error_new_tab_invalid_url_${
                  i + 1
                }`
              );
              if (newPage && !newPage.isClosed()) await newPage.close();
            }
          } else {
            const fallbackUrl = `https://talent.supporterz.jp/events/error_navigation_failed_${
              i + 1
            }`;
            eventUrls.push(fallbackUrl);
            console.warn(
              `⚠️ ナビゲーションに失敗。フォールバックURL使用: ${fallbackUrl}`
            );
          }
        }

        if (i < targetProcessCount - 1) {
          await sleepWithDelay(RATE_LIMIT_DELAYS.BETWEEN_CLICKS);
        }
      } catch (error: any) {
        console.error(`❌ イベント ${i + 1} の処理中にエラー:`, error.message);
        eventUrls.push(
          `https://talent.supporterz.jp/events/error_processing_event_${i + 1}`
        );
        // エラー発生時も、次のループで一覧ページが再読み込みされる
      }
    }
  } catch (error: any) {
    console.error("❌ イベントURL取得中に致命的なエラー:", error.message);
  }

  console.log(
    `📋 ${eventUrls.length}件の詳細URLを取得しました (試行件数: ${eventCount})`
  );
  return eventUrls;
}

// イベントデータをJSONファイルに保存する関数
async function saveEventsAsJson(events: SupporterzEventInfo[]): Promise<void> {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    fs.writeFileSync(
      SUPPORTERS_JSON_PATH,
      JSON.stringify(events, null, 2),
      "utf-8"
    );
    console.log(
      `💾 イベントデータをJSONファイルに保存しました: ${SUPPORTERS_JSON_PATH}`
    );
  } catch (error) {
    console.error("❌ JSONファイルへの保存中にエラーが発生しました:", error);
  }
}

// ★★★ 追加の保存機能を実装 ★★★

// 個別イベントのfullPageTextをテキストファイルとして保存する関数
async function saveEventFullPageText(
  event: SupporterzEventInfo,
  index: number
): Promise<void> {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const filename = `supporters_full_page_text_${index + 1}.txt`;
    const filepath = path.join(OUTPUT_DIR, filename);

    const content = `=== イベント詳細情報 ===
タイトル: ${event.title}
会社名: ${event.companyName}
開催形式: ${event.eventFormat}
日程: ${event.date}
URL: ${event.eventUrl}
=========================

${event.fullPageText || "(fullPageText が空です)"}`;

    fs.writeFileSync(filepath, content, "utf-8");
    console.log(`💾 フルページテキストを保存しました: ${filepath}`);
  } catch (error) {
    console.error(
      `❌ フルページテキストの保存中にエラーが発生しました (インデックス: ${index}):`,
      error
    );
  }
}

// スクレイピング概要情報を保存する関数
async function saveScrapeingSummary(summary: {
  totalEvents: number;
  successfulEvents: number;
  errorEvents: number;
  startTime: number;
  endTime: number;
  testMode: boolean;
  includeDetailPages: boolean;
  errors?: string[];
}): Promise<void> {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const summaryPath = path.join(
      OUTPUT_DIR,
      "supporters_scraping_summary.json"
    );
    const executionTime = Math.round(
      (summary.endTime - summary.startTime) / 1000
    );

    const summaryData = {
      ...summary,
      executionTimeSeconds: executionTime,
      timestamp: new Date().toISOString(),
      successRate:
        summary.totalEvents > 0
          ? ((summary.successfulEvents / summary.totalEvents) * 100).toFixed(
              2
            ) + "%"
          : "0%",
    };

    fs.writeFileSync(
      summaryPath,
      JSON.stringify(summaryData, null, 2),
      "utf-8"
    );
    console.log(`💾 スクレイピング概要を保存しました: ${summaryPath}`);
  } catch (error) {
    console.error(
      "❌ スクレイピング概要の保存中にエラーが発生しました:",
      error
    );
  }
}

// 全データを統合して保存する関数
async function saveAllScrapedData(
  eventsData: Partial<SupporterzEventInfo>[],
  summary: any
): Promise<void> {
  try {
    // 1. メインのJSONファイル保存
    await saveEventsAsJson(eventsData as SupporterzEventInfo[]);

    // 2. 個別のfullPageTextファイル保存
    console.log("📄 個別テキストファイルを保存中...");
    for (let i = 0; i < eventsData.length; i++) {
      if (
        eventsData[i].fullPageText &&
        eventsData[i].fullPageText!.trim().length > 0
      ) {
        await saveEventFullPageText(eventsData[i] as SupporterzEventInfo, i);
      }
    }

    // 3. スクレイピング概要の保存
    await saveScrapeingSummary(summary);

    // 4. 統合データファイルの保存
    const integratedData = {
      summary,
      events: eventsData,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalEvents: eventsData.length,
        eventsWithFullText: eventsData.filter(
          (e) => e.fullPageText && e.fullPageText.trim().length > 0
        ).length,
      },
    };

    const integratedPath = path.join(
      OUTPUT_DIR,
      "supporters_integrated_data.json"
    );
    fs.writeFileSync(
      integratedPath,
      JSON.stringify(integratedData, null, 2),
      "utf-8"
    );
    console.log(`💾 統合データファイルを保存しました: ${integratedPath}`);
  } catch (error) {
    console.error("❌ データ保存処理中にエラーが発生しました:", error);
  }
}

export async function scrapeSupportersEvents(): Promise<SupporterzEventInfo[]> {
  const startTime = Date.now();
  let scrapeErrors: string[] = [];

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // ユーザーエージェントを設定
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // ページサイズを設定（クリック精度向上のため）
    await page.setViewport({ width: 1280, height: 720 });

    const url = "https://talent.supporterz.jp/events/";

    console.log("🚀 サポーターズイベントページにアクセス中...");
    console.log("⏱️ サーバー負荷軽減のため、適切な待機時間を設定しています");

    if (TEST_MODE) {
      console.log(`🧪 テストモード: 先頭${TEST_EVENT_LIMIT}件のみ処理します`);
      if (INCLUDE_DETAIL_PAGES) {
        console.log("📖 詳細ページも取得します");
      }
    }

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // 初期ページロード後の待機（負荷軽減）
    await sleepWithDelay(RATE_LIMIT_DELAYS.INITIAL_PAGE_LOAD);

    // ★★★ 手順1: イベントの基本情報を取得 ★★★
    console.log("📋 イベント基本情報を取得中...");
    const eventsData = await page.evaluate(
      (testLimit) => {
        const eventCards = document.querySelectorAll<HTMLElement>(
          'button.MuiButtonBase-root[data-gtm-click="events"]'
        );
        console.log(`Found ${eventCards.length} event cards`);
        const extractedEvents: Partial<SupporterzEventInfo>[] = [];

        const limit = testLimit || eventCards.length;
        console.log(`Processing first ${limit} events`);

        eventCards.forEach((card, index) => {
          if (index >= limit) return;

          const titleEl = card.querySelector<HTMLElement>(
            'p[class*="title"][class*="event-list-card-hover"]'
          );

          const titleElementForCompanyContext = card.querySelector<HTMLElement>(
            'p[class*="title"][class*="event-list-card-hover"]'
          );
          const companyEl =
            titleElementForCompanyContext?.parentElement?.querySelector<HTMLElement>(
              'p[class*="v4-legacy460"]'
            );

          const jobTypeEl = card.querySelector<HTMLElement>(
            'div[class*="MuiChip-root"] span[class*="MuiChip-label"]'
          );

          const eventFormatEl = card.querySelector<HTMLElement>(
            'div[class*="v4-legacy495"] p[class*="v4-legacy497"]'
          );

          const dateEl = card.querySelector<HTMLElement>(
            'div[class*="v4-legacy495"] p[class*="v4-legacy499"]'
          );

          // サムネイル取得
          const thumbnailContainer = card.querySelector<HTMLElement>(
            'div[class*="img"][class*="event-list-card-hover"]'
          );
          let thumbnailUrl = "";
          if (thumbnailContainer) {
            const thumbnailStyleEl =
              thumbnailContainer.querySelector<HTMLElement>("div:first-child");
            if (thumbnailStyleEl) {
              const style = window.getComputedStyle(thumbnailStyleEl);
              const bgImage = style.getPropertyValue("background-image");
              if (bgImage && bgImage !== "none") {
                const urlMatch = bgImage.match(/url\("(.+?)"\)/);
                if (urlMatch && urlMatch[1]) {
                  thumbnailUrl = urlMatch[1];
                }
              }
            }
          }

          let eventUrl = "";
          // Attempt 1: Check if the button itself has a href (unlikely for <button>)
          // or a common data attribute for URLs
          if (card.hasAttribute("href")) {
            eventUrl = card.getAttribute("href") || "";
          } else if (card.dataset.href) {
            eventUrl = card.dataset.href;
          } else if (card.dataset.url) {
            eventUrl = card.dataset.url;
          }

          // Attempt 2: Look for an <a> tag inside the card
          const linkEl = card.querySelector<HTMLAnchorElement>("a");
          if (linkEl && linkEl.href) {
            eventUrl = linkEl.href;
          }

          // Attempt 3: Check data-gtm-props for a URL
          // This is a common pattern for GTM click tracking
          const gtmPropsString = card.dataset.gtmProps;
          if (gtmPropsString) {
            try {
              const gtmProps = JSON.parse(gtmPropsString);
              if (gtmProps && typeof gtmProps.url === "string") {
                eventUrl = gtmProps.url;
              } else if (gtmProps && typeof gtmProps.event_url === "string") {
                eventUrl = gtmProps.event_url;
              }
            } catch (e) {
              console.error(
                "Failed to parse data-gtm-props",
                gtmPropsString,
                e
              );
            }
          }

          // If the card is a button that navigates, the URL might not be directly in an attribute
          // but handled by JavaScript. Puppeteer's .click() handles this.
          // For now, we need to extract it if possible.
          // It's possible the URL is part of the `data-gtm-click-data` or similar attribute
          // or constructed based on an ID.

          // If no URL found directly, try to get it from the `data-gtm-click` attribute
          // if it contains a full URL or part of it.
          // This is a fallback and might need adjustment based on actual data.
          const gtmClickValue = card.getAttribute("data-gtm-click");
          if (!eventUrl && gtmClickValue && gtmClickValue.startsWith("http")) {
            // This is a guess, might not be the actual detail URL
            // eventUrl = gtmClickValue;
          } else if (!eventUrl && card.getAttribute("onclick")) {
            // If there's an onclick, it might contain a window.location change
            const onclickAttr = card.getAttribute("onclick");
            if (onclickAttr) {
              const urlMatch = onclickAttr.match(
                /window\.location\.href='([^']+)'/
              );
              if (urlMatch && urlMatch[1]) {
                eventUrl = urlMatch[1];
              }
            }
          }

          // Check if the button's gtm-label or similar contains an ID that can form a URL
          // Example: if data-gtm-label="event-ID-12345"
          const eventIdMatch = card.outerHTML.match(/events\/([a-f0-9-]+)\//);
          if (!eventUrl && eventIdMatch && eventIdMatch[1]) {
            eventUrl = `https://talent.supporterz.jp/events/${eventIdMatch[1]}/`;
          }

          if (titleEl && companyEl && jobTypeEl && eventFormatEl && dateEl) {
            extractedEvents.push({
              title: titleEl.textContent?.trim() || "No Title",
              companyName: companyEl.textContent?.trim() || "No Company",
              jobType: jobTypeEl.textContent?.trim() || "No Job Type",
              eventFormat:
                eventFormatEl.textContent?.trim() || "No Event Format",
              date: dateEl.textContent?.trim() || "No Date",
              thumbnailUrl,
              eventUrl: eventUrl,
            });
          }
        });

        return extractedEvents;
      },
      TEST_MODE ? TEST_EVENT_LIMIT : undefined
    );

    console.log(`✅ ${eventsData.length}件の基本情報を取得しました`);

    // ★★★ 手順2: 詳細ページURLを取得 ★★★
    if (INCLUDE_DETAIL_PAGES && eventsData.length > 0) {
      console.log("📖 詳細ページのURLを取得します...");
      const eventDetailUrls = await getEventDetailUrls(
        page,
        browser,
        TEST_MODE ? TEST_EVENT_LIMIT : eventsData.length
      );

      // URLをeventsDataに設定
      for (
        let i = 0;
        i < Math.min(eventDetailUrls.length, eventsData.length);
        i++
      ) {
        eventsData[i].eventUrl = eventDetailUrls[i];
      }

      // ★★★ 手順3: 詳細ページをスクレイピング（最重要） ★★★
      console.log("📖 詳細ページの情報を取得します...");
      let detailPage: Page | null = null;

      for (let i = 0; i < eventsData.length; i++) {
        const url = eventsData[i].eventUrl;
        if (
          !url ||
          url.trim() === "" ||
          url.includes("error_") ||
          url.includes("fallback_")
        ) {
          console.warn(
            `[詳細取得スキップ] イベント「${eventsData[i]?.title}」の eventUrl が無効です。`
          );
          scrapeErrors.push(
            `Event ${i + 1}: Invalid eventUrl for "${eventsData[i]?.title}"`
          );
          continue;
        }

        console.log(
          ` (${i + 1}/${eventsData.length}) 詳細ページ処理中: ${url}`
        );
        try {
          if (!detailPage || detailPage.isClosed()) {
            detailPage = await browser.newPage();
            await detailPage.setUserAgent(
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            );
            await detailPage.setViewport({ width: 1280, height: 720 });
          }

          const detailInfo = await scrapeEventDetails(detailPage, url, i);
          Object.assign(eventsData[i], detailInfo);

          // ★★★ 取得した fullPageText を出力 ★★★
          console.log(`--- Full Page Text for "${eventsData[i].title}" ---`);
          console.log(
            eventsData[i].fullPageText || "(fullPageText not found or empty)"
          );
          console.log(`--- End of Full Page Text ---`);

          // 負荷軽減のため待機
          if (i < eventsData.length - 1) {
            await sleepWithDelay(RATE_LIMIT_DELAYS.DETAIL_PAGE_ACCESS);
          }
        } catch (e: any) {
          console.error(`❌ 詳細情報取得エラー (${url}): ${e.message}`);
          scrapeErrors.push(
            `Event ${i + 1}: Failed to scrape details from ${url} - ${
              e.message
            }`
          );
        }
      }

      if (detailPage && !detailPage.isClosed()) {
        await detailPage.close();
      }
    }

    // ★★★ 手順4: 会社情報をDBに登録 ★★★
    const companyNames = Array.from(
      new Set(eventsData.map((event) => event.companyName))
    );
    console.log("Company Names:");
    console.log(companyNames);

    for (const companyName of companyNames) {
      const currentCompanyName = companyName || "Unknown Company";
      await prisma.organization.upsert({
        where: { name: currentCompanyName },
        create: { name: currentCompanyName },
        update: {},
      });
    }
    console.log("✅ 会社名の登録を完了しました");

    // eventsDataに該当する組織を追加する
    const organizations = await prisma.organization.findMany();
    for (const event of eventsData) {
      const organization = organizations.find(
        (org) => org.name === event.companyName
      );
      if (organization) {
        event.organizationId = organization.id;
      }
    }

    // event.dateをフォーマットする
    for (const event of eventsData) {
      try {
        if (typeof event.date === "string") {
          const originalDateString = event.date;
          const parts = originalDateString.split(/,|~/);
          let dateStrToParse = parts[parts.length - 1].trim();
          dateStrToParse = dateStrToParse.replace(/\s*\(.\)$/, "");

          const match = dateStrToParse.match(/(\d+)月(\d+)日/);
          if (match) {
            const month = parseInt(match[1], 10);
            const day = parseInt(match[2], 10);
            const currentYear = new Date().getFullYear();
            const jsMonth = month - 1;
            const formattedDate = new Date(currentYear, jsMonth, day);
            event.date = formattedDate.toISOString();
          } else {
            console.warn(
              `[日付フォーマット警告] イベント「${event.title}」の日付形式が予期したパターンと一致しません。`
            );
          }
        } else {
          console.warn(
            `[日付未定義警告] イベント「${event.title}」に日付情報がありません。`
          );
        }
      } catch (error) {
        console.error(`❌ 日付フォーマットエラー (${event.title}):`, error);
      }
    }

    // ★★★ 手順5: イベントをDBに保存 ★★★
    const existingDbEvents = await prisma.event.findMany({
      include: {
        Organization: true,
        EventSkill: true,
        EventSpeaker: { include: { Speaker: true } },
        EventCategory: { include: { Category: true } },
      },
      orderBy: { eventDate: "asc" },
    });

    for (const event of eventsData) {
      const existingEvent = existingDbEvents.find(
        (e) => e.title === (event.title || "")
      );
      if (!existingEvent) {
        if (
          typeof event.organizationId === "string" &&
          event.organizationId.length > 0 &&
          typeof event.date === "string"
        ) {
          const eventDateObj = new Date(event.date);
          const startTimeValue = !isNaN(eventDateObj.getTime())
            ? eventDateObj.toISOString()
            : new Date(0).toISOString();

          const descriptionToSave = event.fullPageText || "";
          const detailUrlToSave =
            event.eventUrl ||
            `https://talent.supporterz.jp/events/detail_not_found_${
              event.title || "unknown"
            }`;

          console.log(`[DB保存処理] イベント: "${event.title}"`);
          console.log(
            `  -> Full Page Text Length: ${descriptionToSave.length}`
          );

          await prisma.event.create({
            data: {
              title: event.title || "No Title Provided",
              description: descriptionToSave,
              eventDate: event.date,
              startTime: startTimeValue,
              venue: event.eventFormat,
              organizationId: event.organizationId,
              image: event.thumbnailUrl,
              format: event.eventFormat === "オンライン" ? "ONLINE" : "OFFLINE",
              difficulty: "FOR_EVERYONE",
              price: 0,
              detailUrl: detailUrlToSave,
            },
          });
        }
      }
    }

    // ★★★ 手順6: ファイル保存処理 ★★★
    const endTime = Date.now();
    const summary = {
      totalEvents: eventsData.length,
      successfulEvents: eventsData.filter(
        (e) => e.fullPageText && e.fullPageText.trim().length > 0
      ).length,
      errorEvents: scrapeErrors.length,
      startTime,
      endTime,
      testMode: TEST_MODE,
      includeDetailPages: INCLUDE_DETAIL_PAGES,
      errors: scrapeErrors,
    };

    console.log("💾 データ保存処理を開始します...");
    await saveAllScrapedData(eventsData as SupporterzEventInfo[], summary);

    console.log("--- All Scraped Events Data (JSON) ---");
    console.log(JSON.stringify(eventsData, null, 2));
    console.log("----------------------------------------");

    return eventsData as SupporterzEventInfo[];
  } catch (error) {
    console.error("❌ スクレイピング中にエラーが発生しました:", error);
    return [];
  } finally {
    await browser.close();
  }
}

// スクリプトとして直接実行された場合の処理を更新
if (require.main === module) {
  (async () => {
    console.log("🚀 サポーターズのスクレイピングを開始します...");
    const startTime = Date.now();

    const events = await scrapeSupportersEvents();

    const endTime = Date.now();
    const totalTime = Math.round((endTime - startTime) / 1000);

    if (events.length > 0) {
      console.log(`✅ 正常に${events.length}件のイベントを取得しました。`);
      console.log(`💾 JSONファイルへの保存も完了しました。`);
      console.log(`⏱️ 実行時間: ${totalTime}秒`);
      if (TEST_MODE) {
        console.log("\n🧪 テストモード実行完了");
        if (INCLUDE_DETAIL_PAGES) {
          console.log("📖 詳細ページの取得も含まれています");
        }
      }
    } else {
      console.log("❌ イベントが取得されませんでした。");
    }
  })();
}
