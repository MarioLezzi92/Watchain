// frontend/app/src/lib/api.js
import { getToken } from "./auth";

const BASE = "http://localhost:3001";

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

export async function apiGet(path) {
  const auth = buildAuthHeader();
  const headers = { Accept: "application/json" };
  if (auth) headers.Authorization = auth;

  const res = await fetch(`${BASE}${path}`, { headers });
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
