// authRoutes.js
import { Router } from "express";
import { getNonce, login, logout, me } from "./authController.js";
import { requireAuth } from "./requireAuth.js";

const router = Router();
router.get("/nonce", getNonce);
router.post("/login", login);
router.post("/logout", logout);


router.get("/me", requireAuth, me);

export default router;
