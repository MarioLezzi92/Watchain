import * as marketService from "../services/marketService.js";
import * as inventoryService from "../services/inventoryService.js";

const isValidTokenId = (id) => id && /^\d+$/.test(String(id));
const isValidPrice = (p) => p && /^\d+$/.test(String(p)) && BigInt(p) > 0n;

// --- READ OPERATIONS ---

export const getListings = async (req, res) => {
  try {
    const listings = await marketService.getActiveListings();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: "Errore nel recupero dei listing." });
  }
};

export const getApprovalStatus = async (req, res) => {
  try {
    const isApproved = await marketService.checkNFTApproval(req.user.role, req.user.sub);
    res.json({ isApproved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getCredits = async (req, res) => {
  try {
    const credits = await marketService.getPendingCredits(req.user.role, req.user.sub);
    res.json({ address: req.user.sub, creditsWei: credits });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getLuxAllowance = async (req, res) => {
  try {
    const allowance = await marketService.getLuxAllowance(req.user.role, req.user.sub);
    res.json({ allowance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- WRITE OPERATIONS ---

export const requestApproval = async (req, res) => {
  try {
    const out = await marketService.approveMarketplace(req.user.role, req.user.sub);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const listPrimary = async (req, res) => {
  try {
    const { tokenId, price } = req.body;
    if (req.user.role !== 'producer') return res.status(403).json({ error: "Solo il Producer può listare orologi nuovi." });
    
    const out = await marketService.listPrimary(tokenId, price);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const listSecondary = async (req, res) => {
  try {
    const { tokenId, price } = req.body;
    const { role, sub: address } = req.user;

    if (!isValidTokenId(tokenId) || !isValidPrice(price)) {
        return res.status(400).json({ error: "Dati di vendita non validi." });
    }

    // NUOVO V2: Controllo certificazione prima del listing
    const isCertified = await marketService.isWatchCertified(tokenId);
    if (!isCertified) {
        return res.status(403).json({ error: "L'orologio deve essere certificato per il mercato secondario." });
    }

    const out = await marketService.listSecondary(role, tokenId, price, address);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const buy = async (req, res) => {
  try {
    const out = await marketService.buyItem(req.user.role, req.user.sub, req.body.tokenId);
    res.json(out);
  } catch (err) {
    let msg = err.message;
    if (msg.includes("Only reseller can buy primary")) msg = "Solo i Reseller possono acquistare nel primario.";
    if (msg.includes("Only consumer can buy secondary")) msg = "Solo i Consumer possono acquistare nel secondario.";
    res.status(400).json({ error: msg });
  }
};

export const withdraw = async (req, res) => {
  try {
    const out = await marketService.withdrawCredits(req.user.role, req.user.sub);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const approveLux = async (req, res) => {
  try {
    const out = await marketService.approveLux(req.user.role, req.user.sub);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getEmergencyStatus = async (req, res) => {
  try {
    const result = await marketService.getMarketStatus();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const setEmergencyStop = async (req, res) => {
  try {
    if (req.user.role !== 'producer') return res.status(403).json({ error: "Azione non autorizzata." });
    const result = await marketService.setMarketEmergency(req.body.status);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const cancelListing = async (req, res) => {
  try {
    const out = await marketService.cancelListing(req.user.role, req.body.tokenId, req.user.sub);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};