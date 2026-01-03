import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import * as walletController from "../controllers/walletController.js";

const router = express.Router();

// Tutte le operazioni sul wallet richiedono login
router.use(requireAuth);

router.get("/balance", walletController.getBalance);
router.post("/transfer", walletController.transfer);

export default router;