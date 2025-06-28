import { Router } from "express";
import {
  searchConnpassEvents,
  getConnpassEventById,
  getUpcomingConnpassEvents,
  syncUpcomingConnpassEvents,
} from "../controllers/connpassController";

const router = Router();

/**
 * @route   GET /api/connpass/search
 * @desc    Connpassイベントを検索する
 * @access  Public
 */
router.get("/search", searchConnpassEvents);

/**
 * @route   GET /api/connpass/event/:id
 * @desc    指定されたIDのConnpassイベントを取得する
 * @access  Public
 */
router.get("/event/:id", getConnpassEventById);

/**
 * @route   GET /api/connpass/upcoming
 * @desc    今後開催されるConnpassイベントを取得する
 * @access  Public
 */
router.get("/upcoming", getUpcomingConnpassEvents);

/**
 * @route   POST /api/connpass/sync
 * @desc    Connpassイベントを同期する
 * @access  Public
 */
router.post("/sync", syncUpcomingConnpassEvents);

export default router;
