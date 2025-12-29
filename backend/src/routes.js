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
  approveLux,
  mintNft, // NEW
} from "./market.js";

const router = express.Router();

router.get("/debug/config", (req, res) => {
  res.json({
    port: process.env.PORT,
    watchmarket: process.env.WATCHMARKET_ADDRESS,
    producerBase: process.env.FF_PRODUCER_BASE,
    resellerBase: process.env.FF_RESELLER_BASE,
    consumerBase: process.env.FF_CONSUMER_BASE,
  });
});

router.get("/inventory", requireAuth, async (req, res) => {
  try {
    const address = req.user?.sub;
    const role = req.user?.role;
    const inv = await buildInventory(role, address);
    res.json(inv);
  } catch (err) {
    console.error("INVENTORY FAILED:", err?.response?.data || err?.message || err);
    res.status(500).json({ error: String(err?.message || "inventory failed") });
  }
});

router.get("/market/listings", requireAuth, async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const listings = await getActiveListings();

    if (role === "consumer") {
      return res.json(listings.filter((l) => String(l.saleType).toUpperCase() === "SECONDARY"));
    }
    res.json(listings);
  } catch (err) {
    console.error("MARKET LISTINGS FAILED:", err?.response?.data || err?.message || err);
    res.status(500).json({ error: String(err?.message || "market listings failed") });
  }
});

// ✅ NEW: PRODUCER mint
router.post("/nft/mint", requireAuth, async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "producer") throw new Error("Only producer can mint");

    const { to } = req.body || {};
    const out = await mintNft(to); // se to manca, mint al producer
    res.json(out);
  } catch (err) {
    console.error("MINT FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

router.post("/market/listPrimary", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { tokenId, price } = req.body || {};
    const out = await listPrimary(role, tokenId, price);
    res.json(out);
  } catch (err) {
    console.error("LIST PRIMARY FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

router.post("/market/listSecondary", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { tokenId, price } = req.body || {};
    const out = await listSecondary(role, tokenId, price);
    res.json(out);
  } catch (err) {
    console.error("LIST SECONDARY FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

router.post("/market/buy", requireAuth, async (req, res) => {
  const role = req.user?.role;
  const address = req.user?.sub;

  try {
    const { tokenId } = req.body || {};
    console.log("BUY REQ:", { role, address, body: req.body });
    const out = await buy(role, tokenId);
    console.log("BUY OK:", { tokenId: String(tokenId), outType: typeof out });
    res.json(out);
  } catch (err) {
    const data = err?.response?.data;
    console.error("BUY FAILED:", { role, address, body: req.body, message: err?.message, ff: data });
    res.status(400).json({ error: String(err?.message || (data ? JSON.stringify(data) : "buy failed")) });
  }
});

router.post("/luxury/approve", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { amountWei } = req.body || {};
    const out = await approveLux(role, amountWei);
    res.json(out);
  } catch (err) {
    console.error("APPROVE FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

router.post("/nft/certify", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { tokenId } = req.body || {};
    const out = await certify(role, tokenId);
    res.json(out);
  } catch (err) {
    console.error("CERTIFY FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

export default router;
