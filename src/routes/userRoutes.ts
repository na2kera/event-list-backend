import { Router } from "express";
import {
  lineLogin,
  getUserProfile,
  updateUserProfile,
} from "../controllers/userController";

const router = Router();

// LINEログイン処理
router.post("/line-login", lineLogin);

// ユーザープロフィール取得
router.get("/:userId", getUserProfile);

// ユーザープロフィール更新
router.put("/:userId", updateUserProfile);

export default router;
