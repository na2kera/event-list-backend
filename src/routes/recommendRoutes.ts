import { Router } from "express";
import {
  recommendByUser,
  recommendByTag,
} from "../controllers/recommendController";

const router = Router();

router.post("/user", recommendByUser);
router.post("/tag", recommendByTag);

export default router;
