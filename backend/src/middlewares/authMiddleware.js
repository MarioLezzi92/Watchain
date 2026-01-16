import { verifyJwt } from "../utils/jwt.js";

/**
 * AUTH MIDDLEWARE
 * Intercetta tutte le richieste protette.
 * 1. Estrae il token Bearer.
 * 2. Lo verifica crittograficamente.
 * 3. Inietta l'identità (req.user) per i controller successivi.
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1. Check Header presenza
  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Authorization header mancante" });
  }

  // 2. Estrazione Token (Supporta sia "Bearer <token>" che "<token>")
  const token = authHeader.startsWith("Bearer ") 
    ? authHeader.slice(7).trim() 
    : authHeader.trim();

  if (!token) {
    return res.status(401).json({ success: false, error: "Token non fornito" });
  }

  // 3. Verifica e Iniezione Identità
  try {
    const decoded = verifyJwt(token);
    
    // Passiamo i dati vitali ai controller
    req.user = {
      sub: decoded.account, // Subject (Indirizzo Wallet)
      role: decoded.role    // Ruolo (Producer/Reseller/Consumer)
    };
    
    next(); 
  } catch (err) {
    console.warn(`[Auth Fail] IP: ${req.ip} - Error: ${err.message}`);
    return res.status(401).json({ success: false, error: "Sessione scaduta o token non valido" });
  }
};