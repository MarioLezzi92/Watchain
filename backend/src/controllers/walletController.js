import * as walletService from "../services/walletService.js";
import { weiToLuxString, luxToWeiString } from "../utils/formatters.js";

export const getBalance = async (req, res) => {
  try {
    const wei = await walletService.getBalance(req.user.role, req.user.sub);
    res.json({ 
      address: req.user.sub, 
      lux: weiToLuxString(wei) 
    });
  } catch (err) {
    res.status(500).json({ error: "Errore saldo" });
  }
};

export const transfer = async (req, res) => {
  try {
    const { to, amountLux } = req.body;
    const amountWei = luxToWeiString(amountLux);
    const out = await walletService.transferLux(req.user.role, to, amountWei);
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};