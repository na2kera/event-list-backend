import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { ClickLogData, ClickLogQueryParams, ClickLogStats } from "../types/clickLog";
import { z } from "zod";

const prisma = new PrismaClient();

// Validation schemas
const clickLogSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  elementType: z.string().optional(),
  elementId: z.string().optional(),
  elementClass: z.string().optional(),
  elementText: z.string().optional(),
  pageUrl: z.string().url(),
  pagePath: z.string(),
  coordinateX: z.number().int().optional(),
  coordinateY: z.number().int().optional(),
  userAgent: z.string().optional(),
  referrer: z.string().optional(),
  eventId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const queryParamsSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  pageUrl: z.string().optional(),
  pagePath: z.string().optional(),
  elementType: z.string().optional(),
  eventId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().transform((val) => parseInt(val, 10)).optional(),
  offset: z.string().transform((val) => parseInt(val, 10)).optional(),
});

// Helper function to get client IP
const getClientIp = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

export const createClickLog = async (req: Request, res: Response) => {
  try {
    const validatedData = clickLogSchema.parse(req.body);
    
    const clickLogData: ClickLogData = {
      ...validatedData,
      userAgent: req.headers["user-agent"],
      ipAddress: getClientIp(req),
    };

    const clickLog = await prisma.clickLog.create({
      data: clickLogData,
    });

    res.status(201).json({
      success: true,
      data: clickLog,
    });
  } catch (error: unknown) {
    console.error("Error creating click log:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create click log",
    });
  }
};

export const getClickLogs = async (req: Request, res: Response) => {
  try {
    const validatedParams = queryParamsSchema.parse(req.query);
    
    const {
      userId,
      sessionId,
      pageUrl,
      pagePath,
      elementType,
      eventId,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = validatedParams;

    const where: any = {};
    
    if (userId) where.userId = userId;
    if (sessionId) where.sessionId = sessionId;
    if (pageUrl) where.pageUrl = { contains: pageUrl };
    if (pagePath) where.pagePath = { contains: pagePath };
    if (elementType) where.elementType = elementType;
    if (eventId) where.eventId = eventId;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [clickLogs, total] = await Promise.all([
      prisma.clickLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          Event: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      prisma.clickLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: clickLogs,
      pagination: {
        total,
        limit,
        offset,
        hasNext: offset + limit < total,
        hasPrev: offset > 0,
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching click logs:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch click logs",
    });
  }
};

export const getClickLogStats = async (req: Request, res: Response) => {
  try {
    const validatedParams = queryParamsSchema.parse(req.query);
    const { startDate, endDate, userId, eventId } = validatedParams;

    const where: any = {};
    
    if (userId) where.userId = userId;
    if (eventId) where.eventId = eventId;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [
      totalClicks,
      uniqueUsers,
      uniqueSessions,
      topPages,
      topElements,
    ] = await Promise.all([
      // Total clicks
      prisma.clickLog.count({ where }),
      
      // Unique users
      prisma.clickLog.findMany({
        where: { ...where, userId: { not: null } },
        select: { userId: true },
        distinct: ["userId"],
      }).then((result) => result.length),
      
      // Unique sessions
      prisma.clickLog.findMany({
        where: { ...where, sessionId: { not: null } },
        select: { sessionId: true },
        distinct: ["sessionId"],
      }).then((result) => result.length),
      
      // Top pages
      prisma.clickLog.groupBy({
        by: ["pageUrl"],
        where,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }).then((result) =>
        result.map((item) => ({
          pageUrl: item.pageUrl,
          count: item._count.id,
        }))
      ),
      
      // Top elements
      prisma.clickLog.groupBy({
        by: ["elementType", "elementText"],
        where: { ...where, elementType: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }).then((result) =>
        result.map((item) => ({
          elementType: item.elementType || "unknown",
          elementText: item.elementText,
          count: item._count.id,
        }))
      ),
    ]);

    const stats: ClickLogStats = {
      totalClicks,
      uniqueUsers,
      uniqueSessions,
      topPages,
      topElements,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: unknown) {
    console.error("Error fetching click log stats:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch click log stats",
    });
  }
};

export const deleteOldClickLogs = async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.body;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const deletedCount = await prisma.clickLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    res.json({
      success: true,
      message: `Deleted ${deletedCount.count} old click logs`,
      deletedCount: deletedCount.count,
    });
  } catch (error: unknown) {
    console.error("Error deleting old click logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete old click logs",
    });
  }
};