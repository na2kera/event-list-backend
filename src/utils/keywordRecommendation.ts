import { Event } from "@prisma/client";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import {
  fetchConnpassEventsByKeywords,
  convertConnpassEventToPrismaEvent,
} from "./connpassEventUtils";
import { getDateRangeWithDefaults } from "./dateUtils";
import { saveOrUpdateEvents } from "./eventUtils";

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
 * イベントにスコアを付けて返すインターフェース
 */
export interface RankedEvent {
  event: Event;
  score: number;
  matchedKeywords: string[];
}

/**
 * LLMによる推薦イベントの型定義
 */
export interface LLMRecommendedEvent {
  eventId: string;
  title: string;
  relevanceScore: number; // 0-100の関連性スコア
}

/**
 * 興味タグと目標からキーワードを生成し、Connpass APIでイベントを取得する関数
 * @param user ユーザー情報
 * @param fromDate 検索開始日（YYYYMMDD形式、デフォルト：今日）
 * @param toDate 検索終了日（YYYYMMDD形式、デフォルト：14日後）
 * @returns イベントと生成されたキーワードのオブジェクト
 */
export const generateKeywordsAndFetchEvents = async (
  user: UserInfo,
  fromDate?: string,
  toDate?: string
): Promise<{ events: Event[]; keywords: string[] }> => {
  try {
    // 日付範囲の取得（デフォルト：今日から14日後まで）
    const [ymd, ymdEnd] = getDateRangeWithDefaults(fromDate, toDate);

    // ユーザー情報を整形
    const userInfo = {
      place: user.place || "指定なし",
      tag: user.tag?.join(", ") || "指定なし",
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
        keywords: z.array(z.string()).describe("具体的なキーワードの配列（15-20個）"),
      })
    );

    // パーサーの説明を取得
    const formatInstructions = outputParser.getFormatInstructions();

    // プロンプトの作成
    const keywordPrompt = `
以下のユーザー情報に基づいて、このユーザーが興味を持ちそうなイベントを検索するための具体的なキーワードを生成し、関連する効果的なキーワードも提案してください。

【ユーザー情報】
居住地: ${userInfo.place}
興味のあるタグ: ${userInfo.tag}
目標: ${userInfo.goal}

【指示】
1. まず、ユーザーの興味タグと目標から直接関連する具体的なキーワードを生成してください。以下のカテゴリに分けて考えてください：
   - 技術名: 具体的な言語やフレームワーク名（例: React, Python, TensorFlow, Docker）
   - イベントタイプ: 具体的なイベント形式（例: ハッカソン, ワークショップ, ハンズオン）
   - トピック: 具体的な分野やテーマ（例: 機械学習, Web開発, セキュリティ）
   - レベル: 具体的な難易度（例: 初心者向け, 中級者, 上級者）

2. 次に、直接関連するキーワードから発展させた関連キーワードを生成してください。例えば：
   - 例：「Python」から「Django」「FastAPI」「Pandas」「NumPy」など
   - 例：「Web開発」から「HTML」「CSS」「JavaScript」「React」など
   - 例：「機械学習」から「TensorFlow」「PyTorch」「ディープラーニング」など

3. 以下のような汎用的な言葉は避けてください（検索結果が広くなりすぎるため）
   - 避ける例: 「イベント」「技術」「参加」「学習」「開発」などの一般的すぎる言葉
   - 代わりに: 「Pythonワークショップ」「Reactハンズオン」のような具体的な言葉を使用

4. 最終的に、ユーザーの興味と目標に最も関連する具体的なキーワードを15-20個に絞り込んでください。直接関連するキーワードと発展させた関連キーワードの両方を含めてください。

${formatInstructions}
`;

    console.log("LLMにキーワード生成を依頼します...");

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

      // フォールバック処理
      // 興味タグを分割して配列に追加（「React, Next.js」→「React」「Next.js」）
      const interestTags = user.tag || [];
      const expandedTags: string[] = [];
      interestTags.forEach((tag) => {
        if (tag.includes(",")) {
          tag.split(",").forEach((t) => expandedTags.push(t.trim()));
        } else if (tag.includes("、")) {
          tag.split("、").forEach((t) => expandedTags.push(t.trim()));
        } else {
          expandedTags.push(tag.trim());
        }
      });

      // 目標もキーワードとして追加
      const goalKeywords = user.goal || [];

      // 重複を削除
      keywords = [...new Set([...expandedTags, ...goalKeywords])].filter(
        (t) => t.length > 0
      );
    }

    // キーワードが存在しない場合は興味タグと目標を直接使用
    if (keywords.length === 0) {
      console.log("キーワードがありません。興味タグと目標を直接使用します。");

      // 興味タグを分割して配列に追加
      const interestTags = user.tag || [];
      const expandedTags: string[] = [];
      interestTags.forEach((tag) => {
        if (tag.includes(",")) {
          tag.split(",").forEach((t) => expandedTags.push(t.trim()));
        } else if (tag.includes("、")) {
          tag.split("、").forEach((t) => expandedTags.push(t.trim()));
        } else {
          expandedTags.push(tag.trim());
        }
      });

      // 目標もキーワードとして追加
      const goalKeywords = user.goal || [];

      // 重複を削除
      keywords = [...new Set([...expandedTags, ...goalKeywords])].filter(
        (t) => t.length > 0
      );
    }

    console.log("生成されたキーワード（OR条件）:", keywords);

    // Connpassイベントを取得
    const connpassEvents = await fetchConnpassEventsByKeywords(
      [], // 必須キーワード（AND条件）は使用しない
      keywords, // 全てのキーワードをOR条件で検索
      user.place,
      ymd,
      ymdEnd
    );

    console.log(`${connpassEvents.length}件のイベントを取得しました。`);

    // 取得したイベントをデータベースに保存
    try {
      // connpassEventsはすでにEvent型になっているため、そのままデータベースに保存
      await saveOrUpdateEvents(connpassEvents);
      console.log(
        `${connpassEvents.length}件のイベントをデータベースに保存しました。`
      );
    } catch (dbError) {
      console.error("データベース保存エラー:", dbError);
      // データベース保存に失敗しても処理を続行
    }

    return { events: connpassEvents, keywords };
  } catch (error) {
    console.error("キーワード生成とイベント取得エラー:", error);
    return { events: [], keywords: [] };
  }
};

/**
 * イベントとキーワードの一致度を計算してスコアを付ける
 * @param event イベント
 * @param keywords キーワード配列
 * @param user ユーザー情報
 * @returns スコア（キーワードの一致数）
 */
const calculateEventScore = (
  event: Event,
  keywords: string[],
  user: UserInfo
): { score: number; matchedKeywords: string[] } => {
  // イベントのタイトル、説明、会場などをテキストとして結合
  const eventText = [
    event.title || "",
    event.description || "",
    event.venue || "",
    event.address || "",
    event.detailUrl || "",
  ]
    .join(" ")
    .toLowerCase();

  // マッチしたキーワードを記録
  const matchedKeywords = keywords.filter((keyword) =>
    eventText.includes(keyword.toLowerCase())
  );

  // スコアはマッチしたキーワードの数
  const score = matchedKeywords.length;

  return { score, matchedKeywords };
};

/**
 * イベントをキーワードの一致度でランキング付けして上位20件を返す関数
 * @param events イベントの配列
 * @param keywords キーワード配列
 * @param user ユーザー情報
 * @param limit 返すイベント数（デフォルト：20）
 * @returns スコア付きイベントの配列
 */
export const rankEventsByKeywordMatch = (
  events: Event[],
  keywords: string[],
  user: UserInfo,
  limit: number = 20
): RankedEvent[] => {
  try {
    console.log(
      `${events.length}件のイベントをキーワードマッチングでランキングします...`
    );

    // 各イベントにスコアを付ける
    const rankedEvents: RankedEvent[] = events.map((event) => {
      const { score, matchedKeywords } = calculateEventScore(
        event,
        keywords,
        user
      );

      return {
        event,
        score,
        matchedKeywords,
      };
    });

    // スコアの高い順にソート
    const sortedEvents = rankedEvents.sort((a, b) => b.score - a.score);

    // 上位limit件を返す
    const topEvents = sortedEvents.slice(0, limit);

    console.log(
      `スコア付けが完了しました。上位${topEvents.length}件を返します。`
    );
    topEvents.forEach((event, index) => {
      console.log(
        `${index + 1}. ${event.event.title} (スコア: ${
          event.score
        }, マッチキーワード: ${event.matchedKeywords.join(", ")})`
      );
    });

    return topEvents;
  } catch (error) {
    console.error("イベントランキングエラー:", error);
    return [];
  }
};

/**
 * ランキング付けされたイベントをLLMに渡して、ユーザーに最適なイベントを選択する関数
 * @param rankedEvents ランキング付けされたイベントの配列
 * @param user ユーザー情報
 * @returns LLMが選んだ推薦イベントの配列
 */
export const selectOptimalEventsWithLLM = async (
  rankedEvents: RankedEvent[],
  user: UserInfo
): Promise<LLMRecommendedEvent[]> => {
  try {
    console.log(
      `LLMに${rankedEvents.length}件のイベントから本当におすすめのイベントを選択させます...`
    );

    // ユーザー情報を整形
    const userInfo = {
      place: user.place || "指定なし",
      stack: user.stack?.join(", ") || "指定なし",
      tag: user.tag?.join(", ") || "指定なし",
      level: user.level || "指定なし",
      goal: user.goal?.join(", ") || "指定なし",
    };

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
                .describe("ユーザーとの関連性スコア（0-100）"),
            })
          )
          .min(1)
          .describe("ユーザーに本当におすすめだと思うイベントのみ"),
      })
    );

    // パーサーの説明を取得
    const formatInstructions = outputParser.getFormatInstructions();

    // プロンプトの作成
    const recommendationPrompt = `
あなたはイベント推薦の専門家です。以下のユーザー情報と候補イベントリストを分析して、ユーザーに最適なイベントを選んでください。

【ユーザー情報】
居住地: ${userInfo.place}
技術スタック: ${userInfo.stack}
興味のあるタグ: ${userInfo.tag}
技術レベル: ${userInfo.level}
目標: ${userInfo.goal}

【候補イベントリスト】
${eventsInfo}

【評価基準】
1. ユーザーの興味タグとの関連性
2. ユーザーの目標達成に役立つか

【指示】
- 上記の評価基準に基づいて、ユーザーに本当におすすめだと思うイベントのみを選んでください。数に制限はありませんが、本当に良いと思うイベントのみを選んでください。
- 各イベントに0-100の関連性スコアを付けてください（100が最も関連性が高い）。
- 多様なイベントを選ぶよう心がけてください。

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
        "構造化出力の解析に失敗しました。フォールバック処理を実行します。"
      );

      // フォールバック処理：スコアの高い順に上位5件を選択
      recommendedEvents = rankedEvents
        .slice(0, 5) // フォールバック時は上位5件に制限
        .map((rankedEvent, index) => {
          return {
            eventId: rankedEvent.event.id || `event-${index}`,
            title: rankedEvent.event.title || `イベント${index + 1}`,
            relevanceScore: Math.min(100, rankedEvent.score * 10), // スコアを0-100に正規化
          };
        });
    }

    return recommendedEvents;
  } catch (error) {
    console.error("LLMによるイベント選択エラー:", error);

    // エラー時はスコアの高い順に上位5件を選択
    return rankedEvents.slice(0, 5).map((rankedEvent, index) => {
      return {
        eventId: rankedEvent.event.id || `event-${index}`,
        title: rankedEvent.event.title || `イベント${index + 1}`,
        relevanceScore: Math.min(100, rankedEvent.score * 10), // スコアを0-100に正規化
      };
    });
  }
};
