import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "langchain/document";
import fs from "fs";
import path from "path";
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
import { getAllEvents } from "../utils/eventUtils";
import prisma from "../config/prisma";

// モックイベントデータを読み込む
const mockEventsPath = path.join(__dirname, "../data/mockEvents.json");
const mockEvents = JSON.parse(fs.readFileSync(mockEventsPath, "utf8"));

// イベントをドキュメント形式に変換
const eventDocuments = mockEvents.map((event: any) => {
  return new Document({
    pageContent: `${event.title}\n${event.description}`,
    metadata: {
      id: event.id,
      title: event.title,
      eventDate: event.eventDate,
      location: event.location,
      format: event.format,
      difficulty: event.difficulty,
      categories: event.categories.join(", "),
      skills: event.skills.join(", "),
    },
  });
});

// LLMの初期化
const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.3,
});

// 埋め込みモデルの初期化
const embeddings = new OpenAIEmbeddings();

// ベクトルストアの初期化と文書の追加
let vectorStore: MemoryVectorStore;

const initVectorStore = async () => {
  vectorStore = await MemoryVectorStore.fromDocuments(
    eventDocuments,
    embeddings
  );
  console.log("ベクトルストアが初期化されました");
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
  - カテゴリ: 技術カテゴリやトピック（例: Web開発、AI、機械学習）
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
export const rankEventsForUser = async (
  location: string,
  skills: string[],
  interests: string[],
  skillLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
  goals: string[]
) => {
  // ベクトルストアが初期化されていない場合は初期化
  if (!vectorStore) {
    await initVectorStore();
  }

  // ユーザー情報
  const userInfo = {
    location,
    skills: skills.join(", "),
    interests: interests.join(", "),
    skillLevel,
    goals: goals.join(", "),
  };

  // HyDEチェーン: ユーザー情報からクエリを生成
  const hydeChain = RunnableSequence.from([
    hydePrompt,
    llm,
    new StringOutputParser(),
  ]);

  // 検索チェーン: DBからすべてのイベントを取得し、HyDEクエリで最近傍探索
  const retrievalChain = async (query: string) => {
    // DBからすべてのイベントを取得

    const allEvents = await getAllEvents();
    console.log(`DBから取得したイベント数: ${allEvents.length}`);

    // イベントをドキュメント形式に変換
    const eventDocs = allEvents.map((event) => {
      // カテゴリとスキルを安全に取得
      let categories = "";
      let skills = "";
      let speakers = "";
      let goals = "";

      try {
        // 安全にデータを取得
        if (event.categories && Array.isArray(event.categories)) {
          categories = event.categories
            .map((ec) => {
              if (
                ec &&
                typeof ec === "object" &&
                "category" in ec &&
                ec.category &&
                typeof ec.category === "object" &&
                "name" in ec.category
              ) {
                return ec.category.name;
              }
              return "";
            })
            .filter(Boolean)
            .join(", ");
        }

        if (event.skills && Array.isArray(event.skills)) {
          skills = event.skills
            .map((skill) =>
              skill && typeof skill === "object" && "name" in skill
                ? skill.name
                : ""
            )
            .filter(Boolean)
            .join(", ");
        }

        if (event.speakers && Array.isArray(event.speakers)) {
          speakers = event.speakers
            .map((es) => {
              if (
                es &&
                typeof es === "object" &&
                "speaker" in es &&
                es.speaker &&
                typeof es.speaker === "object" &&
                "name" in es.speaker
              ) {
                return es.speaker.name;
              }
              return "";
            })
            .filter(Boolean)
            .join(", ");
        }

        if (event.goals && Array.isArray(event.goals)) {
          goals = event.goals
            .map((goal) =>
              goal && typeof goal === "object" && "goalType" in goal
                ? goal.goalType
                : ""
            )
            .filter(Boolean)
            .join(", ");
        }
      } catch (error) {
        console.error("イベントデータのフォーマットエラー:", error);
      }

      // ドキュメントを作成
      return new Document({
        pageContent: `${event.title}\n${event.description || ""}`,
        metadata: {
          id: event.id,
          title: event.title,
          eventDate: event.eventDate,
          location: event.location || "",
          format: event.format,
          difficulty: event.difficulty,
          categories: categories,
          skills: skills,
          speakers: speakers,
          goals: goals,
        },
      });
    });

    // クエリを使って最近傍探索
    // 一時的なベクトルストアを作成
    const tempVectorStore = await MemoryVectorStore.fromDocuments(
      eventDocs,
      embeddings
    );
    const results = await tempVectorStore.similaritySearch(query, 50); // 上位50件を近い順で取得

    // 結果からイベントIDのリストだけを返す
    const eventIds = results.map((doc) => doc.metadata.id);
    return eventIds;
  };

  // 全体のRAG処理 - HyDEクエリ生成と最近傍探索のみを使用
  const processUserQuery = async (input: typeof userInfo) => {
    // HyDEクエリを生成
    const hydeQuery = await hydeChain.invoke(input);
    console.log("生成されたHyDEクエリ:", hydeQuery);

    // クエリを使って最近傍探索を実行し、イベントIDのリストを取得
    const eventIds = await retrievalChain(hydeQuery);
    console.log("ランキングされたイベントID:", eventIds);

    // イベントIDのリストをそのまま返す
    return eventIds;
  };

  // ユーザークエリを処理
  try {
    // ユーザー情報からイベントIDのリストを取得
    const eventIds = await processUserQuery(userInfo);

    // 結果が空の場合は空配列を返す
    if (!eventIds || eventIds.length === 0) {
      console.log("適合するイベントが見つかりませんでした");
      return [];
    }

    // 上位のイベントIDを取得
    console.log("選択されたイベントID:", eventIds[0]);

    return eventIds;
  } catch (error) {
    console.error("RAGチェーン実行エラー:", error);
    throw error;
  }
};
