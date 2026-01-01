import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import * as marketController from "../controllers/marketController.js";

const router = express.Router();

// --- MODIFICA QUI SOTTO ---
// Chiunque (anche senza login) può chiedere la lista degli orologi.
router.get("/listings", marketController.getListings);

// --- LE ALTRE ROTTE RESTANO PROTETTE ---
// Solo chi è loggato può comprare
router.post("/buy", requireAuth, marketController.buy);

// Solo chi è loggato può vendere
router.post("/listPrimary", requireAuth, marketController.listPrimary);
router.post("/listSecondary", requireAuth, marketController.listSecondary);
router.post("/cancel", requireAuth, marketController.cancelListing);

// Solo chi è loggato può vedere e prelevare i propri crediti
router.get("/credits", requireAuth, marketController.getCredits);
router.post("/withdraw", requireAuth, marketController.withdraw);

export default router;