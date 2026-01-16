import * as authService from "../services/authService.js";
import { config } from "../config/env.js";

/**
 * AUTH CONTROLLER
 * Gestisce le richieste HTTP relative all'autenticazione.
 * Responsabilità: Validazione Input -> Chiamata Service -> Risposta JSON.
 */

// Helper per validare formato indirizzi Ethereum (sicurezza base)
const isValidEthAddress = (addr) => /^0x[a-fA-F0-9]{40}$/i.test(addr);

export const getNonce = (req, res) => {
  try {
    const { address } = req.query;

    // 1. Validazione Input
    if (!address) {
      return res.status(400).json({ success: false, error: "Address mancante" });
    }
    if (!isValidEthAddress(address)) {
      return res.status(400).json({ success: false, error: "Formato Address non valido" });
    }
    
    // 2. Business Logic
    const nonce = authService.generateNonce(address);
    
    // 3. Risposta
    res.json({ success: true, nonce });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const login = (req, res) => {
  try {
    const { address, signature } = req.body;

    // 1. Validazione Input
    if (!address || !signature) {
      return res.status(400).json({ success: false, error: "Dati di login mancanti" });
    }
    if (!isValidEthAddress(address)) {
      return res.status(400).json({ success: false, error: "Formato Address non valido" });
    }

    // 2. Business Logic (Verifica Firma)
    const result = authService.verifyLogin(address, signature);
    // result è { success: true, token, role }

    res.json(result);
  } catch (err) {
    console.warn(`[AUTH FAIL] Login failed per ${req.body.address}: ${err.message}`);
    res.status(401).json({ success: false, error: "Autenticazione fallita: Firma non valida o sessione scaduta." });
  }
};

export const logout = (req, res) => {
  res.json({ 
    success: true, 
    message: "Sessione terminata." 
  });
};

export const getConfig = async (req, res) => {
  try {
    // Espone solo le configurazioni pubbliche necessarie al frontend
    res.status(200).json({
      success: true,
      resellerAddress: config.resellerAddr,
      producerAddress: config.producerAddr,
      contractAddresses: {
        luxuryCoin: config.luxuryCoinAddress,
        watchNFT: config.watchNFTAddress,
        watchMarket: config.watchMarketAddress
      }
    });
  } catch (error) {
    console.error("Config Error:", error);
    res.status(500).json({ success: false, error: "Errore configurazione backend" });
  }
};