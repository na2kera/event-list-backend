import express from "express";
import { syncUser } from "../controllers/authController";

const router = express.Router();

router.post("/sync", async (req, res, next) => {
  try {
    await syncUser(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
