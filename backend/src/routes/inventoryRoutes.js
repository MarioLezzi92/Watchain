import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import * as inventoryController from "../controllers/inventoryController.js";

const router = express.Router();

// Protegge tutte le rotte del file in un colpo solo
router.use(requireAuth);

router.get("/", inventoryController.getMyInventory);
router.post("/mint", inventoryController.mint);
router.post("/certify", inventoryController.certify);
router.post("/set-reseller", inventoryController.setReseller);
router.get("/is-reseller", inventoryController.checkReseller);
router.get('/status', inventoryController.getFactoryStatus);
router.post('/emergency', inventoryController.setFactoryEmergency);

export default router;