// backend/src/routes.js
import express from "express";
import { requireAuth } from "./jwt.js";
import { buildInventory } from "./inventory.js";
import {
  getActiveListings,
  listPrimary,
  listSecondary,
  buy,
  certify,
  approveLux,
  approveLuxMax,
  coinBalance,
  coinAllowance,
} from "./market.js";

const router = express.Router();

// CONFIG (public)
router.get("/config", (req, res) => {
  res.json({
    watchMarketAddress: process.env.WATCHMARKET_ADDRESS || "",
    watchNftAddress: process.env.WATCHNFT_ADDRESS || "",
    luxuryCoinAddress: process.env.LUXURYCOIN_ADDRESS || "",
  });
});

// INVENTORY
router.get("/inventory", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const address = req.user?.address; // attenzione: nel tuo JWT tu salvi address qui
    const out = await buildInventory(role, address);
    res.json(out);
  } catch (err) {
    console.error("INVENTORY FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// MARKET LISTINGS
router.get("/market/listings", requireAuth, async (req, res) => {
  try {
    const out = await getActiveListings();
    res.json(out);
  } catch (err) {
    console.error("LISTINGS FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// PRODUCER: listPrimary
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

// RESELLER: listSecondary
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

// COIN: approve (reseller/consumer)
router.post("/coin/approve", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { spender, amount } = req.body || {};
    const out = await approveLux(role, spender, amount);
    res.json(out);
  } catch (err) {
    console.error("APPROVE FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// COIN: approve MAX (reseller/consumer)
router.post("/coin/approveMax", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { spender } = req.body || {};
    const out = await approveLuxMax(role, spender);
    res.json(out);
  } catch (err) {
    console.error("APPROVE MAX FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// COIN: balance (self)
router.get("/coin/balance", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const address = req.user?.address;
    const bal = await coinBalance(role, address);
    res.json({ address, balance: bal });
  } catch (err) {
    console.error("BALANCE FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

// COIN: allowance (self -> WatchMarket)
router.get("/coin/allowance", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const owner = req.user?.address;
    const spender = process.env.WATCHMARKET_ADDRESS || "";
    const a = await coinAllowance(role, owner, spender);
    res.json({ owner, spender, allowance: a });
  } catch (err) {
    console.error("ALLOWANCE FAILED:", err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || err.message });
  }
});

export default router;
