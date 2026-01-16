import express from "express";
import * as authController from "../controllers/authController.js";

const router = express.Router();

// Public Routes
router.get("/nonce", authController.getNonce);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/config", authController.getConfig);

export default router;