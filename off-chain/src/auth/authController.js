import { generateNonce, verifyLogin, refreshSession, revokeRefresh } from "./authService.js";
import { env } from "../../env.js";

function cookieOpts({ httpOnly, maxAgeMs, path }) {
  const isProd = env.NODE_ENV === "production";
  return {
    httpOnly,
    secure: isProd,      // in dev su http resta false
    sameSite: "lax",     // localhost (porte diverse) è "same-site"
    path: path || "/",
    maxAge: maxAgeMs,
  };
}

function setAuthCookies(res, { accessToken, refreshToken, csrfToken }) {
  // access token: cookie httpOnly (breve)
  res.cookie(
    "access_token",
    accessToken,
    cookieOpts({
      httpOnly: true,
      maxAgeMs: 15 * 60 * 1000,
      path: "/",
    })
  );

  // refresh token: cookie httpOnly (lungo) + path ristretto
  res.cookie(
    "refresh_token",
    refreshToken,
    cookieOpts({
      httpOnly: true,
      maxAgeMs: 14 * 24 * 60 * 60 * 1000,
      path: "/auth/refresh",
    })
  );

  // csrf token: NON httpOnly (il client lo legge e lo manda in header)
  res.cookie(
    "csrf_token",
    csrfToken,
    cookieOpts({
      httpOnly: false,
      maxAgeMs: 14 * 24 * 60 * 60 * 1000,
      path: "/",
    })
  );
}

function csrfCheck(req, res) {
  const csrfCookie = req.cookies?.csrf_token;
  const csrfHeader = req.headers["x-csrf-token"];
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    res.status(403).json({ success: false, error: "CSRF check failed" });
    return false;
  }
  return true;
}

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
    const { accessToken, refreshToken, csrfToken, address: addr } = await verifyLogin(address, signature);

    setAuthCookies(res, { accessToken, refreshToken, csrfToken });

    // NON ritorniamo più il JWT al frontend
    return res.json({ success: true, address: addr });
  } catch (e) {
    console.error("Login Error:", e.message);
    return res.status(401).json({ success: false, error: e.message });
  }
}

// CSRF-protected refresh (header + cookie)
export function refresh(req, res) {
  try {
    if (!csrfCheck(req, res)) return;

    const rt = req.cookies?.refresh_token;
    const { accessToken, refreshToken, csrfToken, address } = refreshSession(rt);

    setAuthCookies(res, { accessToken, refreshToken, csrfToken });
    return res.json({ success: true, address });
  } catch (e) {
    return res.status(401).json({ success: false, error: e.message });
  }
}

// logout: CSRF + revoca refresh + cancella cookie
export function logout(req, res) {
  try {
    if (!csrfCheck(req, res)) return;

    // proviamo a revocare con l'access cookie se presente
    const addr = req.user?.address;
    if (addr) revokeRefresh(addr);
  } catch {}

  const isProd = env.NODE_ENV === "production";
  res.clearCookie("access_token", { path: "/", sameSite: "lax", secure: isProd });
  res.clearCookie("refresh_token", { path: "/auth/refresh", sameSite: "lax", secure: isProd });
  res.clearCookie("csrf_token", { path: "/", sameSite: "lax", secure: isProd });

  return res.json({ success: true, message: "Logged out" });
}

export function me(req, res) {
  return res.json({ success: true, address: req.user.address });
}
