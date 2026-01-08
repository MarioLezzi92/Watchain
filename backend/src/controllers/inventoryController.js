import * as inventoryService from "../services/inventoryService.js";

// GET /inventory
export const getMyInventory = async (req, res) => {
  try {
    const { role, sub: address } = req.user;
    const inventory = await inventoryService.getInventory(role, address);
    res.json(inventory);
  } catch (err) {
    console.error("Inventory Error:", err.message);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
};

// POST /inventory/mint (Ex /nft/mint)
export const mint = async (req, res) => {
  try {
    const { role } = req.user;
    const { to } = req.body; // opzionale
    
    const result = await inventoryService.mintNft(role, to);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


export const certify = async (req, res) => {
  try {
    const { tokenId } = req.body;

    const role = req.user.role;
    const address = req.user.sub;

    if (role !== "reseller") {
      return res.status(403).json({ success: false, error: "Only reseller can certify" });
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

    if (role !== "producer") {
      return res.status(403).json({ success: false, error: "Only producer can set reseller" });
    }

    const { who, enabled = true } = req.body;
    if (!who) {
      return res.status(400).json({ success: false, error: "Missing 'who' address" });
    }

    const result = await inventoryService.setResellerRole(who, Boolean(enabled));
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
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

export const setFactoryEmergency = async (req, res) => {
  try {
    const { status } = req.body;
    const result = await inventoryService.setFactoryEmergency(status);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};