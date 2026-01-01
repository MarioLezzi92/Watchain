import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import * as walletController from "../controllers/walletController.js";

const router = express.Router();

router.get("/balance", requireAuth, walletController.getBalance);
// Solo il producer può chiamare questo endpoint, controllato nel Service
router.post("/transfer", requireAuth, walletController.transfer);

export default router;