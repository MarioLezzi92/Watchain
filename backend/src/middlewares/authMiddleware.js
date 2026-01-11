import { verifyJwt } from "../utils/jwt.js";

/**
 * MIDDLEWARE DI AUTENTICAZIONE
 * Protegge le rotte API sensibili.
 * * 1. Cerca il Token JWT nell'header 'Authorization'.
 * 2. Verifica che sia valido e non scaduto.
 * 3. Se valido, estrae i dati utente (indirizzo e ruolo) e li attacca a `req.user`.
 * 4. Se invalido, blocca la richiesta con errore 401.
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Authorization header missing" });
  }

  // Rimuove il prefisso "Bearer " se presente
  const token = authHeader.startsWith("Bearer ") 
    ? authHeader.slice(7).trim() 
    : authHeader;

  if (!token) {
    return res.status(401).json({ success: false, error: "Token missing" });
  }

  try {
    const decoded = verifyJwt(token);
    
   // Iniettiamo i dati utente nella richiesta così i Controller successivi sanno chi sta chiamando.
    req.user = {
      sub: decoded.account, 
      role: decoded.role
    };
    
    next(); // Passa al prossimo handler
  } catch (err) {
    console.error("Auth Token Error:", err.message);
    return res.status(401).json({ success: false, error: "Token non valido o scaduto" });
  }
};