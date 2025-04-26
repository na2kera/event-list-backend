import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "langchain/document";
import {
  RunnableSequence,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import { z } from "zod";
import { getAllEvents } from "./eventUtils";
import prisma from "../config/prisma";

// 埋め込みモデルの初期化
const embeddings = new OpenAIEmbeddings();

/**
 * ベクトルストアを初期化する関数
 * @param events ベクトルストアに格納するイベントのリスト
 * @returns 初期化されたベクトルストア
 */
const initVectorStore = async (
  events?: Array<{
    id: string;
    title: string;
    venue?: string | null;
    address?: string | null;
    eventDate?: Date | string | null;
    description?: string | null;
    detailUrl?: string | null;
    [key: string]: any; // その他のプロパティを許容
  }>
): Promise<MemoryVectorStore> => {
  // 指定されたイベントリストがあれば、それを使用
  if (events && events.length > 0) {
    console.log(
      `指定された${events.length}件のイベントでベクトルストアを初期化します`
    );

    // イベントからドキュメントを生成
    const docs = events.map((event) => {
      // 必要なフィールドを安全に取得
      const venue = event.venue || "";
      const address = event.address || "";
      const location = venue + (address ? ` (${address})` : "");
      const eventDate = event.eventDate
        ? typeof event.eventDate === "string"
          ? event.eventDate
          : new Date(event.eventDate).toISOString().split("T")[0]
        : "";
      const detailUrl = event.detailUrl || "";

      // ドキュメントを作成
      return new Document({
        pageContent: `タイトル: ${event.title}
開催地: ${location}
開催日: ${eventDate}
詳細URL: ${detailUrl}
概要: ${event.description || ""}`,
        metadata: {
          id: event.id,
          title: event.title,
          location: location,
          eventDate: eventDate,
          detailUrl: detailUrl,
        },
      });
    });

    // ドキュメントがない場合は空のベクトルストアを返す
    if (docs.length === 0) {
      console.log("ドキュメントがありません。空のベクトルストアを返します。");
      return new MemoryVectorStore(embeddings);
    }

    // ベクトルストアの作成
    console.log(`${docs.length}件のドキュメントからベクトルストアを作成します`);
    return await MemoryVectorStore.fromDocuments(docs, embeddings);
  }

  // イベントが指定されていない場合は、DBから全イベントを取得
  try {
    console.log("イベントが指定されていないため、DBから全イベントを取得します");
    const dbEvents = await getAllEvents();
    console.log(`DBから${dbEvents.length}件のイベントを取得しました`);

    // DBから取得したイベントからドキュメントを生成
    const docs = dbEvents.map((event) => {
      // 必要なフィールドを安全に取得
      const venue = event.venue || "";
      const address = event.address || "";
      const location = venue + (address ? ` (${address})` : "");
      const eventDate = event.eventDate
        ? new Date(event.eventDate).toISOString().split("T")[0]
        : "";
      const detailUrl = event.detailUrl || "";

      return new Document({
        pageContent: `タイトル: ${event.title}
開催地: ${location}
開催日: ${eventDate}
詳細URL: ${detailUrl}
概要: ${event.description || ""}`,
        metadata: {
          id: event.id,
          title: event.title,
          location: location,
          eventDate: eventDate,
          detailUrl: detailUrl,
        },
      });
    });

    const tempVectorStore = await MemoryVectorStore.fromDocuments(
      docs,
      embeddings
    );
    console.log(
      `Prismaから${docs.length}件のイベントでベクトルストアを初期化しました`
    );

    // ベクトルストアを返す
    return tempVectorStore;
  } catch (error) {
    console.error("Prismaからのイベント取得に失敗しました:", error);
    // 空のベクトルストアを作成
    const emptyVectorStore = await MemoryVectorStore.fromDocuments(
      [],
      embeddings
    );
    console.warn("空のベクトルストアを初期化しました");

    // 空のベクトルストアを返す
    return emptyVectorStore;
  }
};

// HyDEのフォーマット用プロンプト
const hydePrompt = PromptTemplate.fromTemplate(`
  あなたはイベント検索エンジンです。以下のユーザー情報に基づいて、ユーザーが興味を持ちそうなイベントを探すための検索クエリを生成してください。
  
  ---
  【ユーザー情報】
  - 居住地: {location}
  - 技術スタック: {skills}
  - 興味のあるトピック: {interests}
  - 技術レベル: {skillLevel}
  - 目標: {goals}
  
  
  ---
  【イベントDBの形式】
  イベントは以下のような形式で記録されています：
  
  - イベントID: 一意の識別子（例: 123）
  - タイトル: イベントの名前（例: 「Next.js実践ワークショップ」）
  - 開催地: 市区町村やオンライン（例: 東京、札幌、オンライン）
  - 開催日: 日付形式（例: 2025-05-10）
  - 概要: イベントの内容説明（例: 「Next.jsの実践的な使い方を学ぶハンズオンイベントです。」）
  
  ---
  【出力形式】
  このユーザーが興味を持ちそうなイベントの「説明文」を生成してください。
  これは検索クエリとして使われるため、検索エンジンが関連イベントを見つけやすいように、**具体的で詳細に**書いてください。
  
  例：
  - 「東京で開催される、ReactやNext.jsを扱うフロントエンド開発者向けのハンズオンイベント」
  - 「Pythonを用いた機械学習の実践的なワークショップ。生成AIや画像認識に興味がある人に最適」
  
  技術的な専門用語や、ユーザーのスキルに沿ったキーワードを盛り込みましょう。
  `);

// 結果のスキーマ定義
const eventRecommendationSchema = z.object({
  id: z.string().describe("イベントのID"),
  title: z.string().describe("イベントのタイトル"),
  relevanceScore: z
    .number()
    .min(0)
    .max(100)
    .describe("ユーザーとの関連性スコア（0-100）"),
  relevanceReason: z.string().describe("このイベントがユーザーに関連する理由"),
});

// ユーザー情報に基づいてイベントをランク付けするRAGチェーン
export const hydeEventsForUser = async (
  user: {
    place?: string | null;
    stack?: string[] | null;
    tag?: string[] | null;
    level?: string | null;
    goal?: string[] | null;
  },
  events?: Array<{
    id: string;
    title: string;
    venue?: string | null;
    address?: string | null;
    eventDate?: Date | string | null;
    description?: string | null;
    detailUrl?: string | null;
    [key: string]: any; // その他のプロパティを許容
  }>
): Promise<string[]> => {
  // ユーザー情報
  const userInfo = {
    location: user.place || "",
    skills: Array.isArray(user.stack) ? user.stack.join(", ") : "",
    interests: Array.isArray(user.tag) ? user.tag.join(", ") : "",
    skillLevel: user.level || "",
    goals: Array.isArray(user.goal) ? user.goal.join(", ") : "",
  };

  // イベントリストに基づいてベクトルストアを初期化
  console.log(`イベント指定: ${events ? `${events.length}件` : "なし"}`);
  const tempVectorStore = await initVectorStore(events);

  // LLMの初期化
  const llm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.7,
  });

  // HyDEチェーン: ユーザー情報からクエリを生成
  const hydeChain = RunnableSequence.from([
    hydePrompt,
    llm,
    new StringOutputParser(),
  ]);

  // 検索チェーン: HyDEクエリで最近傍探索
  const retrievalChain = async (query: string) => {
    try {
      // 類似度スコア付きで検索結果を取得
      const resultsWithScores = await tempVectorStore.similaritySearchWithScore(
        query,
        50
      );

      // 厳格な類似度しきい値を設定
      const SIMILARITY_THRESHOLD = 0.7;

      // しきい値を超える結果のみをフィルタリング
      const filteredResults = resultsWithScores.filter(([doc, score]) => {
        return score >= SIMILARITY_THRESHOLD;
      });

      console.log(
        `検索結果: 合計${resultsWithScores.length}件、しきい値(${SIMILARITY_THRESHOLD})以上: ${filteredResults.length}件`
      );

      // 結果からイベントIDのリストだけを返す
      const resultEventIds = filteredResults.map(([doc, score]) => {
        console.log(
          `イベント「${doc.metadata.title}」の類似度スコア: ${score}`
        );
        return doc.metadata.id;
      });

      return resultEventIds;
    } catch (error) {
      console.error("検索処理中にエラーが発生しました:", error);
      return [];
    }
  };

  // 全体のRAG処理 - HyDEクエリ生成と最近傍探索のみを使用
  const processUserQuery = async (input: typeof userInfo) => {
    // HyDEクエリを生成
    const hydeQuery = await hydeChain.invoke(input);
    console.log("生成されたHyDEクエリ:", hydeQuery);

    // 生成されたクエリを使って最近傍探索を実行
    const resultEventIds = await retrievalChain(hydeQuery);
    console.log("ランキングされたイベントID:", resultEventIds);

    // イベントIDのリストをそのまま返す
    return resultEventIds.slice(0, 10); // 上位10件を返す
  };

  // ユーザー情報に基づいてイベントを推薦
  return processUserQuery(userInfo);
};
