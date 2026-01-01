import * as authService from "../services/authService.js";

export const getNonce = (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "missing address" });
    
    const nonce = authService.generateNonce(address);
    res.json({ nonce });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const login = (req, res) => {
  try {
    const { address, signature } = req.body;
    if (!address || !signature) return res.status(400).json({ error: "missing data" });

    const result = authService.verifyLogin(address, signature);
    res.json(result);
  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(401).json({ error: err.message });
  }
};