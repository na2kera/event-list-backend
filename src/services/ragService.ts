import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "langchain/document";
import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import prisma from "../config/prisma";
import { getAllEvents } from "../utils/eventUtils";

// ベクトルストアの初期化
let vectorStore: MemoryVectorStore;

// イベント情報をベクトルストアに格納
export const initVectorStore = async () => {
  try {
    console.log("ベクトルストアを初期化しています...");
    
    // eventUtils.tsのgetAllEvents関数を使ってデータベースからイベント情報を取得
    // 関連データ（カテゴリ、スキル、スピーカー、ゴール）も含めて取得
    const events = await getAllEvents(true);

    console.log(`イベント数: ${events.length}`);

    // イベント情報をドキュメント形式に変換
    const docs = events.map(event => {
      // カテゴリとスキルを安全に取得
      let categories = "";
      let skills = "";
      let speakers = "";
      let goals = "";

      try {
        // 安全にデータを取得
        if (event.EventCategory && Array.isArray(event.EventCategory)) {
          categories = event.EventCategory.map((ec) => {
            if (
              ec &&
              typeof ec === "object" &&
              "Category" in ec &&
              ec.Category &&
              typeof ec.Category === "object" &&
              "name" in ec.Category
            ) {
              return ec.Category.name;
            }
            return "";
          })
            .filter(Boolean)
            .join(", ");
        }

        if (event.EventSkill && Array.isArray(event.EventSkill)) {
          skills = event.EventSkill.map((skill) =>
            skill && typeof skill === "object" && "name" in skill
              ? skill.name
              : ""
          )
            .filter(Boolean)
            .join(", ");
        }

        if (event.EventSpeaker && Array.isArray(event.EventSpeaker)) {
          speakers = event.EventSpeaker.map((es) => {
            if (
              es &&
              typeof es === "object" &&
              "Speaker" in es &&
              es.Speaker &&
              typeof es.Speaker === "object" &&
              "name" in es.Speaker
            ) {
              return es.Speaker.name;
            }
            return "";
          })
            .filter(Boolean)
            .join(", ");
        }

        if (event.EventGoal && Array.isArray(event.EventGoal)) {
          goals = event.EventGoal.map((goal) =>
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
          eventDate: event.eventDate ? new Date(event.eventDate).toLocaleDateString('ja-JP') : "未定",
          location: event.location || "オンライン",
          format: event.format || "未定",
          difficulty: event.difficulty || "初級",
          categories: categories,
          skills: skills,
          speakers: speakers,
          goals: goals,
        },
      });
    });

    // ベクトルストアの作成
    const embeddings = new OpenAIEmbeddings();
    vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    
    console.log("ベクトルストアの初期化が完了しました");
    return vectorStore;
  } catch (error) {
    console.error("ベクトルストア初期化エラー:", error);
    throw error;
  }
};

// RAGクエリの処理
export const processRagQuery = async (query: string) => {
  try {
    // ベクトルストアが初期化されていない場合は初期化
    if (!vectorStore) {
      await initVectorStore();
    }

    // LLMの初期化
    const llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.3,
    });

    // 回答生成用のプロンプト
    const answerPrompt = PromptTemplate.fromTemplate(`
あなたは学生エンジニア向けイベント情報を提供するアシスタントです。
以下のイベント情報を参考に、ユーザーの質問に日本語で答えてください。
イベントが見つからない場合や質問に答えられない場合は、正直にそう伝えてください。

イベント情報:
{context}

ユーザーの質問: {question}

回答:
`);

    // RAGチェーンの構築
    const chain = RunnableSequence.from([
      {
        context: async (input: { question: string }) => {
          // 関連するイベント情報を検索
          const docs = await vectorStore.similaritySearch(input.question, 3);
          return docs.map(doc => {
            const metadata = doc.metadata;
            return `タイトル: ${metadata.title}
開催日: ${metadata.eventDate}
場所: ${metadata.location}
形式: ${metadata.format}
難易度: ${metadata.difficulty}
カテゴリ: ${metadata.categories}
スキル: ${metadata.skills}
スピーカー: ${metadata.speakers || "未定"}
目標: ${metadata.goals || "未定"}
説明: ${doc.pageContent}
`;
          }).join("\n\n");
        },
        question: (input: { question: string }) => input.question,
      },
      answerPrompt,
      llm,
      new StringOutputParser(),
    ]);

    console.log(`RAGクエリを処理しています: "${query}"`);
    
    // クエリを処理して回答を生成
    const answer = await chain.invoke({ question: query });
    
    console.log("RAG回答を生成しました");
    return answer;
  } catch (error) {
    console.error("RAGクエリ処理エラー:", error);
    throw new Error(`RAGクエリの処理に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
};
