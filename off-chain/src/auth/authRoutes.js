import { Router } from "express";
import { getNonce, login, refresh, logout, me } from "./authController.js";
import { requireAuth } from "./requireAuth.js";

const router = Router();

router.get("/nonce", getNonce);
router.post("/login", login);
router.post("/refresh", refresh);

// me e logout richiedono access cookie
router.get("/me", requireAuth, me);
router.post("/logout", requireAuth, logout);

export default router;
