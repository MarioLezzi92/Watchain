import { generateNonce, verifyLogin, refreshSession, revokeRefresh } from "./authService.js";
import { env } from "../../env.js";

// Converte TTL testuali (es. "15m", "14d") in millisecondi per i cookie.
function ttlToMs(ttl) {
  const m = /^\s*(\d+)\s*([smhd])\s*$/i.exec(String(ttl ?? "").trim());
  if (!m) throw new Error(`TTL non valido: ${ttl}`);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return n * mult;
}

/**
 * Configurazione centralizzata per i Cookie.
 * Implementa le best-practices OWASP:
 * - httpOnly: Previene accessi via JavaScript (protezione XSS).
 * - secure: Obbligatorio in produzione (HTTPS).
 * - sameSite: 'lax' per bilanciare sicurezza e usabilità in navigazione.
 */
function cookieOpts({ httpOnly, maxAgeMs, path }) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly,
    secure: isProd,
    sameSite: "lax",
    path: path || "/",
    maxAge: maxAgeMs,
  };
}

/**
 * Imposta i tre token necessari per la sessione sicura.
 * Strategia "Split-Cookie":
 * 1. Access Token: Breve durata, HttpOnly.
 * 2. Refresh Token: Lunga durata, HttpOnly, Path ristretto (rotazione).
 * 3. CSRF Token: Leggibile da JS, usato per il pattern "Double Submit Cookie".
 */
function setAuthCookies(res, { accessToken, refreshToken, csrfToken }) {
  const accessMaxAge = ttlToMs(env.ACCESS_TTL || "15m");
  const refreshMaxAge = ttlToMs(env.REFRESH_TTL || "14d");

  // 1. Access Token (Sessione corrente)
  res.cookie(
    "access_token",
    accessToken,
    cookieOpts({
      httpOnly: true,
      maxAgeMs: accessMaxAge,
      path: "/",
    })
  );

  // 2. Refresh Token (Rinnovo sessione) - Path limitato all'endpoint di refresh
  res.cookie(
    "refresh_token",
    refreshToken,
    cookieOpts({
      httpOnly: true,
      maxAgeMs: refreshMaxAge,
      path: "/auth/refresh",
    })
  );

  // 3. CSRF Token (Protezione Cross-Site Request Forgery)
  // Questo cookie NON è HttpOnly perché il client deve poterlo leggere
  // e inviare nell'header 'x-csrf-token'.
  res.cookie(
    "csrf_token",
    csrfToken,
    cookieOpts({
      httpOnly: false,
      maxAgeMs: refreshMaxAge,
      path: "/",
    })
  );
}

/**
 * Middleware logico per la validazione CSRF (Double Submit Cookie Pattern).
 * Confronta il token nel cookie (firmato dal server) con quello nell'header (inviato dal client).
 */
function csrfCheck(req, res) {
  const csrfCookie = req.cookies?.csrf_token;
  const csrfHeader = req.headers["x-csrf-token"];

  // Se mancano o non coincidono, la richiesta potrebbe essere forgiata.
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    res.status(403).json({ success: false, error: "CSRF check failed" });
    return false;
  }
  return true;
}

// Genera un nonce crittografico per il Challenge-Response (Step 1 Login)
export function getNonce(req, res) {
  try {
    const { address } = req.query || {};
    const nonce = generateNonce(address);
    return res.json({ success: true, nonce, message: `Login to Watchchain\nNonce: ${nonce}` });
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
}

// Verifica la firma e instaura la sessione (Step 2 Login)
export async function login(req, res) {
  try {
    const { address, signature } = req.body || {};
    // Verifica crittografica e generazione token
    const { accessToken, refreshToken, csrfToken, address: addr } = await verifyLogin(address, signature);

    setAuthCookies(res, { accessToken, refreshToken, csrfToken });

    // Restituiamo solo l'indirizzo, i token viaggiano sicuri nei cookie
    return res.json({ success: true, address: addr });
  } catch (e) {
    console.error("Login Error:", e.message);
    return res.status(401).json({ success: false, error: e.message });
  }
}

// Rinnova l'Access Token usando il Refresh Token (con Rotazione)
export function refresh(req, res) {
  try {
    // Protezione CSRF anche sul refresh per evitare abusi
    if (!csrfCheck(req, res)) return;

    const rt = req.cookies?.refresh_token;
    // Logica di rotazione del token
    const { accessToken, refreshToken, csrfToken, address } = refreshSession(rt);

    setAuthCookies(res, { accessToken, refreshToken, csrfToken });
    return res.json({ success: true, address });
  } catch (e) {
    return res.status(401).json({ success: false, error: e.message });
  }
}

// Logout sicuro: Revoca lato server e pulizia cookie
export function logout(req, res) {
  try {
    if (!csrfCheck(req, res)) return;

    const addr = req.user?.address;
    if (addr) revokeRefresh(addr); // Invalidazione Server-Side
  } catch {}

  const isProd = process.env.NODE_ENV === "production";

  res.clearCookie("access_token", { path: "/", sameSite: "lax", secure: isProd });
  res.clearCookie("refresh_token", { path: "/auth/refresh", sameSite: "lax", secure: isProd });
  res.clearCookie("csrf_token", { path: "/", sameSite: "lax", secure: isProd });

  return res.json({ success: true, message: "Logged out" });
}

export function me(req, res) {
  return res.json({ success: true, address: req.user.address });
}
