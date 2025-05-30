import puppeteer, { Browser, Page } from "puppeteer";
import fs from "fs";
import path from "path";
import prisma from "../config/prisma";
import { EventFormat, DifficultyLevel, EventType } from "@prisma/client";

const TECHPLAY_BASE_URL =
  "https://techplay.jp/event/search?sort=started_at.asc&page=";
const MAX_PAGES = 10;
const OUTPUT_DIR = path.join(__dirname, "../../output");
const COMBINED_OUTPUT_FILE_PATH = path.join(
  OUTPUT_DIR,
  "techplay_all_pages.html"
);
const EVENTS_JSON_PATH = path.join(OUTPUT_DIR, "techplay_events.json");
// サーバー負荷軽減のための待機時間（ミリ秒）
const RATE_LIMIT_DELAY = {
  BETWEEN_PAGES: 8000, // ページ間の待機時間（8秒）
  BETWEEN_EVENTS: 3000, // イベント詳細取得間の待機時間（3秒）
  AFTER_PAGE_LOAD: 2000, // ページロード後の待機時間（2秒）
};

interface TechPlayEvent {
  title: string | null;
  eventUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  venue: string | null; // Raw venue text or 'Online'
  format: "ONLINE" | "OFFLINE" | "UNKNOWN"; // Derived from venue
  tags: string[];
  platform: string | null; // e.g., 'connpass', 'techplay'
  thumbnailUrl: string | null; // Added for event thumbnail
  description: string | null; // イベント詳細説明
  capacity: number | null; // 定員
  participantCount: number | null; // 参加者数
  fee: string | null; // 参加費
  organizer: string | null; // 主催者
  detailedVenue: string | null; // 詳細な会場情報
  registrationUrl: string | null; // 申し込みURL
  contactInfo: string | null; // 連絡先情報
  dateTime: {
    start: string;
    end: string;
  };
  participation: {
    category: string;
    type: string;
    price: string;
    capacity: {
      current: number;
      max: number;
    };
  }[];
  details: {
    overview: string;
    schedule: {
      time: string;
      content: string;
    }[];
    target: string;
    speakers: {
      name: string;
      role: string;
      profile: string;
    }[];
    organizer: {
      name: string;
      description: string;
    };
  };
}

// ユーティリティ関数の追加
function parseDateTime(dateTimeText: string) {
  const result = {
    start: "",
    end: "",
  };

  try {
    const matches = dateTimeText.match(
      /(\d{4}\/\d{2}\/\d{2})\(.\)(\d{2}:\d{2})(?:～(\d{2}:\d{2}))?/
    );
    if (matches) {
      const [_, date, startTime, endTime] = matches;
      result.start = `${date} ${startTime}`;
      result.end = endTime ? `${date} ${endTime}` : result.start;
    }
  } catch (error) {
    console.error("日時のパース中にエラーが発生しました:", error);
  }

  return result;
}

function parseParticipationTable(selector: string) {
  const table = document.querySelector(selector);
  if (!table) return [];

  return Array.from(table.querySelectorAll("tbody tr")).map((row) => {
    const cells = row.querySelectorAll("td");
    const capacityText = cells[3]?.textContent || "";
    const [current, max] = capacityText
      .match(/(\d+)人\s*／\s*定員(\d+)人/)
      ?.slice(1) || [0, 0];

    return {
      category:
        cells[0]?.querySelector(".category-inner div")?.textContent?.trim() ||
        "",
      type: cells[1]?.textContent?.trim() || "",
      price: cells[2]?.textContent?.trim() || "",
      capacity: {
        current: parseInt(String(current)) || 0,
        max: parseInt(String(max)) || 0,
      },
    };
  });
}

function parseScheduleTable(selector: string) {
  const table = document.querySelector(selector);
  if (!table) return [];

  return Array.from(table.querySelectorAll("tbody tr")).map((row) => {
    const cells = row.querySelectorAll("td");
    return {
      time: cells[0]?.textContent?.trim() || "",
      content: cells[1]?.textContent?.trim() || "",
    };
  });
}

function parseSpeaker(speakerElement: Element) {
  return {
    name: speakerElement.querySelector(".name")?.textContent?.trim() || "",
    role: speakerElement.querySelector(".belongs")?.textContent?.trim() || "",
    profile:
      speakerElement.querySelector(".description")?.textContent?.trim() || "",
  };
}

async function scrapeEventDetails(
  page: Page,
  eventUrl: string
): Promise<Partial<TechPlayEvent>> {
  const detailData: Partial<TechPlayEvent> = {};

  try {
    console.log(`詳細ページに移動します: ${eventUrl}`);
    await page.goto(eventUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await page.waitForSelector(".eventDetail-heading");

    // ページの読み込み完了を待つ
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_DELAY.AFTER_PAGE_LOAD)
    );

    const details = await page.evaluate(() => {
      // BEGIN: Functions to be moved into page.evaluate context

      function parseDateTime(dateTimeText: string) {
        const result = {
          start: "",
          end: "",
        };

        try {
          const matches = dateTimeText.match(
            /(\d{4}\/\d{2}\/\d{2})\(.\)(\d{2}:\d{2})(?:～(\d{2}:\d{2}))?/
          );
          if (matches) {
            const [_, date, startTime, endTime] = matches;
            result.start = `${date} ${startTime}`;
            result.end = endTime ? `${date} ${endTime}` : result.start;
          }
        } catch (error) {
          // console.error はブラウザのコンソールに出力される
          console.error("日時のパース中にエラーが発生しました:", error);
        }

        return result;
      }

      function parseParticipationTable(selector: string) {
        const table = document.querySelector(selector);
        if (!table) return [];

        return Array.from(table.querySelectorAll("tbody tr")).map((row) => {
          const cells = row.querySelectorAll("td");
          const capacityText = cells[3]?.textContent || "";
          const [current, max] = capacityText
            .match(/(\d+)人\s*／\s*定員(\d+)人/)
            ?.slice(1) || [0, 0];

          return {
            category:
              cells[0]
                ?.querySelector(".category-inner div")
                ?.textContent?.trim() || "",
            type: cells[1]?.textContent?.trim() || "",
            price: cells[2]?.textContent?.trim() || "",
            capacity: {
              current: parseInt(String(current)) || 0,
              max: parseInt(String(max)) || 0,
            },
          };
        });
      }

      function parseScheduleTable(selector: string) {
        const table = document.querySelector(selector);
        if (!table) return [];

        return Array.from(table.querySelectorAll("tbody tr")).map((row) => {
          const cells = row.querySelectorAll("td");
          return {
            time: cells[0]?.textContent?.trim() || "",
            content: cells[1]?.textContent?.trim() || "",
          };
        });
      }

      function parseSpeaker(speakerElement: Element) {
        // Element型をanyに変更するか、必要なプロパティを明示的に型付けする
        // ここでは 간단하게 any を使用しますが、より厳密な型定義が望ましいです。
        const anySpeakerElement = speakerElement as any;
        return {
          name:
            anySpeakerElement.querySelector(".name")?.textContent?.trim() || "",
          role:
            anySpeakerElement.querySelector(".belongs")?.textContent?.trim() ||
            "",
          profile:
            anySpeakerElement
              .querySelector(".description")
              ?.textContent?.trim() || "",
        };
      }

      const getTextAfterH2 = (
        searchText: string,
        nextElementCount = 1
      ): string | null => {
        const h2Elements = Array.from(
          document.querySelectorAll<HTMLHeadingElement>("section#edited h2")
        );
        const targetH2 = h2Elements.find(
          (h2) => h2.textContent?.trim() === searchText
        );
        if (targetH2) {
          let currentElement: Element | null = targetH2;
          for (let i = 0; i < nextElementCount; i++) {
            currentElement = currentElement?.nextElementSibling || null;
            if (!currentElement || currentElement.tagName !== "P") {
              return null;
            }
          }
          return currentElement?.textContent?.trim() || null;
        }
        return null;
      };

      // END: Functions to be moved into page.evaluate context

      const result: Partial<TechPlayEvent> = {
        title:
          document.querySelector(".eventDetail-heading")?.textContent?.trim() ||
          null,
        dateTime: parseDateTime(
          document.querySelector(".fs13.cGY-3")?.textContent || ""
        ),
        tags: Array.from(document.querySelectorAll(".tags-item")).map(
          (tag) => tag.textContent?.trim() || ""
        ),
        participation: parseParticipationTable("#participationTable"),
        details: {
          overview:
            document
              .querySelector("section#edited h2:first-of-type + p")
              ?.textContent?.trim() || "",
          schedule: parseScheduleTable("table.table"),
          target: getTextAfterH2("参加対象") || "",
          speakers: Array.from(document.querySelectorAll(".speaker-list")).map(
            (el) => parseSpeaker(el)
          ),
          organizer: {
            name: "TECH PLAY",
            description: "",
          },
        },
      };

      // その他の情報を取得
      result.description =
        document.querySelector("section#edited")?.textContent?.trim() || null;
      result.thumbnailUrl =
        document.querySelector(".eventDetail-thumbnail")?.getAttribute("src") ||
        null;

      // 参加情報から定員と参加者数を抽出
      const participationInfo = result.participation?.[0];
      if (participationInfo) {
        result.capacity = participationInfo.capacity.max;
        result.participantCount = participationInfo.capacity.current;
        result.fee = participationInfo.price;
      }

      return result;
    });

    // 取得した詳細情報をマージ
    Object.assign(detailData, details);

    // HTMLの保存
    await saveDetailPageHtml(page, eventUrl, 1);

    console.log(`詳細ページからの情報取得が完了しました: ${eventUrl}`);
  } catch (error) {
    console.error(
      `詳細ページの取得中にエラーが発生しました: ${eventUrl}`,
      error
    );
  }

  return detailData;
}

async function saveDetailPageHtml(
  page: Page,
  eventUrl: string,
  index: number
): Promise<void> {
  try {
    await page.goto(eventUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const html = await page.content();
    const outputPath = path.join(
      OUTPUT_DIR,
      `techplay_detail_${index + 1}.html`
    );

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(outputPath, html, "utf-8");
    console.log(`詳細ページのHTMLを保存しました: ${outputPath}`);
  } catch (error) {
    console.error(`HTMLの保存中にエラーが発生しました: ${eventUrl}`, error);
  }
}

async function saveEventsAsJson(events: Partial<TechPlayEvent>[]) {
  try {
    // 出力ディレクトリが存在しない場合は作成
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // JSONとして保存（整形して読みやすく）
    fs.writeFileSync(EVENTS_JSON_PATH, JSON.stringify(events, null, 2));
    console.log(`イベントデータをJSONとして保存しました: ${EVENTS_JSON_PATH}`);
  } catch (error) {
    console.error("JSONファイルの保存中にエラーが発生しました:", error);
  }
}

async function saveTechPlayEventsToDatabase(
  events: TechPlayEvent[]
): Promise<void> {
  console.log(`データベースに${events.length}件のイベントを保存します...`);

  try {
    // 既存のorganization IDを使用
    const organizationId = "cmbab0a840000rywyp91u1e9e";

    let savedCount = 0;
    let errorCount = 0;

    for (const event of events) {
      try {
        // 必須フィールドの検証
        if (!event.title || !event.eventUrl) {
          console.warn(
            "必須フィールドが不足しているイベントをスキップ:",
            event.title
          );
          errorCount++;
          continue;
        }

        // 開催日の解析
        let eventDate: Date;
        try {
          if (event.dateTime?.start) {
            eventDate = new Date(event.dateTime.start);
          } else if (event.startDate) {
            eventDate = new Date(event.startDate);
          } else {
            console.warn("開催日が不明なイベントをスキップ:", event.title);
            errorCount++;
            continue;
          }
        } catch (dateError) {
          console.warn("開催日の解析に失敗:", event.title, dateError);
          errorCount++;
          continue;
        }

        // イベント形式の決定
        let format: EventFormat = EventFormat.OFFLINE;
        if (
          event.format === "ONLINE" ||
          event.venue?.toLowerCase().includes("online")
        ) {
          format = EventFormat.ONLINE;
        }

        // 開始時間の設定（ISO形式）
        const startTime = event.dateTime?.start
          ? new Date(event.dateTime.start).toISOString()
          : null;

        // 参加費は0に固定
        let price = 0;

        // イベントの重複チェック (URLで判定)
        const existingEvent = await prisma.event.findFirst({
          where: { detailUrl: event.eventUrl },
        });

        if (existingEvent) {
          console.log(`既存のイベントをスキップ: ${event.title}`);
          continue;
        }

        // イベントをデータベースに保存
        const savedEvent = await prisma.event.create({
          data: {
            title: event.title,
            description: event.description || event.details?.overview || "",
            eventDate: eventDate,
            startTime: startTime,
            venue: event.venue || event.detailedVenue || "未定",
            address: null,
            location: event.venue || "未定",
            detailUrl: event.eventUrl,
            organizationId: organizationId,
            image: event.thumbnailUrl || null,
            format: format,
            difficulty: DifficultyLevel.FOR_EVERYONE,
            price: price, // 常に0
            eventType: EventType.WORKSHOP,
          },
        });

        savedCount++;
        console.log(`保存完了: ${savedEvent.title} (ID: ${savedEvent.id})`);
      } catch (eventError) {
        console.error(`イベント保存エラー (${event.title}):`, eventError);
        errorCount++;
      }
    }

    console.log(
      `データベース保存完了: ${savedCount}件成功, ${errorCount}件エラー`
    );
  } catch (error) {
    console.error("データベース保存処理でエラーが発生しました:", error);
    throw error;
  }
}

async function scrapeTechPlayAndExtractData(): Promise<TechPlayEvent[]> {
  let browser: Browser | null = null;
  const allEventsData: TechPlayEvent[] = [];

  try {
    console.log("Puppeteerを起動します...");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // 複数ページを処理するループを追加
    for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
      console.log(`ページ ${pageNum}/${MAX_PAGES} を処理中...`);

      const currentPageUrl = `${TECHPLAY_BASE_URL}${pageNum}`;
      console.log(`TechPlayのURLに移動します: ${currentPageUrl}`);

      try {
        await page.goto(currentPageUrl, {
          waitUntil: "networkidle2",
          timeout: 60000,
        });

        console.log(`ページ ${pageNum} のイベントデータを抽出します...`);
        const eventCards = await page.evaluate(() => {
          const cards =
            document.querySelectorAll<HTMLElement>("div.eventlist-card");
          return Array.from(cards) // .slice(0, 3) を削除してすべてのイベントを取得
            .map((card) => {
              // 場所情報を取得（地図アイコンの後のspanタグ）
              const locationElement = card.querySelector(
                ".eventlist-card-area span"
              );
              const venue = locationElement?.textContent?.trim() || null;

              return {
                title:
                  card
                    .querySelector("h3.eventlist-card-title a")
                    ?.textContent?.trim() || null,
                eventUrl:
                  card
                    .querySelector("h3.eventlist-card-title a")
                    ?.getAttribute("href") || null,
                venue: venue, // 場所情報を追加（「東京都」「オンライン」など）
                organizer: "TECH PLAY", // 統一した主催者名
              };
            });
        });

        console.log(
          `ページ ${pageNum} で ${eventCards.length} 件のイベントを取得しました`
        );

        // 各イベントの詳細情報を取得
        for (let i = 0; i < eventCards.length; i++) {
          const cardData = eventCards[i];
          if (cardData.eventUrl) {
            console.log(
              `詳細取得中: ${i + 1}/${eventCards.length} - ${cardData.title}`
            );

            // レート制限のための待機（最初のイベント以外）
            if (i > 0) {
              console.log(`${RATE_LIMIT_DELAY.BETWEEN_EVENTS}ms 待機中...`);
              await new Promise((resolve) =>
                setTimeout(resolve, RATE_LIMIT_DELAY.BETWEEN_EVENTS)
              );
            }

            const detailData = await scrapeEventDetails(
              page,
              cardData.eventUrl
            );

            // TechPlayEvent オブジェクトを構築
            const fullEvent: TechPlayEvent = {
              title: cardData.title,
              eventUrl: cardData.eventUrl,
              startDate: null,
              endDate: null,
              venue: cardData.venue,
              format: "UNKNOWN",
              tags: [],
              platform: "TechPlay",
              thumbnailUrl: null,
              description: null,
              capacity: null,
              participantCount: null,
              fee: null,
              organizer: "TECH PLAY",
              detailedVenue: null,
              registrationUrl: null,
              contactInfo: null,
              dateTime: { start: "", end: "" },
              participation: [],
              details: {
                overview: "",
                schedule: [],
                target: "",
                speakers: [],
                organizer: { name: "TECH PLAY", description: "" },
              },
              ...detailData, // scrapeEventDetails から取得した部分的な情報で上書き
            };

            // 主催者名を強制的に TECH PLAY に設定
            fullEvent.organizer = "TECH PLAY";
            fullEvent.details.organizer.name = "TECH PLAY";

            allEventsData.push(fullEvent);
          }
        }

        console.log(
          `ページ ${pageNum} の処理完了。累計: ${allEventsData.length} 件`
        );

        // ページ間の待機時間
        if (pageNum < MAX_PAGES) {
          console.log(
            `次のページまで ${RATE_LIMIT_DELAY.BETWEEN_PAGES}ms 待機中...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, RATE_LIMIT_DELAY.BETWEEN_PAGES)
          );
        }
      } catch (error) {
        console.error(
          `ページ ${pageNum} の処理中にエラーが発生しました:`,
          error
        );
        // エラーが発生してもページ処理を続行
        continue;
      }
    }

    console.log(
      `全 ${MAX_PAGES} ページの処理完了。合計 ${allEventsData.length} 件のイベントを取得しました`
    );

    // JSONファイルに保存
    await saveEventsAsJson(allEventsData);

    // データベースに保存
    await saveTechPlayEventsToDatabase(allEventsData);

    return allEventsData;
  } catch (error) {
    console.error("スクレイピング処理でエラーが発生しました:", error);
    throw error;
  } finally {
    if (browser) {
      console.log("ブラウザを閉じます...");
      await browser.close();
    }
  }
}

// データベース保存結果の確認
async function verifyDatabaseSave(): Promise<void> {
  try {
    const techPlayOrg = await prisma.organization.findFirst({
      where: { name: "TECH PLAY" },
    });

    if (techPlayOrg) {
      const eventCount = await prisma.event.count({
        where: { organizationId: techPlayOrg.id },
      });

      console.log(`TECH PLAYのイベント数: ${eventCount}件`);

      // 最新の5件を表示
      const recentEvents = await prisma.event.findMany({
        where: { organizationId: techPlayOrg.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          eventDate: true,
          format: true,
          price: true,
        },
      });

      console.log("最新保存イベント:");
      recentEvents.forEach((event, index) => {
        console.log(`${index + 1}. ${event.title}`);
        console.log(
          `   開催日: ${event.eventDate.toLocaleDateString("ja-JP")}`
        );
        console.log(`   形式: ${event.format}, 価格: ${event.price}円`);
      });
    }
  } catch (error) {
    console.error("データベース確認エラー:", error);
  }
}

if (require.main === module) {
  scrapeTechPlayAndExtractData()
    .then(async (data) => {
      console.log(`処理完了: ${data.length} 件のイベントを処理しました`);
      if (data.length > 0) {
        console.log("取得データの一部:", JSON.stringify(data[0], null, 2));
      }

      // データベース保存結果の確認
      await verifyDatabaseSave();
    })
    .catch((err) =>
      console.error(
        "TechPlay イベントデータ抽出処理でエラーが発生しました:",
        err
      )
    );
}

export { scrapeTechPlayAndExtractData };
