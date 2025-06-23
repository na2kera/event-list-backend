import { Router } from "express";
import { recommendEventsForUser } from "../controllers/recommendController";

const router = Router();

// GET /api/recommend/:userId
router.get("/:userId", recommendEventsForUser);

export default router;
