import express from "express";
import {
  addBookmark,
  removeBookmark,
  getUserBookmarks,
} from "../controllers/bookmarkController";

const router = express.Router();

// ブックマークの追加
router.post("/", addBookmark);

// ブックマークの削除
router.delete("/:userId/:eventId", removeBookmark);

// ユーザーのブックマーク一覧取得
router.get("/user/:userId", getUserBookmarks);

export default router;
