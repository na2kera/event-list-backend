import { Router } from "express";
import {
  getEvents,
  getEventById,
  createEvent,
  searchEvents
} from "../controllers/eventController";

const router = Router();

router.get("/", getEvents);
router.get("/search", searchEvents);
router.get("/:id", getEventById);
router.post("/", createEvent);

export default router;
