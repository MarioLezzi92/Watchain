import express from "express";
import * as authController from "../controllers/authController.js";

const router = express.Router();

router.get("/nonce", authController.getNonce);
router.post("/login", authController.login);

export default router;