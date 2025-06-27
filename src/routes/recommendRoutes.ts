import { Router } from "express";
import {
  recommendByUser,
  recommendByMessage,
} from "../controllers/recommendController";

const router = Router();

router.post("/user", recommendByUser);
router.post("/message", recommendByMessage);

export default router;
