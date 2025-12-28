// backend/src/routes.js
import express from "express";
import { requireAuth } from "./jwt.js";
import { buildInventory } from "./inventory.js";
import { approveLux } from "./market.js";
import { getActiveListings, listPrimary, listSecondary, buy, certify } from "./market.js";

const router = express.Router();

// sanity
router.get("/me", requireAuth, (req, res) => {
  res.json({ address: req.user?.address, role: req.user?.role });
});

// INVENTORY
router.get("/inventory", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const address = req.user?.address;
    const out = await buildInventory(role, address);
    res.json(out);
  } catch (err) {
    console.error("INVENTORY FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// MARKET: listings
router.get("/market/listings", requireAuth, async (req, res) => {
  try {
    const out = await getActiveListings();
    res.json(out);
  } catch (err) {
    console.error("LISTINGS FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// PRODUCER: list primary
router.post("/market/listPrimary", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { tokenId, price } = req.body || {};
    const out = await listPrimary(role, tokenId, price);
    res.json(out);
  } catch (err) {
    console.error("LIST_PRIMARY FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// RESELLER: list secondary
router.post("/market/listSecondary", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { tokenId, price } = req.body || {};
    const out = await listSecondary(role, tokenId, price);
    res.json(out);
  } catch (err) {
    console.error("LIST_SECONDARY FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// BUY (reseller/consumer)
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

router.post("/coin/approve", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { spender, amount } = req.body || {};
    const out = await approveLux(role, spender, amount);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.response?.data || err.message });
  }
});


export default router;
