import { getToken } from "./auth";

// backend/src/app.js ora serve su /api
// Se VITE_BACKEND_BASE non è settato, usa localhost:3001/api
const BASE = (import.meta.env.VITE_BACKEND_BASE || "http://localhost:3001/api").replace(/\/+$/, "");

function buildAuthHeader() {
  const t = getToken();
  if (!t) return null;
  const cleanToken = String(t).replace(/\s+/g, "");
  if (!cleanToken) return null;
  return `Bearer ${cleanToken}`;
}

function prettyErr(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    if (data.error) {
      if (typeof data.error === "string") return data.error;
      try { return JSON.stringify(data.error); } catch { return String(data.error); }
    }
    if (data.message) return String(data.message);
    try { return JSON.stringify(data); } catch { return String(data); }
  }
  return String(data);
}

async function parseResponse(res) {
  const text = await res.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = prettyErr(data) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function apiGet(path) {
  const auth = buildAuthHeader();
  const headers = { Accept: "application/json" };
  if (auth) headers.Authorization = auth;

  // Nota: path deve iniziare con / (es: /market/listings)
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