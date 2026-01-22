import { generateNonce, verifyLogin } from "../services/authService.js";
import { env } from "../config/env.js"; 

export function getNonce(req, res) {
  try {
    const { address } = req.query || {};
    const nonce = generateNonce(address);
    return res.json({ success: true, nonce, message: `Login to Watchchain\nNonce: ${nonce}` });
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
}


export async function login(req, res) {
  try {
    const { address, signature } = req.body || {};
    const result = await verifyLogin(address, signature); 
    return res.json({ success: true, ...result });
  } catch (e) {
    console.error("Login Error:", e.message);
    return res.status(401).json({ success: false, error: e.message });
  }
}

export function logout(req, res) {
  return res.json({ success: true, message: "Logged out" });
}


export async function checkReseller(req, res) {
  try {
    const { address } = req.body || {};
    if (!address) throw new Error("Address mancante");
    
    const cleanAddr = String(address).trim().toLowerCase();
    const resellerEnv = String(env.RESELLER_ADDR || "").trim().toLowerCase();
    
    const isAuthorized = (cleanAddr === resellerEnv);

    return res.json({ success: true, isAuthorized });
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
}