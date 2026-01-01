import * as marketService from "../services/marketService.js";

// GET /market/listings
export const getListings = async (req, res) => {
  try {
    const role = String(req.user.role).toLowerCase();
    const listings = await marketService.getActiveListings();

    // Logica di filtro: Il Consumer vede solo mercato secondario
    if (role === "consumer") {
      const secondary = listings.filter(l => 
        String(l.saleType) === "1" || String(l.saleType).toUpperCase() === "SECONDARY"
      );
      return res.json(secondary);
    }
    
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
    // Nota: Il frontend dovrebbe passare il prezzo per evitare lookup extra, 
    // ma in un sistema robusto il backend dovrebbe riverificarlo. 
    // Qui assumiamo che il client invii il tokenId e il Service gestisca l'approve.
    // Per l'approve serve sapere quanto spendere. 
    // Opzione A: Il frontend manda 'price'.
    // Opzione B: Il backend fa una query 'getListing' prima di comprare.
    // Usiamo Opzione A per semplicità (come facevi tu implicitamente), o recuperiamolo.
    
    // Per sicurezza, cerchiamo il listing per sapere il prezzo reale
    const listings = await marketService.getActiveListings();
    const targetItem = listings.find(l => l.tokenId === String(req.body.tokenId));
    
    if (!targetItem) throw new Error("Item not listed or invalid");
    
    const out = await marketService.buyItem(
        req.user.role, 
        req.user.sub, 
        req.body.tokenId, 
        targetItem.price // Prezzo autentico dalla chain
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