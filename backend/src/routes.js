// backend/src/routes.js
import express from "express";
import { requireAuth } from "./auth.js";
import { buildInventory } from "./inventory.js";
import {
  getActiveListings,
  listPrimary,
  listSecondary,
  buy,
  certify,
} from "./market.js";

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

// MARKET LISTINGS SEEDED FROM EVENTS
router.get("/market/listings", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const listings = await getActiveListings();

    // consumer vede solo SECONDARY (per UX, comunque lo smart contract impedisce altro)
    if (String(role || "").toLowerCase() === "consumer") {
      return res.json(listings.filter((l) => l.saleType === "SECONDARY"));
    }

    res.json(listings);
  } catch (err) {
    console.error("MARKET LISTINGS FAILED:", err.response?.data || err.message);
    res.status(500).json({ error: "market listings failed" });
  }
});

// PRODUCER: list PRIMARY
router.post("/market/listPrimary", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { tokenId, price } = req.body || {};
    const out = await listPrimary(role, tokenId, price);
    res.json(out);
  } catch (err) {
    console.error("LIST PRIMARY FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// RESELLER: list SECONDARY
router.post("/market/listSecondary", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { tokenId, price } = req.body || {};
    const out = await listSecondary(role, tokenId, price);
    res.json(out);
  } catch (err) {
    console.error("LIST SECONDARY FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// RESELLER/CONSUMER: buy
router.post("/market/buy", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { tokenId } = req.body || {};
    const out = await buy(role, tokenId);
    res.json(out);
  } catch (err) {
    console.error("BUY FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// RESELLER: certify
router.post("/nft/certify", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { tokenId } = req.body || {};
    const out = await certify(role, tokenId);
    res.json(out);
  } catch (err) {
    console.error("CERTIFY FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

export default router;
