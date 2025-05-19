import puppeteer, { Browser } from "puppeteer";
import prisma from "../config/prisma";

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
}

export async function scrapeSupportersEvents(): Promise<SupporterzEventInfo[]> {
  const browser = await puppeteer.launch({
    headless: true, // ヘッドレスモードを有効にする場合は true
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const url = "https://talent.supporterz.jp/events/";

  try {
    await page.goto(url, { waitUntil: "networkidle2" });

    // イベント情報を抽出
    const eventsData = await page.evaluate(() => {
      console.log("Inside page.evaluate"); // ★デバッグログ
      const eventCards = document.querySelectorAll<HTMLElement>(
        'button.MuiButtonBase-root[data-gtm-click="events"]'
      );
      console.log(`Found ${eventCards.length} event cards`); // ★デバッグログ
      const extractedEvents: SupporterzEventInfo[] = [];

      eventCards.forEach((card, index) => {
        console.log(`Processing card ${index + 1}:`); // ★デバッグログ

        const titleEl = card.querySelector<HTMLElement>(
          'p[class*="title"][class*="event-list-card-hover"]'
        );
        console.log(
          "  Title element:",
          titleEl ? titleEl.textContent?.trim() : "Not found"
        ); // ★デバッグログ

        // 会社名: 提供されたHTML構造に合わせてセレクタを具体的に
        const titleElementForCompanyContext = card.querySelector<HTMLElement>(
          'p[class*="title"][class*="event-list-card-hover"]'
        );
        const companyEl =
          titleElementForCompanyContext?.parentElement?.querySelector<HTMLElement>(
            'p[class*="v4-legacy460"]'
          );
        console.log(
          "  Company element:",
          companyEl ? companyEl.textContent?.trim() : "Not found"
        ); // ★デバッグログ

        const jobTypeEl = card.querySelector<HTMLElement>(
          'div[class*="MuiChip-root"] span[class*="MuiChip-label"]'
        );
        console.log(
          "  Job type element:",
          jobTypeEl ? jobTypeEl.textContent?.trim() : "Not found"
        ); // ★デバッグログ

        // 開催形式: 提供されたHTML構造に合わせてセレクタを具体的に
        const eventFormatEl = card.querySelector<HTMLElement>(
          'div[class*="v4-legacy495"] p[class*="v4-legacy497"]'
        );
        console.log(
          "  Event format element:",
          eventFormatEl ? eventFormatEl.textContent?.trim() : "Not found"
        ); // ★デバッグログ

        // 日付: 提供されたHTML構造に合わせてセレクタを具体的に
        const dateEl = card.querySelector<HTMLElement>(
          'div[class*="v4-legacy495"] p[class*="v4-legacy499"]'
        );
        console.log(
          "  Date element:",
          dateEl ? dateEl.textContent?.trim() : "Not found"
        ); // ★デバッグログ

        const thumbnailContainer = card.querySelector<HTMLElement>(
          'div[class*="img"][class*="event-list-card-hover"]'
        );
        let thumbnailUrl = "";
        if (thumbnailContainer) {
          // thumbnailContainerがnullでないことを確認
          const thumbnailStyleEl =
            thumbnailContainer.querySelector<HTMLElement>("div:first-child");
          if (thumbnailStyleEl) {
            const style = window.getComputedStyle(thumbnailStyleEl);
            const bgImage = style.getPropertyValue("background-image");
            console.log("  Thumbnail background-image style:", bgImage); // ★デバッグログ
            if (bgImage && bgImage !== "none") {
              const urlMatch = bgImage.match(/url\(["']?(.*?)["']?\)/);
              thumbnailUrl = urlMatch ? urlMatch[1] : "";
            }
          }
        }
        console.log("  Extracted thumbnail URL:", thumbnailUrl); // ★デバッグログ

        // イベントURL: buttonの親を辿ってaタグのhrefを探す (なければ "N/A")
        // または、button自体がリンクの情報を持っている場合 (例: data-href属性など) も考慮可能
        const anchorTag = card.closest("a");
        let eventUrl = anchorTag ? anchorTag.href : "";

        // もしbutton要素に直接URLが含まれるようなカスタムデータ属性があれば、それを優先する
        // 例: <button data-event-url="https://example.com/event/123">...</button>
        if (!eventUrl && card.dataset.eventUrl) {
          eventUrl = card.dataset.eventUrl;
        }
        // どうしても取得できない場合は "N/A"
        if (!eventUrl) {
          eventUrl = "N/A";
        }

        extractedEvents.push({
          title: titleEl?.textContent?.trim() || "",
          companyName: companyEl?.textContent?.trim() || "",
          jobType: jobTypeEl?.textContent?.trim() || "",
          eventFormat: eventFormatEl?.textContent?.trim() || "",
          date: dateEl?.textContent?.trim() || "",
          thumbnailUrl: thumbnailUrl,
          eventUrl: eventUrl,
        });
      });

      return extractedEvents;
    });

    console.log("Scraped Events Data:");
    console.log(eventsData);

    //会社名を取ってきて重複なしの配列を作る
    const companyNames = Array.from(
      new Set(eventsData.map((event) => event.companyName))
    );
    console.log("Company Names:");
    console.log(companyNames);

    //会社名の登録をする（upsert）
    for (const companyName of companyNames) {
      await prisma.organization.upsert({
        where: {
          name: companyName,
        },
        create: {
          name: companyName,
        },
        update: {},
      });
    }

    console.log("Organizations Data:");
    const organizations = await prisma.organization.findMany();
    console.log(organizations);

    //eventsDataに該当する組織を追加する
    for (const event of eventsData) {
      const organization = organizations.find(
        (org) => org.name === event.companyName
      );
      if (organization) {
        event.organizationId = organization.id;
      }
    }

    //event.dateをフォーマットする
    for (const event of eventsData) {
      try {
        const originalDateString = event.date;
        const parts = originalDateString.split(/,|~/);
        let dateStrToParse = parts[parts.length - 1].trim();

        // 曜日部分 (例: "(金)") を削除
        dateStrToParse = dateStrToParse.replace(/\s*\(.\)$/, ""); // e.g., "5月30日"

        const match = dateStrToParse.match(/(\d+)月(\d+)日/);

        if (match) {
          const month = parseInt(match[1], 10);
          const day = parseInt(match[2], 10);
          const currentYear = new Date().getFullYear(); // 現在の年を使用

          // JavaScriptの月は0から始まるため、1を引く
          const jsMonth = month - 1;

          // Date.UTCを使用してUTC基準の日付オブジェクトを作成
          const parsedDate = new Date(
            Date.UTC(currentYear, jsMonth, day, 0, 0, 0)
          );

          if (isNaN(parsedDate.getTime())) {
            console.warn(
              `[日付変換警告] イベント「${event.title}」の日付文字列「${originalDateString}」(解析試行:「${dateStrToParse}」)を有効な日付に変換できませんでした。元の文字列を保持します。`
            );
          } else {
            event.date = parsedDate.toISOString();
          }
        } else {
          console.warn(
            `[日付形式警告] イベント「${event.title}」の日付文字列「${originalDateString}」の形式が認識できませんでした。元の文字列を保持します。`
          );
        }
      } catch (e: any) {
        console.error(
          `[日付処理エラー] イベント「${event.title}」(元の日付:「${event.date}」)の日付処理中にエラーが発生しました: ${e.message}`
        );
        // エラーが発生した場合も元の文字列を保持（または適切なエラー処理を行う）
      }
    }

    console.log("Events Data:");
    console.log(eventsData);

    //DBから全イベントを取ってくる
    const events = await prisma.event.findMany({
      include: {
        Organization: true,
        EventSkill: true,
        EventSpeaker: {
          include: {
            Speaker: true,
          },
        },
        EventCategory: {
          include: {
            Category: true,
          },
        },
      },
      orderBy: {
        eventDate: "asc",
      },
    });

    // eventsとeventsDataを比べて、eventsDataにしかないイベントを追加する
    for (const event of eventsData) {
      const existingEvent = events.find((e) => e.title === event.title);
      if (!existingEvent) {
        if (
          typeof event.organizationId === "string" &&
          event.organizationId.length > 0
        ) {
          // event.date は既にISO文字列になっていると仮定
          const eventDateObj = new Date(event.date);
          // startTime が具体的にない場合、eventDate の日付部分のみを利用し、時刻は00:00:00Zとするか、
          // または eventDate と同じ値を startTime に設定する。ここではeventDateと同じ日時とします。
          const startTimeValue = !isNaN(eventDateObj.getTime())
            ? eventDateObj.toISOString()
            : new Date(0).toISOString(); // 無効な日付の場合はエポック開始時刻など

          await prisma.event.create({
            data: {
              title: event.title,
              eventDate: event.date,
              startTime: startTimeValue,
              venue: event.eventFormat,
              organizationId: event.organizationId,
              image: event.thumbnailUrl,
              format: event.eventFormat === "オンライン" ? "ONLINE" : "OFFLINE", // スキーマのenumに合わせる
              difficulty: "FOR_EVERYONE", // スキーマのenumに合わせる
              price: 0, // スキーマの型に合わせる
            },
          });
        } else {
          console.warn(
            `[イベント作成スキップ] イベント「${event.title}」には有効な organizationId がないため、作成をスキップしました。organizationId: ${event.organizationId}`
          );
        }
      }
    }

    return eventsData;
  } catch (error) {
    console.error("Error during scraping:", error);
    return []; // エラー時は空配列を返す
  } finally {
    await browser.close();
  }
}

// スクリプトとして直接実行された場合の処理 (テスト用)
if (require.main === module) {
  (async () => {
    console.log("Starting scraping process...");
    const events = await scrapeSupportersEvents();
    if (events.length > 0) {
      console.log(`Successfully scraped ${events.length} events.`);
      // console.log('First event:', events[0]);
    } else {
      console.log("No events were scraped, or an error occurred.");
    }
  })();
}
