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

      // ドキュメントを作成（タイトル、詳細URL、概要のみをベクトル化）
      return new Document({
        pageContent: `タイトル: ${event.title}
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
  このユーザーが興味を持ちそうなイベントを探すための検索クエリを2つ以上生成してください。各クエリはユーザーの異なる興味や目標に対応するものにしてください。
  
  各クエリは短くシンプルにし、以下の要素の一部のみを含めてください（全てを含める必要はありません）：
  1. ユーザーの居住地に近い開催地（オンラインも含む）
  2. ユーザーのレベルに合った難易度
  3. ユーザーのゴールに関連するメリット
  4. ユーザーの興味に関連するトピック
  
  各クエリは新しい行で区切り、各行は「- 」で始めてください。例えば：
  
  - 東京で開催されるフロントエンド開発のワークショップ
  - オンラインで参加可能なAI開発入門講座
  - 中級者向けデータサイエンス勉強会
  - ネットワーキングとキャリアアップのためのイベント
  - 機械学習初心者向けハンズオン
  
  各クエリはシンプルで短く、要素が多すぎないようにしてください。合計で5つ程度のクエリを生成してください。
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
  // ユーザー情報を整理
  const place = user.place || "";
  const stack = Array.isArray(user.stack) ? user.stack : [];
  const tags = Array.isArray(user.tag) ? user.tag : [];
  const level = user.level || "";
  const goals = Array.isArray(user.goal) ? user.goal : [];

  // ユーザー情報の型定義
  type UserInfoType = {
    location: string;
    interests: string;
    skillLevel: string;
    goals: string;
  };

  // 単一のユーザー情報セットを作成
  // 技術スタックは除外し、興味タグとゴールの情報のみを使用
  const userInfoSets: UserInfoType[] = [];

  // 単一のセットを作成
  userInfoSets.push({
    location: place,
    interests: tags.join(", "),
    skillLevel: level,
    goals: goals.join(", "),
  });

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

      // 類似度しきい値を設定（低めに設定してより多くのイベントをマッチさせる）
      const SIMILARITY_THRESHOLD = 0.8;

      // しきい値を超える結果のみをフィルタリング
      const filteredResults = resultsWithScores.filter(([doc, score]) => {
        return score >= SIMILARITY_THRESHOLD;
      });

      console.log(
        `検索結果: 合計${resultsWithScores.length}件、しきい値(${SIMILARITY_THRESHOLD})以上: ${filteredResults.length}件`
      );

      // 地域によるフィルタリング
      const userPlace = user.place || "";
      const filteredByLocation = filteredResults.filter(([doc, score]) => {
        const eventLocation = doc.metadata.location || "";

        // ユーザーの居住地に近いか、オンラインイベントのみを残す
        return (
          !userPlace ||
          eventLocation.includes(userPlace) ||
          eventLocation.toLowerCase().includes("オンライン") ||
          eventLocation.toLowerCase().includes("online") ||
          eventLocation.toLowerCase().includes("zoom") ||
          eventLocation.toLowerCase().includes("teams")
        );
      });

      console.log(
        `地域フィルタリング後: ${filteredByLocation.length}件のイベントが残りました`
      );

      // 結果からイベントIDのリストだけを返す
      const resultEventIds = filteredByLocation.map(([doc, score]) => {
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

  // 全体のRAG処理 - 複数のHYDEクエリ生成と最近傍探索を実行
  const processUserQueries = async (inputSets: UserInfoType[]) => {
    const allResultEventIds: string[] = [];
    const uniqueEventIds = new Set<string>();

    // 単一のユーザー情報セットから複数のクエリを生成
    // 入力セットが複数ある場合、最初のセットのみを使用
    const input = inputSets[0];

    // HYDEクエリを生成（複数クエリを一度に生成）
    const hydeQueryResponse = await hydeChain.invoke(input);
    console.log("生成されたHYDEクエリレスポンス:", hydeQueryResponse);

    // レスポンスを行ごとに分割し、各行がクエリとなる
    const queries = hydeQueryResponse
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.substring(2).trim())
      .filter((query) => query.length > 0);

    console.log(`${queries.length}個のクエリを抽出しました:`, queries);

    // 各クエリについて検索を実行
    for (const query of queries) {
      console.log(`クエリ「${query}」で検索します...`);

      // 生成されたクエリを使って最近傍探索を実行
      const resultEventIds = await retrievalChain(query);

      // 結果を結合し、重複を除去
      for (const id of resultEventIds) {
        if (!uniqueEventIds.has(id)) {
          uniqueEventIds.add(id);
          allResultEventIds.push(id);
        }
      }
    }

    console.log("結合されたイベントID:", allResultEventIds);

    // 上位10件を返す
    return allResultEventIds.slice(0, 10);
  };

  // 複数のユーザー情報セットに基づいてイベントを推薦
  return processUserQueries(userInfoSets);
};
