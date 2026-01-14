import express from "express";
import { handleFireFlyWebhook } from "../controllers/eventsController.js";

const router = express.Router();

router.post("/firefly-webhook", handleFireFlyWebhook);

export default router;