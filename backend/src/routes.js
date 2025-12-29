// backend/src/routes.js
import express from "express";
import { requireAuth } from "./auth.js";
import { getLuxBalanceWei, weiToLuxString } from "./wallet.js";
import { buildInventory } from "./inventory.js";
import {
  getActiveListings,
  listPrimary,
  listSecondary,
  buy,
  certify,
  approveLux,
  mintNft,

  // NEW (security patterns + pull payments)
  cancelListing,
  withdraw,
  pauseNft,
  unpauseNft,
  pauseMarket,
  unpauseMarket,
  setReseller,
  recoverETH,
  recoverERC20,
  transferLux,
  fundWhitelist
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

router.get("/wallet/balance", requireAuth, async (req, res) => {
  try {
    const address = req.user?.sub;
    const wei = await getLuxBalanceWei(address);
    res.json({
      address,
      wei,
      lux: weiToLuxString(wei),
    });
  } catch (err) {
    console.error("BALANCE FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || "balance failed") });
  }
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

    // consumer vede solo SECONDARY
    if (role === "consumer") {
      return res.json(listings.filter((l) => String(l.saleType).toUpperCase() === "SECONDARY"));
    }
    res.json(listings);
  } catch (err) {
    console.error("MARKET LISTINGS FAILED:", err?.response?.data || err?.message || err);
    res.status(500).json({ error: String(err?.message || "market listings failed") });
  }
});


// ✅ Transfer LUX a un singolo address (producer only)
router.post("/luxury/transfer", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { to, amountLux } = req.body || {};
    const amountWei = `${String(amountLux ?? 0).trim()}000000000000000000`;
    const out = await transferLux(role, String(to).trim(), amountWei);
    res.json(out);
  } catch (err) {
    console.error("LUX TRANSFER FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

// ✅ Fund automatico: 100 LUX a tutti gli account in whitelist (producer only)
router.post("/luxury/fundWhitelist", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { amountLux } = req.body || {};
    const out = await fundWhitelist(role, amountLux ?? 100);
    res.json({ ok: true, count: out.length, results: out });
  } catch (err) {
    console.error("FUND WHITELIST FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});


// ✅ PRODUCER mint (WatchNFT.manufacture)
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

// ✅ BUY: il backend fa approve + buy (PullPayments)
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

// -------------------- NEW endpoints --------------------

// Cancel listing (seller = producer/reseller)
router.post("/market/cancelListing", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { tokenId } = req.body || {};
    const out = await cancelListing(role, tokenId);
    res.json(out);
  } catch (err) {
    console.error("CANCEL LISTING FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

// Withdraw credits (PullPayments) — seller incassa qui
router.post("/market/withdraw", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const out = await withdraw(role);
    res.json(out);
  } catch (err) {
    console.error("WITHDRAW FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

// EmergencyStop: pause/unpause NFT (onlyOwner -> producer)
router.post("/nft/pause", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const out = await pauseNft(role);
    res.json(out);
  } catch (err) {
    console.error("NFT PAUSE FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

router.post("/nft/unpause", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const out = await unpauseNft(role);
    res.json(out);
  } catch (err) {
    console.error("NFT UNPAUSE FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

// EmergencyStop: pause/unpause Market (onlyOwner -> producer)
router.post("/market/pause", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const out = await pauseMarket(role);
    res.json(out);
  } catch (err) {
    console.error("MARKET PAUSE FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

router.post("/market/unpause", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const out = await unpauseMarket(role);
    res.json(out);
  } catch (err) {
    console.error("MARKET UNPAUSE FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

// Whitelist reseller (WatchNFT.setReseller) — onlyOwner -> producer
router.post("/nft/setReseller", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { who, enabled } = req.body || {};
    const out = await setReseller(role, who, enabled);
    res.json(out);
  } catch (err) {
    console.error("SET RESELLER FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

// Recovery functions (onlyOwner whenPaused) — producer/admin
router.post("/market/recoverETH", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { to, amount } = req.body || {};
    const out = await recoverETH(role, to, amount);
    res.json(out);
  } catch (err) {
    console.error("RECOVER ETH FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

router.post("/market/recoverERC20", requireAuth, async (req, res) => {
  try {
    const role = req.user?.role;
    const { token, to, amount } = req.body || {};
    const out = await recoverERC20(role, token, to, amount);
    res.json(out);
  } catch (err) {
    console.error("RECOVER ERC20 FAILED:", err?.response?.data || err?.message || err);
    res.status(400).json({ error: String(err?.message || JSON.stringify(err?.response?.data || err)) });
  }
});

export default router;
