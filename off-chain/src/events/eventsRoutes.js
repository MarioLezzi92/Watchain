import { Router } from "express";
import { fireflyWebhook } from "./eventsController.js";

const router = Router();
router.post("/webhook", fireflyWebhook);

export default router;
