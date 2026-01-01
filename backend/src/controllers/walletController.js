import * as walletService from "../services/walletService.js";

export const getBalance = async (req, res) => {
  try {
    const address = req.user.sub;
    const role = req.user.role;
    
    const wei = await walletService.getBalance(role, address);
    
    // Formattazione semplice per il frontend (wei -> string)
    res.json({ address, wei, lux: wei.length > 18 ? wei.slice(0, -18) : "0" });
  } catch (err) {
    console.error("Balance Error:", err.message);
    res.status(500).json({ error: "Balance check failed" });
  }
};

export const transfer = async (req, res) => {
  try {
    const { to, amountLux } = req.body;
    // Conversione base LUX -> WEI (10^18)
    const amountWei = `${String(amountLux)}000000000000000000`; 
    
    const out = await walletService.transferLux(req.user.role, to, amountWei);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};