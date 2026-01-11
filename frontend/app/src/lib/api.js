import { getToken } from "./auth";

const BASE = (import.meta.env.VITE_BACKEND_BASE || "http://localhost:3001/api").replace(/\/+$/, "");

/**
 * Costruisce l'header di autorizzazione usando il Bearer Token. 
 */
function buildAuthHeader() {
  const t = getToken();
  if (!t) return null;
  const cleanToken = String(t).replace(/\s+/g, "");
  if (!cleanToken) return null;
  return `Bearer ${cleanToken}`; // Formato standard richiesto dal middleware 
}

function prettyErr(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    if (data.error) return typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    if (data.message) return String(data.message);
  }
  return String(data);
}

async function parseResponse(res) {
  const text = await res.text().catch(() => "");
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  // Gestione errori: HTTP non OK o campo success: false 
  if (!res.ok || (data && data.success === false)) {
    const msg = prettyErr(data) || `HTTP ${res.status}`;
    
    if (res.status === 401) {
       console.warn("Sessione scaduta o non valida.");
    }
    
    throw new Error(msg);
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