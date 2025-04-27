import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";
import { Event } from "@prisma/client";
import { fetchConnpassEventsByKeywords } from "./connpassEventUtils";
import { getDateRangeWithDefaults } from "./dateUtils";
import { rankEventsByKeywordMatch } from "./keywordRecommendation";
import { getUserById } from "./userUtils";
import { RankedEvent } from "./keywordRecommendation";

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
以下のユーザーの質問から、技術イベントを検索するための具体的なキーワードを抽出し、関連するキーワードも生成してください。

【ユーザーの質問】
${query}

【指示】
1. まず、質問から直接抽出できる具体的なキーワードを特定してください（例：「React」「ワークショップ」「東京」）
   - 技術名: 具体的な言語やフレームワーク名（例: React, Python, TensorFlow, Docker）
   - イベントタイプ: 具体的なイベント形式（例: ハッカソン, ワークショップ, ハンズオン）
   - 場所: 具体的な都市名や地域名（例: 東京, 大阪, 渋谷）
   - レベル: 具体的な難易度（例: 初心者向け, 中級者, 上級者）
   - トピック: 具体的な分野やテーマ（例: 機械学習, Web開発, セキュリティ）

2. 次に、直接抽出したキーワードに関連する効果的なキーワードを生成してください。
   - 例：「React」から「Next.js」「JSX」「React Hooks」など
   - 例：「ワークショップ」から「ハンズオン」「勉強会」など
   - 例：「東京」から「渋谷」「秋葉原」「新宿」など

3. 以下のような汎用的な言葉は避けてください（検索結果が広くなりすぎるため）
   - 避ける例: 「イベント」「技術」「参加」「学習」「開発」などの一般的すぎる言葉
   - 代わりに: 「Reactワークショップ」「Next.jsハンズオン」のような具体的な言葉を使用

4. 最終的に、質問の意図に最も関連する具体的なキーワードを5〜7個に絞り込んでください。直接抽出したキーワードと関連キーワードの両方を含めてください。

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

    // 4. イベントの処理（取得したイベントが10個以上の場合のみランキング付けを行う）
    let rankedEvents;
    const LLM_MAX_EVENTS = 10; // LLMに渡す最大イベント数
    
    if (events.length <= LLM_MAX_EVENTS) {
      // 10個以下の場合はランキング付けせずにそのまま使用
      console.log(`イベント数が${events.length}個で${LLM_MAX_EVENTS}個以下のため、ランキング付けをスキップします`);
      
      // RankedEvent形式に変換（スコアは計算しないが形式を合わせる必要がある）
      rankedEvents = events.map(event => ({
        event,
        score: 1, // ダミースコア
        matchedKeywords: [] // マッチしたキーワードは計算しない
      }));
    } else {
      // 10個以上の場合はキーワードマッチングでランキング付け
      console.log(`イベント数が${events.length}個で${LLM_MAX_EVENTS}個以上のため、ランキング付けを行います`);
      rankedEvents = rankEventsByKeywordMatch(
        events,
        keywords,
        userInfo,
        LLM_MAX_EVENTS // 上位10個に絞り込む
      );
    }

    if (rankedEvents.length === 0) {
      console.log("ランキング付けされたイベントがありません。");
      return [];
    }

    // 5. LLMに最適なイベントを選択させる（質問内容のみ考慮）
    const recommendedEvents = await selectEventsByQueryOnly(
      rankedEvents,
      query
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

/**
 * 質問内容のみに基づいてイベントを選択する関数
 * @param rankedEvents ランキング付けされたイベントの配列
 * @param query ユーザーの質問
 * @returns LLMが選んだ推薦イベントの配列
 */
export const selectEventsByQueryOnly = async (
  rankedEvents: RankedEvent[],
  query: string
): Promise<LLMRecommendedEvent[]> => {
  try {
    console.log(
      `LLMに${rankedEvents.length}件のイベントから質問「${query}」に関連するイベントを選択させます...`
    );

    // イベント情報を整形
    const eventsInfo = rankedEvents
      .map((rankedEvent, index) => {
        const event = rankedEvent.event;
        return `
イベント${index + 1}:
ID: ${event.id}
タイトル: ${event.title}
開催日: ${
          event.eventDate
            ? new Date(event.eventDate).toLocaleDateString("ja-JP")
            : "未定"
        }
場所: ${event.venue || event.address || "オンライン"}
キーワードマッチスコア: ${rankedEvent.score}
マッチしたキーワード: ${rankedEvent.matchedKeywords.join(", ")}
説明: ${
          event.description
            ? event.description.substring(0, 200) + "..."
            : "説明なし"
        }
URL: ${event.detailUrl || ""}
`;
      })
      .join("\n");

    // LLMを使用してイベントを選択
    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.3,
    });

    // 構造化出力パーサーを定義
    const outputParser = StructuredOutputParser.fromZodSchema(
      z.object({
        recommendedEvents: z
          .array(
            z.object({
              eventId: z.string().describe("イベントのID"),
              title: z.string().describe("イベントのタイトル"),
              relevanceScore: z
                .number()
                .min(0)
                .max(100)
                .describe("質問との関連性スコア（0-100）"),
            })
          )
          .min(1)
          .describe("質問に関連するイベントのみ"),
      })
    );

    // パーサーの説明を取得
    const formatInstructions = outputParser.getFormatInstructions();

    // プロンプトの作成
    const recommendationPrompt = `
あなたはイベント推薦の専門家です。以下のユーザーの質問と候補イベントリストを分析して、質問に最も関連するイベントを選んでください。

【ユーザーの質問】
${query}

【候補イベントリスト】
${eventsInfo}

【評価基準】
1. 質問の意図との関連性
2. 質問で言及されたキーワードとの一致度
3. 質問で言及された条件（場所、日時、形式など）との一致度

【指示】
- 上記の評価基準に基づいて、質問に関連するイベントのみを選んでください。数に制限はありませんが、本当に質問に関連するイベントのみを選んでください。
- 各イベントに0-100の関連性スコアを付けてください（100が最も関連性が高い）。
- ユーザーの個人的な情報（技術スタック、興味、レベル、目標など）は考慮せず、質問内容のみに基づいて選んでください。

${formatInstructions}
`;

    // LLMからの回答を取得
    const llmResponse = await llm.invoke([
      {
        role: "user",
        content: recommendationPrompt,
      },
    ]);

    console.log("LLMからイベント推薦を受信しました");

    // LLMの回答を解析
    let recommendedEvents: LLMRecommendedEvent[] = [];

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

      recommendedEvents = parsedOutput.recommendedEvents;

      console.log(`LLMが${recommendedEvents.length}件のイベントを推薦しました`);
    } catch (error) {
      console.log(
        "構造化出力の解析に失敗しました。フォールバック処理を実行します。",
        error
      );

      // フォールバック処理：上位5件のイベントを選択
      recommendedEvents = rankedEvents.slice(0, 5).map((rankedEvent) => ({
        eventId: rankedEvent.event.id,
        title: rankedEvent.event.title,
        relevanceScore: Math.min(Math.round(rankedEvent.score * 10), 100), // スコアを0-100に変換
      }));
    }

    return recommendedEvents;
  } catch (error) {
    console.error("イベント選択エラー:", error);
    return [];
  }
};
