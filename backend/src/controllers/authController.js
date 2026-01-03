import * as authService from "../services/authService.js";

export const getNonce = (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ success: false, error: "Missing address" });
    }
    
    const nonce = authService.generateNonce(address);
    res.json({ success: true, nonce });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const login = (req, res) => {
  try {
    const { address, signature } = req.body;
    if (!address || !signature) {
      return res.status(400).json({ success: false, error: "Missing address or signature" });
    }

    const result = authService.verifyLogin(address, signature);
    // result è { success: true, token, role }
    res.json(result);
  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(401).json({ success: false, error: err.message });
  }
};

export const logout = (req, res) => {
  // In un sistema JWT semplice, il logout è la distruzione del token lato client.
  // Restituiamo un messaggio di successo per confermare l'azione.
  res.json({ 
    success: true, 
    message: "Logout effettuato. Eliminare il token dal client." 
  });
};