// frontend/app/src/lib/api.js
import { getToken } from "./auth";

const BASE = (import.meta.env.VITE_BACKEND_BASE || "http://localhost:3001").replace(/\/+$/, "");

function buildAuthHeader() {
  const t = getToken();
  if (!t) return null;
  const cleanToken = String(t).replace(/\s+/g, "");
  if (!cleanToken) return null;
  return `Bearer ${cleanToken}`;
}

async function parseResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && (data.error?.error || data.error || data.message)) ||
      res.statusText ||
      "Request failed";
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function apiGet(path) {
  const auth = buildAuthHeader();
  const headers = { Accept: "application/json" };
  if (auth) headers.Authorization = auth;

  const res = await fetch(`${BASE}${path}`, { method: "GET", headers });
  return parseResponse(res);
}

export async function apiPost(path, body = {}) {
  const auth = buildAuthHeader();
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (auth) headers.Authorization = auth;

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return parseResponse(res);
}

// -------- Config cache --------
let _configCache = null;

export async function getConfig(force = false) {
  if (_configCache && !force) return _configCache;
  const res = await fetch(`${BASE}/config`, { method: "GET", headers: { Accept: "application/json" } });
  const cfg = await parseResponse(res);
  _configCache = cfg || {};
  return _configCache;
}
