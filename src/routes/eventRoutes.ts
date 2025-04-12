import { Router } from "express";
import {
  getEvents,
  getEventById,
  createEvent,
  searchEvents,
  recommendEvents,
} from "../controllers/eventController";

const router = Router();

router.get("/", getEvents);
router.get("/search", searchEvents);
router.get("/:id", getEventById);
router.post("/", createEvent);
router.post("/recommend-batch", recommendEvents);

export default router;
