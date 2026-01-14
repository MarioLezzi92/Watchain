import * as marketService from "../services/marketService.js";
import * as inventoryService from "../services/inventoryService.js";

export const getApprovalStatus = async (req, res) => {
  try {
    const isApproved = await marketService.checkNFTApproval(req.user.role, req.user.sub);
    res.json({ isApproved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export const requestApproval = async (req, res) => {
  try {
    const { role, sub: address } = req.user;

    const out = await marketService.approveMarketplace(role, address);

    if (role === 'reseller') {
      const isAuthorized = await inventoryService.checkResellerStatus(address);

      if (!isAuthorized) {
        console.log(`[AUTO] Indirizzo ${address} non autorizzato nel contratto. Abilitazione in corso...`);
        await inventoryService.enableResellerRole(address);
      }
    }

    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


export const getListings = async (req, res) => {
  try {
    const listings = await marketService.getActiveListings();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: "Errore caricamento mercato" });
  }
};


export const buy = async (req, res) => {
  try {
    const listings = await marketService.getActiveListings();
    const item = listings.find(l => l.tokenId === String(req.body.tokenId));
    if (!item) throw new Error("Orologio non trovato");

    const out = await marketService.buyItem(req.user.role, req.user.sub, req.body.tokenId, item.price);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};



export const listPrimary = async (req, res) => {
  try {
    const { tokenId, price } = req.body;
    const { role, sub: address } = req.user;

    const isApproved = await marketService.checkNFTApproval(role, address);
    if (!isApproved) {
      return res.status(412).json({
        error: "MARKET_APPROVAL_REQUIRED",
        message: "Approval required: call /market/approve-market first"
      });
    }

    const out = await marketService.listPrimary(role, tokenId, price);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


export const listSecondary = async (req, res) => {
  const reqId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const { tokenId, price } = req.body;
    const { role, sub: address } = req.user;

    const isApproved = await marketService.checkNFTApproval(role, address);

    if (!isApproved) {
      return res.status(412).json({
        error: "MARKET_APPROVAL_REQUIRED",
        message: "Approval required: call /market/approve-market first"
      });
    }

    const out = await marketService.listSecondary(role, tokenId, price, address);
    return res.json(out);
  } catch (err) {
    console.error(`[${reqId}] listSecondary ERROR:`, err.message);
    return res.status(400).json({ error: err.message });
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

export const getCredits = async (req, res) => {
  try {
    const credits = await marketService.getPendingCredits(req.user.role, req.user.sub);
    res.json({ address: req.user.sub, creditsWei: credits });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    const { status } = req.body; // true/false
    const result = await marketService.setMarketEmergency(status);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};