import express from "express";
import { requireAuth } from "./auth.js";
import { buildInventory } from "./inventory.js";
import { getActiveListings } from "./market.js";

const router = express.Router();

// INVENTORY
router.get("/inventory", requireAuth, async (req, res) => {
  try {
    const address = req.user?.sub;
    const role = req.user?.role;
    const inv = await buildInventory(role, address);
    res.json(inv);
  } catch (err) {
    console.error("INVENTORY FAILED:", err.response?.data || err.message);
    res.status(500).json({ error: "inventory failed" });
  }
});

// MARKET LISTINGS
router.get("/market/listings", requireAuth, async (req, res) => {
  try {
    const listings = await getActiveListings();
    res.json(listings);
  } catch (err) {
    console.error("MARKET LISTINGS FAILED:", err.response?.data || err.message);
    res.status(500).json({ error: "market listings failed" });
  }
});

export default router;
