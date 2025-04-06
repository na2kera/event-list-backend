import { Router } from "express";
import { searchEventsByUserProfile, getAllMockEvents } from "../controllers/ragController";

const router = Router();

// RAGを使用したイベント検索エンドポイント
router.post("/search", searchEventsByUserProfile);

// デバッグ用: 全てのモックイベントを取得
router.get("/events", getAllMockEvents);

export default router;
