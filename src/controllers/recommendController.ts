import { RequestHandler } from "express";
import { getUserWithDetailsById } from "../utils/userUtils";
import { getFilteredEvents } from "../utils/eventUtils";
import {
  recommendEventsWithKeyData,
  RecommendedEvent,
  EventKeyData,
} from "../utils/keyDataRecommendation";

/**
 * POST /api/recommend/user
 * body: { userId }
 * ユーザーの興味タグごとにレコメンドを返す
 */
export const recommendByUser: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ message: "userId は必須です" });
      return;
    }

    // ユーザー取得
    const user = await getUserWithDetailsById(userId);
    if (!user) {
      res
        .status(404)
        .json({ message: `ユーザー ${userId} が見つかりません。` });
      return;
    }

    const tags: string[] = (user.tag as any) || [];
    if (tags.length === 0) {
      res.status(200).json({ message: "興味タグが未設定", data: [] });
      return;
    }

    // 場所・形式で直接DBクエリ
    const locationRaw = (user.place || "").toString();
    const locLower = locationRaw.toLowerCase();
    const filterOpts: any = {};
    if (locationRaw) {
      if (locLower === "online") {
        filterOpts.format = "ONLINE"; // Prisma enum への一致を想定
      } else {
        filterOpts.location = locationRaw;
      }
    }

    const events = await getFilteredEvents(filterOpts);
    const eventKeyData: EventKeyData[] = events.map((ev: any) => ({
      id: ev.id,
      keyPhrases: ev.keyPhrases || [],
      keySentences: ev.keySentences || [],
      ...ev,
    }));

    if (eventKeyData.length === 0) {
      res
        .status(200)
        .json({ message: "該当する場所のイベントがありません。", data: [] });
      return;
    }

    const results: { tag: string; recommendations: RecommendedEvent[] }[] = [];
    for (const tag of tags) {
      const recs = await recommendEventsWithKeyData(tag, eventKeyData);
      results.push({ tag, recommendations: recs });
    }

    // 開発用ログ
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[recommendByUser] results:\n",
        JSON.stringify(results, null, 2)
      );
    }

    res.json(results);
    return;
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/recommend/message
 * body: { message, userId? }
 * フリーテキスト（メッセージ）でレコメンドを返す
 */
export const recommendByMessage: RequestHandler = async (req, res, next) => {
  try {
    const { userId, message } = req.body;
    if (!message) {
      res.status(400).json({ message: "message は必須です" });
      return;
    }

    // ユーザーが指定されている場合のみユーザー情報を取得し、場所フィルタを適用
    let filterOpts: any = {};
    if (userId) {
      const user = await getUserWithDetailsById(userId);
      if (!user) {
        res
          .status(404)
          .json({ message: `ユーザー ${userId} が見つかりません。` });
        return;
      }

      const locRaw = (user.place || "").toString();
      const locLower = locRaw.toLowerCase();
      if (locRaw) {
        if (locLower === "online") filterOpts.format = "ONLINE";
        else filterOpts.location = locRaw;
      }
    }
    // const events = await getFilteredEvents(filterOpts);
    // =====================
    // 一時モックイベント
    // =====================
    const events = [
      {
        id: "mock-1",
        title: "React 19 新機能ハンズオン",
        keyPhrases: ["React", "Hooks", "ハンズオン"],
        keySentences: ["React 19 の新機能を学ぶ", "実践ワークショップ"],
      },
      {
        id: "mock-2",
        title: "TypeScript 型安全プログラミング",
        keyPhrases: ["TypeScript", "型安全", "ワークショップ"],
        keySentences: ["高度な型システム", "実践セミナー"],
      },
      {
        id: "mock-3",
        title: "Next.js App Router 実践",
        keyPhrases: ["Next.js", "App Router"],
        keySentences: ["Next.js 14 の新機能"],
      },
      {
        id: "mock-4",
        title: "GraphQL サーバー構築",
        keyPhrases: ["GraphQL", "API"],
        keySentences: ["Apollo Server 入門"],
      },
      {
        id: "mock-5",
        title: "Prisma ORM 深掘り",
        keyPhrases: ["Prisma", "ORM"],
        keySentences: ["データベーススキーマ管理"],
      },
      {
        id: "mock-6",
        title: "Docker × Kubernetes ハンズオン",
        keyPhrases: ["Docker", "Kubernetes"],
        keySentences: ["コンテナオーケストレーション"],
      },
      {
        id: "mock-7",
        title: "AWS CDK Workshop",
        keyPhrases: ["AWS", "CDK"],
        keySentences: ["Infrastructure as Code"],
      },
      {
        id: "mock-8",
        title: "Python データサイエンス基礎",
        keyPhrases: ["Python", "Pandas"],
        keySentences: ["データ分析入門"],
      },
      {
        id: "mock-9",
        title: "Go マイクロサービス設計",
        keyPhrases: ["Go", "Microservices"],
        keySentences: ["gRPC 連携"],
      },
      {
        id: "mock-10",
        title: "Rust 初心者向け勉強会",
        keyPhrases: ["Rust", "Ownership"],
        keySentences: ["安全性の高いシステム開発"],
      },
      {
        id: "mock-11",
        title: "Flutter モバイル開発",
        keyPhrases: ["Flutter", "Dart"],
        keySentences: ["クロスプラットフォーム"],
      },
      {
        id: "mock-12",
        title: "Node.js 性能チューニング",
        keyPhrases: ["Node.js", "Performance"],
        keySentences: ["プロファイリング手法"],
      },
      {
        id: "mock-13",
        title: "Graph Neural Network 入門",
        keyPhrases: ["GNN", "DeepLearning"],
        keySentences: ["グラフ構造データ解析"],
      },
      {
        id: "mock-14",
        title: "ChatGPT API 活用ハッカソン",
        keyPhrases: ["ChatGPT", "OpenAI"],
        keySentences: ["生成 AI アプリ開発"],
      },
      {
        id: "mock-15",
        title: "Web3 Solidity Workshop",
        keyPhrases: ["Solidity", "SmartContract"],
        keySentences: ["Ethereum DApp 開発"],
      },
    ];

    const eventKeyData: EventKeyData[] = events.map((ev: any) => ({
      id: ev.id,
      keyPhrases: ev.keyPhrases || [],
      keySentences: ev.keySentences || [],
      ...ev,
    }));

    if (eventKeyData.length === 0) {
      res
        .status(200)
        .json({ message: "該当する場所のイベントがありません。", data: [] });
      return;
    }

    const recommendations = await recommendEventsWithKeyData(
      message,
      eventKeyData
    );

    // 開発用ログ
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[recommendByMessage] message=\"${message}\" recommendations:\n`,
        JSON.stringify(recommendations, null, 2)
      );
    }

    res.json({ query: message, recommendations });
    return;
  } catch (err) {
    next(err);
  }
};
