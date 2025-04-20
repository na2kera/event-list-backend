import { Router } from "express";
import {
  sendLineNotification,
  sendEventRecommend,
  handleLineWebhook,
  processLineAuth,
  sendEventReminderNotifications,
} from "../controllers/lineController";

const router = Router();

// 特定のユーザーIDにLINE通知を送信するエンドポイント
router.post("/notify", sendLineNotification);

// 特定のユーザーIDにレコメンドイベントIDリストをもとにイベントカルーセルを送信するエンドポイント
router.post("/event-recommend", sendEventRecommend);

// LINEからのブックマーク追加を受け取るエンドポイント
router.post("/webhook", handleLineWebhook);

// LINE認証コードからトークンとプロフィール情報を取得し、ユーザー情報を保存するエンドポイント
router.post("/auth", processLineAuth);

// 1週間後に開催されるイベントをブックマークしているユーザーにリマインドメッセージを送信するエンドポイント
router.post("/send-reminders", sendEventReminderNotifications);

export default router;
