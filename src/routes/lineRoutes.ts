import { Router } from "express";
import { 
  sendLineNotification, 
  sendEventCarousel, 
  handleLineWebhook 
} from "../controllers/lineController";

const router = Router();

// 特定のユーザーIDにLINE通知を送信するエンドポイント
router.post("/notify", sendLineNotification);

// 特定のユーザーIDにイベントカルーセルを送信するエンドポイント
router.post("/event-carousel", sendEventCarousel);

// LINEのWebhookを処理するエンドポイント
router.post("/webhook", handleLineWebhook);

export default router;
