import express from "express";
import { syncUser, testLogin } from "../controllers/authController";

const router = express.Router();

router.post("/sync", async (req, res, next) => {
  try {
    await syncUser(req, res);
  } catch (error) {
    next(error);
  }
});

// テストユーザー用ログインエンドポイント
router.post("/login", async (req, res, next) => {
  try {
    await testLogin(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
