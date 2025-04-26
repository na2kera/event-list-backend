import { ChatOpenAI } from "@langchain/openai";
import {
  fetchConnpassEventsV2,
  ConnpassSearchParamsV2,
} from "../services/connpassService";
import { convertConnpassEventToPrismaEvent, fetchConnpassEventsByKeywords } from "./connpassEventUtils";
import { Event } from "@prisma/client";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser, JsonOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

/**
 * ユーザー情報の基本型
 */
export interface UserInfo {
  place?: string | null;
  stack?: string[] | null;
  tag?: string[] | null;
  level?: string | null;
  goal?: string[] | null;
}

/**
 * イベント情報の基本型
 */
export interface EventInfo {
  id: string;
  title: string;
  venue?: string | null;
  address?: string | null;
  eventDate?: Date | string | null;
  description?: string | null;
  detailUrl?: string | null;
  format?: string | null;
  eventType?: string | null;
  [key: string]: any; // その他のプロパティを許容
}

/**
 * LLMを使用して直接イベントをレコメンドする関数
 * ベクトル検索を使わず、LLMに直接イベント情報とユーザー情報を渡してレコメンドを取得
 * @param user ユーザー情報
 * @param events イベントリスト
 * @returns レコメンドされたイベントIDの配列
 */
export const recommendEventsWithLLM = async (
  user: UserInfo,
  events?: Array<EventInfo>
): Promise<string[]> => {
  try {
    if (!events || events.length === 0) {
      console.log("レコメンド対象のイベントがありません");
      return [];
    }

    console.log(`${events.length}件のイベントからレコメンドを生成します`);

    // ユーザー情報を整形
    const userInfo = {
      place: user.place || "指定なし",
      stack: user.stack?.join(", ") || "指定なし",
      tag: user.tag?.join(", ") || "指定なし",
      level: user.level || "指定なし",
      goal: user.goal?.join(", ") || "指定なし",
    };

    // イベント情報を整形（最大20件まで）
    const maxEvents = 20;
    const limitedEvents = events.slice(0, maxEvents);

    if (events.length > maxEvents) {
      console.log(`イベント数が多いため、最初の${maxEvents}件のみを使用します`);
    }

    const formattedEvents = limitedEvents
      .map((event, index) => {
        // 日付の整形
        const eventDate = event.eventDate
          ? typeof event.eventDate === "string"
            ? event.eventDate
            : new Date(event.eventDate).toISOString().split("T")[0]
          : "日付未定";

        // 場所の整形
        const location =
          `${event.venue || ""}${event.address ? ` (${event.address})` : ""}` ||
          "場所未定";

        return `イベント${index + 1}:
ID: ${event.id}
タイトル: ${event.title}
開催日: ${eventDate}
開催場所: ${location}
概要: ${
          event.description
            ? event.description.substring(0, 200) +
              (event.description.length > 200 ? "..." : "")
            : "概要なし"
        }
`;
      })
      .join("\n");

    // 構造化出力パーサーを定義
    const outputParser = StructuredOutputParser.fromZodSchema(
      z.object({
        recommendedEventIds: z.array(z.string()).describe("レコメンドするイベントIDの配列（最大5件）")
      })
    );

    // パーサーの説明を取得
    const formatInstructions = outputParser.getFormatInstructions();

    // プロンプトの作成
    const prompt = `
以下のユーザー情報に基づいて、リストされたイベントの中から最も適切な5つのイベントを選んでください。

【ユーザー情報】
居住地: ${userInfo.place}
技術スタック: ${userInfo.stack}
興味のあるタグ: ${userInfo.tag}
技術レベル: ${userInfo.level}
目標: ${userInfo.goal}

【イベントリスト】
${formattedEvents}

【指示】
上記のイベントの中から、ユーザーに最も適していると思われる5つのイベントを選んでください。
以下の基準を考慮して選択してください：
1. ユーザーの技術スタックとの関連性
2. ユーザーの興味のあるタグとの関連性
3. ユーザーの居住地との近さ（オンラインイベントは地理的制約なし）
4. ユーザーの技術レベルに適した難易度
5. ユーザーの目標達成に役立つか

${formatInstructions}
`;

    console.log("LLMにレコメンドを依頼します...");

    // LLMの初期化
    const chatModel = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.2,
    });

    // LLMからの回答を取得
    const response = await chatModel.invoke([{
      role: "user",
      content: prompt
    }]);

    console.log("LLMからの回答を受信しました");

    try {
      // 構造化された出力を解析
      // contentの型に応じて適切に処理
      let contentStr = "";
      if (typeof response.content === "string") {
        contentStr = response.content;
      } else if (Array.isArray(response.content) && response.content.length > 0) {
        if (typeof response.content[0] === "string") {
          contentStr = response.content[0];
        } else if (response.content[0] && typeof response.content[0] === "object") {
          contentStr = JSON.stringify(response.content[0]);
        }
      } else if (response.content) {
        contentStr = String(response.content);
      }
      const parsedOutput = await outputParser.parse(contentStr);
      console.log(`LLMが${parsedOutput.recommendedEventIds.length}件のイベントをレコメンドしました`);
      return parsedOutput.recommendedEventIds;
    } catch (error) {
      // 解析に失敗した場合はフォールバック処理
      console.log("構造化出力の解析に失敗しました。フォールバック処理を実行します。");
      // contentの型に応じて適切に処理
      let content = "";
      if (typeof response.content === "string") {
        content = response.content;
      } else if (Array.isArray(response.content) && response.content.length > 0) {
        if (typeof response.content[0] === "string") {
          content = response.content[0];
        } else if (response.content[0] && typeof response.content[0] === "object") {
          content = JSON.stringify(response.content[0]);
        }
      } else if (response.content) {
        content = String(response.content);
      }
      const match = content.match(/イベントID:\s*([\w,_-]+)/i) || 
                   content.match(/([\w_-]+(?:,[\w_-]+){0,4})/); // フォーマットに従わない場合のフォールバック

      if (match && match[1]) {
        const recommendedIds = match[1].split(",").map((id) => id.trim());
        console.log(`フォールバック: ${recommendedIds.length}件のイベントIDを抽出しました`);
        return recommendedIds;
      }

      console.log("LLMの回答からイベントIDを抽出できませんでした");
      console.log("LLMの回答:", content);
      return [];
    }
  } catch (error) {
    console.error("LLMによるイベントレコメンドエラー:", error);
    return [];
  }
};

/**
 * ユーザー情報からキーワードを生成し、ConnpassAPIでイベントを検索する関数
 * @param user ユーザー情報
 * @param fromDate 検索開始日（YYYYMMDD形式、デフォルト：今日）
 * @param toDate 検索終了日（YYYYMMDD形式、デフォルト：14日後）
 * @returns 変換されたPrismaのEvent型の配列
 */
export const generateKeywordsAndFetchConnpassEvents = async (
  user: UserInfo,
  fromDate?: string,
  toDate?: string
): Promise<Event[]> => {
  try {
    // ユーザー情報を整形
    const userInfo = {
      place: user.place || "指定なし",
      stack: user.stack?.join(", ") || "指定なし",
      tag: user.tag?.join(", ") || "指定なし",
      level: user.level || "指定なし",
      goal: user.goal?.join(", ") || "指定なし",
    };

    // LLMを使用してキーワードを生成
    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.7,
    });

    // 構造化出力パーサーを定義
    const outputParser = StructuredOutputParser.fromZodSchema(
      z.object({
        keywords: z.array(z.string()).describe("生成されたキーワードの配列（30個）")
      })
    );

    // パーサーの説明を取得
    const formatInstructions = outputParser.getFormatInstructions();

    // プロンプトの作成
    const keywordPrompt = `
以下のユーザー情報に基づいて、このユーザーが興味を持ちそうなイベントを検索するためのキーワードを30個生成してください。

【ユーザー情報】
居住地: ${userInfo.place}
技術スタック: ${userInfo.stack}
興味のあるタグ: ${userInfo.tag}
技術レベル: ${userInfo.level}
目標: ${userInfo.goal}

【指示】
1. キーワードはプログラミング言語、技術、イベントタイプ、業界などに関連するものにしてください
2. キーワードは単語または短いフレーズにしてください（例：「Python」「機械学習」「ハッカソン」「初心者向け」など）
3. 技術スタックに関連するキーワード、興味のタグに関連するキーワード、目標に関連するキーワードをバランスよく含めてください

${formatInstructions}
`;

    console.log("LLMにキーワード生成を依頼します...");

    // LLMの初期化
    const keywordModel = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.7,
    });

    // LLMからの回答を取得
    const llmResponse = await keywordModel.invoke([{
      role: "user",
      content: keywordPrompt
    }]);

    console.log("LLMからキーワードを受信しました");

    let keywords: string[] = [];
    try {
      // 構造化された出力を解析
      // contentの型に応じて適切に処理
      let contentStr = "";
      if (typeof llmResponse.content === "string") {
        contentStr = llmResponse.content;
      } else if (Array.isArray(llmResponse.content) && llmResponse.content.length > 0) {
        if (typeof llmResponse.content[0] === "string") {
          contentStr = llmResponse.content[0];
        } else if (llmResponse.content[0] && typeof llmResponse.content[0] === "object") {
          contentStr = JSON.stringify(llmResponse.content[0]);
        }
      } else if (llmResponse.content) {
        contentStr = String(llmResponse.content);
      }
      const parsedOutput = await outputParser.parse(contentStr);
      keywords = parsedOutput.keywords;
    } catch (error) {
      // 解析に失敗した場合はフォールバック処理
      console.log("構造化出力の解析に失敗しました。フォールバック処理を実行します。");
      // contentの型に応じて適切に処理
      let content = "";
      if (typeof llmResponse.content === "string") {
        content = llmResponse.content;
      } else if (Array.isArray(llmResponse.content) && llmResponse.content.length > 0) {
        if (typeof llmResponse.content[0] === "string") {
          content = llmResponse.content[0];
        } else if (llmResponse.content[0] && typeof llmResponse.content[0] === "object") {
          content = JSON.stringify(llmResponse.content[0]);
        }
      } else if (llmResponse.content) {
        content = String(llmResponse.content);
      }
      const match =
        content.match(/キーワード:\s*(.+)/) ||
        content.match(
          /[\w\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+(?:,\s*[\w\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+)+/u
        );

      if (match && match[1]) {
        keywords = match[1]
          .split(",")
          .map((kw) => kw.trim())
          .filter((kw) => kw.length > 0)
          .map(String); // 全ての要素を確実に文字列に変換
      } else {
        // フォールバック：テキスト全体から単語を抽出
        const words = content
          .split(/[\s,、]+/)
          .filter(
            (word) =>
              word.length >= 2 &&
              !word.match(/^[\d.,]+$/) &&
              ![
                "",
                "キーワード",
                "出力",
                "形式",
                "以下",
                "です",
                "ます",
                "など",
                "または",
                "および",
              ].includes(word)
          );
        keywords = [...new Set(words)].slice(0, 30).map(String); // 重複を削除して最大30個、全て文字列に変換
      }
    }

    console.log(`${keywords.length}個のキーワードを生成しました:`, keywords);

    // キーワードをANDとOR条件に分割
    // 技術スタックと興味タグに関連する重要なキーワードはAND条件に
    // それ以外の一般的なキーワードはOR条件に
    const stackKeywords = user.stack || [];
    const tagKeywords = user.tag || [];

    // 重要キーワード（AND条件）を特定
    const importantKeywords = keywords
      .filter((kw) => {
        // 技術スタックまたは興味タグに含まれる単語が含まれるキーワード
        return (
          stackKeywords.some((stack) =>
            kw.toLowerCase().includes(stack.toLowerCase())
          ) ||
          tagKeywords.some((tag) =>
            kw.toLowerCase().includes(tag.toLowerCase())
          )
        );
      })
      .slice(0, 5); // 最大5個

    // その他のキーワード（OR条件）
    const otherKeywords = keywords
      .filter((kw) => !importantKeywords.includes(kw))
      .slice(0, 25); // 最大25個

    console.log("AND条件キーワード:", importantKeywords);
    console.log("OR条件キーワード:", otherKeywords);

    // fetchConnpassEventsByKeywordsを使用してイベントを取得
    return await fetchConnpassEventsByKeywords(
      importantKeywords,
      otherKeywords,
      user.place,
      fromDate,
      toDate
    );
  } catch (error) {
    console.error("キーワード生成とConnpassイベント取得エラー:", error);
    return [];
  }
};

