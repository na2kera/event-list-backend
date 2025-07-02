import express from "express";
import {
  createClickLog,
  getClickLogs,
  getClickLogStats,
  deleteOldClickLogs,
} from "../controllers/clickLogController";

const router = express.Router();

// POST /api/click-logs - Create a new click log entry
router.post("/", createClickLog);

// GET /api/click-logs - Get click logs with optional filtering
router.get("/", getClickLogs);

// GET /api/click-logs/stats - Get click log statistics
router.get("/stats", getClickLogStats);

// DELETE /api/click-logs/cleanup - Delete old click logs (admin only)
router.delete("/cleanup", deleteOldClickLogs);

export default router;