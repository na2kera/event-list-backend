import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";
import { Event } from "@prisma/client";
import { fetchConnpassEventsByKeywords } from "./connpassEventUtils";
import { getDateRangeWithDefaults } from "./dateUtils";
import { rankEventsByKeywordMatch } from "./keywordRecommendation";
import { selectOptimalEventsWithLLM } from "./keywordRecommendation";
import { getUserById } from "./userUtils";

/**
 * ユーザー情報の型定義
 */
export interface UserInfo {
  place?: string | null;
  stack?: string[] | null;
  tag?: string[] | null;
  level?: string | null;
  goal?: string[] | null;
}

/**
 * LLMによって推薦されたイベントの型定義
 */
export interface LLMRecommendedEvent {
  eventId: string;
  title: string;
  relevanceScore: number;
}

/**
 * ユーザーの質問からキーワードを抽出する関数
 * @param query ユーザーの質問
 * @returns 抽出されたキーワードの配列
 */
export const extractKeywordsFromQuery = async (
  query: string
): Promise<string[]> => {
  try {
    // LLMを使ってキーワード抽出
    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.2,
    });

    // 構造化出力パーサーを定義
    const outputParser = StructuredOutputParser.fromZodSchema(
      z.object({
        keywords: z.array(z.string()).describe("キーワードの配列（5〜10個）"),
      })
    );

    // パーサーの説明を取得
    const formatInstructions = outputParser.getFormatInstructions();

    // プロンプトの作成
    const keywordPrompt = `
以下のユーザーの質問から、技術イベントを検索するための重要なキーワードを抽出してください。

【ユーザーの質問】
${query}

【指示】
1. 質問から直接抽出できるキーワード（技術名、イベントタイプ、場所、レベルなど）を特定してください
2. キーワードは単語または短いフレーズにしてください（例：「Python」「機械学習」「ハッカソン」「初心者向け」など）
3. 質問から直接抽出したキーワードをもとに関連するであろう5〜10個のキーワードを生成してください

${formatInstructions}
`;

    console.log("LLMにキーワード抽出を依頼します...");

    // LLMからの回答を取得
    const llmResponse = await llm.invoke([
      {
        role: "user",
        content: keywordPrompt,
      },
    ]);

    console.log("LLMからキーワードを受信しました");

    // キーワードを取得
    let keywords: string[] = [];

    try {
      // contentの型に応じて適切に処理
      let contentStr = "";
      if (typeof llmResponse.content === "string") {
        contentStr = llmResponse.content;
      } else if (
        Array.isArray(llmResponse.content) &&
        llmResponse.content.length > 0
      ) {
        if (typeof llmResponse.content[0] === "string") {
          contentStr = llmResponse.content[0];
        } else if (
          llmResponse.content[0] &&
          typeof llmResponse.content[0] === "object"
        ) {
          contentStr = JSON.stringify(llmResponse.content[0]);
        }
      } else if (llmResponse.content) {
        contentStr = String(llmResponse.content);
      }

      // 構造化された出力を解析
      const parsedOutput = await outputParser.parse(contentStr);

      keywords = parsedOutput.keywords || [];

      console.log(`生成されたキーワード: ${keywords.length}個`, keywords);
    } catch (error) {
      console.log(
        "構造化出力の解析に失敗しました。フォールバック処理を実行します。"
      );

      // フォールバック処理：質問を単語に分割してキーワードとして使用
      keywords = query
        .split(/\s+/)
        .filter((word) => word.length > 1)
        .slice(0, 5);
    }

    // キーワードが存在しない場合は質問全体を1つのキーワードとして使用
    if (keywords.length === 0) {
      console.log("キーワードがありません。質問全体を使用します。");
      keywords = [query];
    }

    return keywords;
  } catch (error) {
    console.error("キーワード抽出エラー:", error);
    // エラーが発生した場合は、質問を単語に分割してキーワードとして返す
    return query.split(/\s+/).filter((word) => word.length > 1);
  }
};

/**
 * ユーザーの質問に基づいてイベントを推薦する関数
 * @param query ユーザーの質問
 * @param userId ユーザーID
 * @param fromDate 検索開始日（YYYYMMDD形式、デフォルト：今日）
 * @param toDate 検索終了日（YYYYMMDD形式、デフォルト：14日後）
 * @returns LLMが選んだ推薦イベントの配列
 */
export const recommendEventsByQuery = async (
  query: string,
  userId: string,
  fromDate?: string,
  toDate?: string
): Promise<LLMRecommendedEvent[]> => {
  try {
    console.log("質問ベースのイベント推薦プロセスを開始します...");

    // ユーザーIDからユーザー情報を取得
    const user = await getUserById(userId);

    if (!user) {
      throw new Error(`ユーザー ${userId} が見つかりません。`);
    }

    // UserInfoオブジェクトを作成
    const userInfo: UserInfo = {
      place: user.place,
      stack: user.stack,
      tag: user.tag,
      level: user.level,
      goal: user.goal,
    };

    // 1. 質問からキーワードを抽出
    const keywords = await extractKeywordsFromQuery(query);

    // 2. 日付範囲の取得（デフォルト：今日から14日後まで）
    const [ymd, ymdEnd] = getDateRangeWithDefaults(fromDate, toDate);

    // 3. Connpass APIでイベントを取得
    console.log(`キーワードでConnpassイベントを検索: ${keywords.join(", ")}`);
    const events = await fetchConnpassEventsByKeywords(
      [], // 必須キーワード（AND条件）は使用しない
      keywords, //
      userInfo.place,
      ymd,
      ymdEnd
    );

    if (events.length === 0) {
      console.log("イベントが見つかりませんでした。");
      return [];
    }

    console.log(`${events.length}件のイベントを取得しました`);

    // 4. イベントをキーワードの一致度でランキング付け
    const rankedEvents = rankEventsByKeywordMatch(
      events,
      keywords,
      userInfo,
      20
    );

    if (rankedEvents.length === 0) {
      console.log("ランキング付けされたイベントがありません。");
      return [];
    }

    // 5. LLMに最適なイベントを選択させる
    const recommendedEvents = await selectOptimalEventsWithLLM(
      rankedEvents,
      userInfo
    );

    // 6. 関連性スコアが一定以上のイベントのみをフィルタリング
    const RELEVANCE_THRESHOLD = 70; // しきい値：70点以上
    const filteredEvents = recommendedEvents.filter(
      (event) => event.relevanceScore >= RELEVANCE_THRESHOLD
    );

    console.log(
      `${recommendedEvents.length}件のイベントから、スコア${RELEVANCE_THRESHOLD}以上の${filteredEvents.length}件を選出しました。`
    );
    console.log("質問ベースのイベント推薦プロセスが完了しました。");

    return filteredEvents;
  } catch (error) {
    console.error("質問ベースのイベント推薦エラー:", error);
    return [];
  }
};
