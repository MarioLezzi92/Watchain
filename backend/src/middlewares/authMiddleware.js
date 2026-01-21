import { verifyJwt } from "../utils/jwt.js";

export function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const [type, token] = hdr.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ success: false, error: "Missing Bearer token" });
  }

  try {
    req.user = verifyJwt(token);
    return next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid/expired token" });
  }
}
