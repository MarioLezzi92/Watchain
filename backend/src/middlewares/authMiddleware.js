import { verifyJwt } from "../utils/jwt.js";

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Authorization header missing" });
  }

  const token = authHeader.startsWith("Bearer ") 
    ? authHeader.slice(7).trim() 
    : authHeader;

  if (!token) {
    return res.status(401).json({ success: false, error: "Token missing" });
  }

  try {
    const decoded = verifyJwt(token);
    
    // Mappiamo 'account' (dalle slide) su 'sub' (usato nei tuoi controller)
    // per non dover cambiare il codice di Market e Inventory.
    req.user = {
      sub: decoded.account, 
      role: decoded.role
    };
    
    next();
  } catch (err) {
    console.error("Auth Token Error:", err.message);
    return res.status(401).json({ success: false, error: "Token non valido o scaduto" });
  }
};