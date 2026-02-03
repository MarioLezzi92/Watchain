import { Router } from "express";
import { fireflyWebhook } from "./eventsController.js";

const router = Router();

// Endpoint esposto per la ricezione eventi da FireFly.
// La sicurezza è gestita internamente tramite verifica header Secret.
router.post("/webhook", fireflyWebhook);

export default router;