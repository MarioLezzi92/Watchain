import { verifyAccessJwt } from "./jwt.js";

/**
 * Middleware di protezione route.
 * 1. Estrae l'access token ESCLUSIVAMENTE dai cookie HttpOnly (non dagli header).
 * 2. Verifica la firma JWT e la scadenza.
 * 3. Inietta l'identità utente in req.user per i controller successivi.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.access_token;
  
  if (!token) return res.status(401).json({ success: false, error: "Missing access token" });

  try {
    const payload = verifyAccessJwt(token);
    const address = payload?.sub;
    
    if (!address) return res.status(401).json({ success: false, error: "Invalid token payload" });

    // Context Injection: rende disponibile l'address ai controller
    req.user = { address };
    return next();
  } catch {
    // Gestione unificata (Scaduto, Firma invalida, Malformato)
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}