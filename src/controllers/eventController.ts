import { Request, Response, NextFunction } from "express";
import { RequestHandler } from "express";
import prisma from "../config/prisma";
import { Prisma } from "@prisma/client";

export const getEvents: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // クエリパラメータからイベントタイプを取得
    const { eventType } = req.query;
    
    // フィルタリング条件を構築
    const where: any = {};
    
    // イベントタイプが指定されている場合、フィルタ条件に追加
    if (eventType && eventType !== 'すべて') {
      // 日本語からEnum値へのマッピング
      const eventTypeMapping: Record<string, string> = {
        'ハッカソン': 'HACKATHON',
        'ワークショップ': 'WORKSHOP',
        'コンテスト': 'CONTEST',
        'LT会': 'LIGHTNING_TALK'
      };
      
      // マッピングされた値があればそれを使用、なければそのまま使用
      const eventTypeValue = eventTypeMapping[eventType as string] || eventType;
      where.eventType = eventTypeValue;
    }
    
    const events = await prisma.event.findMany({
      where,
      include: {
        organization: true,
        skills: true,
        speakers: {
          include: {
            speaker: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        eventDate: "asc",
      },
    });
    
    // フロントエンドの要件に合わせたレスポンス形式
    res.status(200).json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('イベント一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "サーバー内部でエラーが発生しました"
    });
  }
};

export const getEventById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // イベント詳細をリレーションデータも含めて取得
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organization: true,
        skills: true,
        speakers: {
          include: {
            speaker: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!event) {
      res.status(404).json({ 
        success: false, 
        error: "Event not found", 
        message: "指定されたイベントが見つかりませんでした" 
      });
      return;
    }

    // フロントエンドの要件に合わせたレスポンス形式
    res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('イベント詳細取得エラー:', error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "イベント詳細の取得中にエラーが発生しました"
    });
  }
};

export const createEvent: RequestHandler = async (req, res, next) => {
  try {
    const event = await prisma.event.create({
      data: {
        title: req.body.title,
        description: req.body.description,
        eventDate: new Date(req.body.eventDate),
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        venue: req.body.venue,
        address: req.body.address,
        location: req.body.location,
        detailUrl: req.body.detailUrl,
        image: req.body.image,
        organizationId: req.body.organizationId,
        skills: {
          create: req.body.skills?.map((skill: { name: string }) => ({
            name: skill.name,
          })),
        },
        speakers: {
          create: req.body.speakers?.map((speaker: { speakerId: string }) => ({
            speakerId: speaker.speakerId,
          })),
        },
        categories: {
          create: req.body.categories?.map(
            (category: { categoryId: string }) => ({
              categoryId: category.categoryId,
            })
          ),
        },
      },
      include: {
        organization: true,
        skills: true,
        speakers: {
          include: {
            speaker: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });
    res.json(event);
  } catch (error) {
    next(error);
  }
};

/**
 * イベント検索API
 * 複数の検索条件に対応し、条件に合致するイベントを返す
 */
export const searchEvents: RequestHandler = async (req, res, next) => {
  try {
    const {
      keyword,           // タイトルや説明文のキーワード検索
      startDate,         // 開始日
      endDate,           // 終了日
      categories,        // カテゴリID（複数可）
      skills,            // スキル名（複数可）
      location,          // 開催場所
      organizationId     // 主催団体ID
    } = req.query;

    // 検索条件を構築
    const where: Prisma.EventWhereInput = {};
    
    // キーワード検索（タイトルまたは説明文に含まれる）
    if (keyword && typeof keyword === 'string') {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } }
      ];
    }
    
    // 日付範囲検索
    if (startDate || endDate) {
      where.eventDate = {};
      
      if (startDate && typeof startDate === 'string') {
        where.eventDate.gte = new Date(startDate);
      }
      
      if (endDate && typeof endDate === 'string') {
        where.eventDate.lte = new Date(endDate);
      }
    }
    
    // 開催場所検索
    if (location && typeof location === 'string') {
      where.OR = [
        ...(where.OR || []),
        { venue: { contains: location, mode: 'insensitive' } },
        { address: { contains: location, mode: 'insensitive' } },
        { location: { contains: location, mode: 'insensitive' } }
      ];
    }
    
    // 主催団体検索
    if (organizationId && typeof organizationId === 'string') {
      where.organizationId = organizationId;
    }
    
    // カテゴリ検索（複数指定可能）
    if (categories) {
      const categoryIds = Array.isArray(categories) 
        ? categories 
        : [categories];
      
      if (categoryIds.length > 0) {
        where.categories = {
          some: {
            categoryId: { in: categoryIds as string[] }
          }
        };
      }
    }
    
    // スキル検索（複数指定可能）
    if (skills) {
      const skillNames = Array.isArray(skills) 
        ? skills 
        : [skills];
      
      if (skillNames.length > 0) {
        where.skills = {
          some: {
            name: { in: skillNames as string[] }
          }
        };
      }
    }

    // イベントを検索
    const events = await prisma.event.findMany({
      where,
      include: {
        organization: true,
        skills: true,
        speakers: {
          include: {
            speaker: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        eventDate: 'asc',
      },
    });

    // フロントエンドの要件に合わせたレスポンス形式
    res.status(200).json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('イベント検索エラー:', error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "イベント検索中にエラーが発生しました"
    });
  }
};
