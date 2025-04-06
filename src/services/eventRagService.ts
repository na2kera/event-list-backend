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

// 構造化出力パーサーの作成
const outputParser = StructuredOutputParser.fromZodSchema(
  eventRecommendationSchema
);

// パーサーのフォーマット手順を取得
const formatInstructions = outputParser.getFormatInstructions();

// 検索結果のフォーマット用プロンプト
const resultFormatterPrompt = PromptTemplate.fromTemplate(`
以下のユーザー情報と検索結果に基づいて、最も関連性の高いイベントを1つ選択してください。

ユーザー情報:
- 居住地: {location}
- 技術スタック: {skills}
- 興味のあるトピック: {interests}

検索結果:
{searchResults}

各イベントについて、ユーザーとの関連性を評価し、最も関連性の高いイベントを1つ選択してください。

評価基準:
1. ユーザーの技術スタックとの関連性
2. ユーザーの興味あるトピックとの関連性
3. イベントの場所（オンラインまたはユーザーの居住地に近いか）

{format_instructions}
`);

// ユーザー情報に基づいてイベントを検索するRAGチェーン
export const searchEventsForUser = async (
  location: string,
  skills: string[],
  interests: string[]
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
  };

  // HyDEチェーン: ユーザー情報からクエリを生成
  const hydeChain = RunnableSequence.from([
    hydePrompt,
    llm,
    new StringOutputParser(),
  ]);

  // 検索チェーン: 生成されたクエリでベクトル検索
  const retrievalChain = async (query: string) => {
    const results = await vectorStore.similaritySearch(query, 5);
    return {
      searchResults: results
        .map(
          (doc) =>
            `ID: ${doc.metadata.id}\nタイトル: ${doc.metadata.title}\n説明: ${doc.pageContent}\n場所: ${doc.metadata.location}\n難易度: ${doc.metadata.difficulty}\nカテゴリ: ${doc.metadata.categories}\nスキル: ${doc.metadata.skills}\n\n`
        )
        .join(""),
      format_instructions: formatInstructions, // フォーマット手順を追加
    };
  };

  // 結果フォーマットチェーン: 検索結果をランク付け
  const formatterChain = RunnableSequence.from([
    resultFormatterPrompt,
    llm,
    outputParser, // 構造化出力パーサーを使用
  ]);

  // 全体のRAGチェーン
  const ragChain = RunnableSequence.from([
    // ユーザー情報からHyDEクエリを生成
    async (input: typeof userInfo) => {
      const hydeQuery = await hydeChain.invoke(input);
      console.log("生成されたHyDEクエリ:", hydeQuery);

      // クエリを使って検索
      const retrievalResults = await retrievalChain(hydeQuery);

      // 検索結果とユーザー情報を結合
      return {
        ...input,
        ...retrievalResults,
      };
    },
    // 検索結果をフォーマット
    formatterChain,
    // 構造化出力パーサーの結果を処理
    async (result) => {
      try {
        // resultはすでにJSONオブジェクトにパースされている
        console.log("構造化されたレスポンス:", result);

        // LLMが選んだイベントのIDを保持
        return [result];
      } catch (error) {
        console.error("レスポンス処理エラー:", error);
        return [];
      }
    },
  ]);

  // RAGチェーンを実行
  try {
    // LLMが選んだ最適なイベントを取得
    const llmResult = await ragChain.invoke(userInfo);

    // 結果が空の場合は空配列を返す
    if (!llmResult || llmResult.length === 0) {
      console.log("適合するイベントが見つかりませんでした");
      return [];
    }

    // LLMが選択したイベントのIDを取得
    const selectedEvent = llmResult[0];
    console.log("選択されたイベントID:", selectedEvent.id);

    // 元のイベントデータをIDで検索
    const originalEvent = mockEvents.find(
      (e: any) => e.id === selectedEvent.id
    );
    if (!originalEvent) {
      console.log(`ID ${selectedEvent.id} のイベントが見つかりません`);
      return [selectedEvent]; // 元データが見つからない場合はランキング情報のみを返す
    }

    // 元のイベントデータとランキング情報を結合したオブジェクトを1つだけ返す
    return [
      {
        ...originalEvent,
        relevanceScore: selectedEvent.relevanceScore,
        relevanceReason: selectedEvent.relevanceReason,
      },
    ];
  } catch (error) {
    console.error("RAGチェーン実行エラー:", error);
    throw error;
  }
};
