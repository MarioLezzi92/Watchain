import express from "express";
import * as marketController from "../controllers/marketController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Rotte Pubbliche
router.get("/listings", marketController.getListings);

// Rotte Protette (Richiedono Login)
router.use(requireAuth);

// Nuove rotte per la sicurezza e approvazioni NFT
router.get("/approval-status", marketController.getApprovalStatus);
router.post("/approve-market", marketController.requestApproval);

// Operazioni di Mercato
router.post("/buy", marketController.buy);
router.post("/listPrimary", marketController.listPrimary);
router.post("/listSecondary", marketController.listSecondary);
router.post("/cancel", marketController.cancelListing);

// Gestione Crediti (Pattern PullPayments)
router.get("/credits", marketController.getCredits);
router.post("/withdraw", marketController.withdraw);

export default router;