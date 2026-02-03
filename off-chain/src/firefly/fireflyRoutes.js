import express from "express";
import { proxyInvoke } from "../firefly/fireflyController.js";
import { requireAuth } from "../auth/requireAuth.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// CONFIGURAZIONE LIMITATORE
const invokeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 20,             // Max 20 richieste per IP al minuto
    message: { error: "Attenzione! Troppe transazioni in un minuto." },
    standardHeaders: true,
    legacyHeaders: false,
});

// APPLICAZIONE LIMITATORE 
router.post(
    "/invoke", 
    invokeLimiter, // Step 1: Check frequenza
    requireAuth,   // Step 2: Check identità
    proxyInvoke    // Step 3: Esecuzione 
);

export default router;