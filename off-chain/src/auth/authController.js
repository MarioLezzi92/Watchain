import { generateNonce, verifyLogin } from "./authService.js";

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

// rotta protetta per verificare che il JWT sia valido
export function me(req, res) {
  return res.json({ success: true, address: req.user.address });
}
