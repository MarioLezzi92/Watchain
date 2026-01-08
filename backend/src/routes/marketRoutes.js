import express from "express";
import * as marketController from "../controllers/marketController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Rotte Pubbliche (Tutti possono vedere cosa c'è in vendita)
router.get("/listings", marketController.getListings);

// Da qui in poi, tutte le rotte richiedono autenticazione
router.use(requireAuth);

router.get("/approval-status", marketController.getApprovalStatus);
router.post("/approve-market", marketController.requestApproval);

router.post("/buy", marketController.buy);
router.post("/listPrimary", marketController.listPrimary);
router.post("/listSecondary", marketController.listSecondary);
router.post("/cancel", marketController.cancelListing);

router.get("/credits", marketController.getCredits);
router.post("/withdraw", marketController.withdraw);

router.get('/status', marketController.getEmergencyStatus);
router.post('/emergency', marketController.setEmergencyStop);

export default router;