import express from "express";
import * as authController from "../controllers/authController.js";

const router = express.Router();

// Public Routes
router.get("/nonce", authController.getNonce);
router.get("/config", authController.getConfig);

router.post("/login", authController.login);
router.post("/logout", authController.logout);

export default router;