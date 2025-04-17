import { Router } from "express";
import { sendLineNotification } from "../controllers/lineController";

const router = Router();

// 特定のユーザーIDにLINE通知を送信するエンドポイント
router.post("/notify", sendLineNotification);

export default router;
