import { Router } from "express";
import {
  getEvents,
  getEventById,
  createEvent,
  searchEvents,
  updateEvent,
} from "../controllers/eventController";

const router = Router();

router.get("/", getEvents);
router.get("/search", searchEvents);
router.get("/:id", getEventById);
router.post("/", createEvent);
router.put("/:id", updateEvent);

export default router;
