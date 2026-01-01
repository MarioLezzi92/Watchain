import * as marketService from "../services/marketService.js";

// GET /market/listings
export const getListings = async (req, res) => {
  try {
    // DEBUG: Vediamo come il backend ti vede
    const role = req.user ? String(req.user.role).toLowerCase() : "guest (no auth)";
    console.log(`[MarketController] Request from: ${role}`);
    
    // 1. Scarichiamo TUTTI gli orologi (incluso il #20 Primary)
    const listings = await marketService.getActiveListings();

    // 2. MODIFICA CRUCIALE: Disabilitiamo il filtro lato server!
    // Lasciamo che sia il Frontend a decidere cosa nascondere.
    // In questo modo, se il login non viene rilevato (guest), 
    // l'orologio #20 viene comunque inviato e il Frontend (che sa di essere Producer) potrà mostrarlo.
    
    /* if (role === "consumer" || role === "guest") {
      const secondary = listings.filter(l => 
        String(l.saleType) === "1" || String(l.saleType).toUpperCase() === "SECONDARY"
      );
      return res.json(secondary);
    }
    */
    
    // Inviamo tutto a tutti (Il frontend filtrerà visivamente)
    console.log(`[MarketController] Sending ${listings.length} items to frontend.`);
    res.json(listings);

  } catch (err) {
    console.error("Listings Error:", err);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
};

// POST /market/listPrimary
export const listPrimary = async (req, res) => {
  try {
    const { tokenId, price } = req.body;
    const out = await marketService.listPrimary(req.user.role, tokenId, price);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// POST /market/listSecondary
export const listSecondary = async (req, res) => {
  try {
    const { tokenId, price } = req.body;
    const out = await marketService.listSecondary(req.user.role, tokenId, price);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// POST /market/cancel
export const cancelListing = async (req, res) => {
  try {
    const { tokenId } = req.body;
    const out = await marketService.cancelListing(req.user.role, tokenId);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// POST /market/buy
export const buy = async (req, res) => {
  try {
    const listings = await marketService.getActiveListings();
    const targetItem = listings.find(l => l.tokenId === String(req.body.tokenId));
    
    if (!targetItem) throw new Error("Item not listed or invalid");
    
    const out = await marketService.buyItem(
        req.user.role, 
        req.user.sub, 
        req.body.tokenId, 
        targetItem.price 
    );
    res.json(out);
  } catch (err) {
    console.error("Buy failed:", err);
    res.status(400).json({ error: err.message });
  }
};

// GET /market/credits
export const getCredits = async (req, res) => {
  try {
    const credits = await marketService.getPendingCredits(req.user.role, req.user.sub);
    res.json({ address: req.user.sub, creditsWei: credits });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// POST /market/withdraw
export const withdraw = async (req, res) => {
  try {
    const out = await marketService.withdrawCredits(req.user.role);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};