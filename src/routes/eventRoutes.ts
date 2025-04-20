import { Router } from "express";
import {
  getEvents,
  getEventById,
  createEvent,
  searchEvents,
  recommendEvents,
  updateEvent,
} from "../controllers/eventController";

const router = Router();

router.get("/", getEvents);
router.get("/search", searchEvents);
router.get("/:id", getEventById);
router.post("/", createEvent);
// レコメンドイベントを決定して結果を出力するAPICAL
router.post("/recommend-batch", recommendEvents);
router.put("/:id", updateEvent);

export default router;
