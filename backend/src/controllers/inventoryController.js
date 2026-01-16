import * as inventoryService from "../services/inventoryService.js";

/**
 * INVENTORY CONTROLLER
 * Gestisce la produzione (Minting), certificazione e ruoli.
 * POLICY: Fail Fast & Validate Inputs.
 */

// --- VALIDATION HELPERS ---
const isValidEthAddress = (addr) => addr && /^0x[a-fA-F0-9]{40}$/i.test(addr);
const isValidTokenId = (id) => id && /^\d+$/.test(String(id));

// --- READ OPERATIONS ---

export const getMyInventory = async (req, res) => {
  try {
    const { role, sub: address } = req.user;
    const inventory = await inventoryService.getInventory(role, address);
    res.json(inventory);
  } catch (err) {
    console.error("Inventory Error:", err.message);
    res.status(500).json({ error: "Impossibile recuperare l'inventario." });
  }
};

export const getFactoryStatus = async (req, res) => {
  try {
    const result = await inventoryService.getFactoryStatus();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const checkReseller = async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!isValidEthAddress(address)) {
      return res.status(400).json({ error: "Indirizzo non valido" });
    }

    const isReseller = await inventoryService.checkResellerStatus(address);
    res.json({ isReseller });
  } catch (err) {
    // Non crashiamo, restituiamo false in sicurezza
    res.json({ isReseller: false });
  }
};

// --- WRITE OPERATIONS (Require Validation & Roles) ---

export const mint = async (req, res) => {
  try {
    const { role } = req.user;
    const { to } = req.body; // Opzionale
    
    if (role !== "producer") {
      return res.status(403).json({ error: "Accesso Negato: Solo il Producer può coniare." });
    }

    if (to && !isValidEthAddress(to)) {
      return res.status(400).json({ error: "Indirizzo destinatario non valido" });
    }
    
    const result = await inventoryService.mintNft(role, to);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const certify = async (req, res) => {
  try {
    const { tokenId } = req.body;
    const { role, sub: address } = req.user;

    if (role !== "reseller") {
      return res.status(403).json({ success: false, error: "Azione Negata: Solo i Reseller autorizzati possono certificare. Contattare il Producer." });
    }

    if (!isValidTokenId(tokenId)) {
      return res.status(400).json({ success: false, error: "Token ID non valido" });
    }

    const result = await inventoryService.certifyNft(role, address, tokenId);
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

export const setReseller = async (req, res) => {
  try {
    const { role } = req.user;
    const { who, enabled = true } = req.body;

    if (role !== "producer") {
      return res.status(403).json({ success: false, error: "Accesso Negato: Solo il Producer gestisce i ruoli." });
    }

    if (!isValidEthAddress(who)) {
      return res.status(400).json({ success: false, error: "Indirizzo target non valido" });
    }

    const result = await inventoryService.setResellerRole(who, Boolean(enabled));
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

export const setFactoryEmergency = async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "producer") return res.status(403).json({ error: "Accesso Negato" });

    const { status } = req.body;
    const result = await inventoryService.setFactoryEmergency(status);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};