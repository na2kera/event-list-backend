import { Router } from "express";
import { getSpeakers, createSpeaker } from "../controllers/speakerController";

const router = Router();

router.get("/", getSpeakers);
router.post("/", createSpeaker);

export default router;
