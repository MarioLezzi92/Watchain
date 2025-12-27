// frontend/app/src/lib/api.js
import { getToken } from "./auth";

const BASE = "http://localhost:3001";

function buildAuthHeader() {
  const t = getToken();
  if (!t) return null;

  // rimuove QUALSIASI whitespace (newline, tab, spazi) dal token
  const cleanToken = String(t).replace(/\s+/g, "");

  // se per qualche motivo rimane vuoto, non mandare header
  if (!cleanToken) return null;

  return `Bearer ${cleanToken}`;
}

export async function apiGet(path) {
  const auth = buildAuthHeader();

  const headers = { Accept: "application/json" };
  if (auth) headers.Authorization = auth;

  // DEBUG: vedi esattamente cosa stai mandando
  console.log("AUTH HEADER SENT:", JSON.stringify(headers.Authorization));

  const res = await fetch(`${BASE}${path}`, { headers });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    throw new Error(`HTTP ${res.status} - ${msg}`);
  }

  return data;
}
