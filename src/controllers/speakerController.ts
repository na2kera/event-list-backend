import { Request, Response } from "express";
import prisma from "../config/prisma";

export const getSpeakers = async (req: Request, res: Response) => {
  try {
    const speakers = await prisma.speaker.findMany({
      orderBy: {
        name: "asc",
      },
    });
    res.json(speakers);
  } catch (error) {
    console.error("Error fetching speakers:", error);
    res.status(500).json({ error: "Error fetching speakers" });
  }
};

export const createSpeaker = async (req: Request, res: Response) => {
  try {
    const speaker = await prisma.speaker.create({
      data: {
        name: req.body.name,
        occupation: req.body.occupation,
        affiliation: req.body.affiliation,
        bio: req.body.bio,
      },
    });
    res.json(speaker);
  } catch (error) {
    console.error("Error creating speaker:", error);
    res.status(500).json({ error: "Error creating speaker" });
  }
};
