import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import * as inventoryController from "../controllers/inventoryController.js";

const router = express.Router();

// Recupera i miei oggetti
router.get("/", requireAuth, inventoryController.getMyInventory);

// Azioni sugli oggetti
router.post("/mint", requireAuth, inventoryController.mint);
router.post("/certify", requireAuth, inventoryController.certify);

// Se avevi pause/unpause NFT, potresti aggiungerle qui o in un adminRoutes
// router.post("/pause", requireAuth, inventoryController.pause);

export default router;