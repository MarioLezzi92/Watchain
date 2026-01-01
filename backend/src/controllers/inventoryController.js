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

    // se non è ancora reseller on-chain -> setReseller(address,true) (firmato dal producer)
    await inventoryService.ensureReseller(address);

    // ora la tx viene firmata dal reseller (address) e non reverte "only reseller"
    const result = await inventoryService.certifyNft(role, address, tokenId);

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};


