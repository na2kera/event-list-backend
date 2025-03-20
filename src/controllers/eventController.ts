import { Request, Response, NextFunction } from "express";
import { RequestHandler } from "express";
import prisma from "../config/prisma";

export const getEvents = async (
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
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(event);
  } catch (error) {
    next(error);
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
