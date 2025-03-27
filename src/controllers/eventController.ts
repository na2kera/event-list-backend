import { Request, Response, NextFunction } from "express";
import { RequestHandler } from "express";
import prisma from "../config/prisma";

export const getEvents: RequestHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const events = await prisma.event.findMany({
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
    res.json(events);
  } catch (error) {
    next(error);
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
