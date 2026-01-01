import express from "express";
import authRoutes from "./authRoutes.js";
import marketRoutes from "./marketRoutes.js";
import walletRoutes from "./walletRoutes.js";
import inventoryRoutes from "./inventoryRoutes.js"; // <--- Aggiungi questo

const router = express.Router();

router.get("/health", (req, res) => res.send("Backend OK"));

router.use("/auth", authRoutes);
router.use("/market", marketRoutes);
router.use("/wallet", walletRoutes);
router.use("/inventory", inventoryRoutes); // <--- E questo

export default router;