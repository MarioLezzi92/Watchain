import { getToken, logout } from "./auth";

export const SERVER_URL = "http://localhost:3001"; 
const API_BASE = `${SERVER_URL}/api`;

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
    if (data.error) return typeof data.error === "string" ? data.error : JSON.stringify(data.error);
    if (data.message) return String(data.message);
  }
  return "Errore sconosciuto";
}

async function handleResponse(res) {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      console.warn(`Errore Auth (${res.status}) su: ${window.location.pathname}`);

      // 1. SE SIAMO GIÀ SUL LOGIN: NON FARE NULLA.
      if (window.location.pathname === "/login" || window.location.pathname === "/login/") {
         throw new Error("Credenziali non valide o sessione scaduta");
      }

      // 2. ALTRIMENTI (Siamo dentro l'app): Logout e Redirect
      console.warn("Sessione scaduta. Redirect al login.");
      logout(); 
      window.location.href = "/login";
      return null;
    }

    const msg = prettyErr(data) || `Errore ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// --- METODI ESPORTATI (Invariati) ---

export async function apiGet(endpoint) {
  const headers = {};
  const auth = buildAuthHeader();
  if (auth) headers["Authorization"] = auth;
  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
  const res = await fetch(url, { method: "GET", headers });
  return handleResponse(res);
}

export async function apiPost(endpoint, body = {}) {
  const headers = { "Content-Type": "application/json" };
  const auth = buildAuthHeader();
  if (auth) headers["Authorization"] = auth;
  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return handleResponse(res);
}

export async function apiPut(endpoint, body = {}) {
  const headers = { "Content-Type": "application/json" };
  const auth = buildAuthHeader();
  if (auth) headers["Authorization"] = auth;
  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
  const res = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
  return handleResponse(res);
}