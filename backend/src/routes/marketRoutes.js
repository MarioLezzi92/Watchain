import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import * as marketController from "../controllers/marketController.js";

const router = express.Router();

// Pubblico (ma richiediamo auth per sapere il ruolo e filtrare)
router.get("/listings", requireAuth, marketController.getListings);

// Acquisto
router.post("/buy", requireAuth, marketController.buy);

// Vendita
router.post("/listPrimary", requireAuth, marketController.listPrimary);
router.post("/listSecondary", requireAuth, marketController.listSecondary);
router.post("/cancel", requireAuth, marketController.cancelListing);

// Gestione Fondi (PullPayments)
router.get("/credits", requireAuth, marketController.getCredits);
router.post("/withdraw", requireAuth, marketController.withdraw);

export default router;