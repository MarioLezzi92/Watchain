import { Router } from "express";
import { getNonce, login, refresh, logout, me } from "./authController.js";
import { requireAuth } from "./requireAuth.js";

const router = Router();

// --- Rotte Pubbliche ---
// Fase 1 Login: Richiesta Nonce
router.get("/nonce", getNonce);
// Fase 2 Login: Verifica Firma e rilascio Cookie
router.post("/login", login);
// Rinnovo Sessione (usa Refresh Token cookie)
router.post("/refresh", refresh);

// --- Rotte Protette (Richiedono requireAuth) ---
// Verifica stato sessione corrente
router.get("/me", requireAuth, me);
// Logout (Revoca)
router.post("/logout", requireAuth, logout);

export default router;