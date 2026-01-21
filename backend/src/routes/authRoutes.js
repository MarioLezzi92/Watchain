import { Router } from "express";
import { getNonce, login, logout, checkReseller } from "../controllers/authController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/nonce", getNonce);
router.post("/login", login);
router.post("/logout", logout);

// Nuova rotta per il controllo stato
router.post("/check-reseller", checkReseller);

router.get("/me", requireAuth, (req, res) => {
  res.json({ success: true, ...req.user });
});

export default router;