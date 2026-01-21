import { getToken } from "./auth.js";

// --- CONFIGURAZIONE ---
export const FF_BASE = {
  producer: "http://127.0.0.1:5000",
  reseller: "http://127.0.0.1:5001",
  consumer: "http://127.0.0.1:5002",
};

export const FF_APIS = {
  watchMarket: "WatchMarket_API",
  watchNft: "WatchNFT_API",
  luxuryCoin: "LuxuryCoin_API",
};

const NS = "default";

// --- PRIVATE HELPERS ---

const apiBase = (roleUrl, api) => `${roleUrl}/api/v1/namespaces/${NS}/apis/${api}`;
const parseJson = (res) => res.json().catch(() => ({}));

async function ffRequest(method, url, body = {}, timeout = "2m0s") {
  const token = getToken();
  const headers = {
    Accept: "application/json",
    "Request-Timeout": timeout,
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(method === "POST" && { "Content-Type": "application/json" }),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || data?.message || `FF ${method} ${res.status}`);
  return data;
}

// --- PUBLIC EXPORTS (Usati dal Proxy in api.js) ---

export function ffInvoke(baseUrl, api, method, input = {}, opts = {}) {
  const { confirm = true, timeout = "2m0s" } = opts;
  // Costruisce URL: .../invoke/method?confirm=true
  const url = `${apiBase(baseUrl, api)}/invoke/${method}?confirm=${confirm}`;
  return ffRequest("POST", url, { input }, timeout);
}

export function ffQuery(baseUrl, api, method, input = {}, opts = {}) {
  const { timeout = "2m0s" } = opts;
  // Costruisce URL: .../query/method
  const url = `${apiBase(baseUrl, api)}/query/${method}`;
  return ffRequest("POST", url, { input }, timeout);
}

export function ffListenerGet(baseUrl, api, event, opts = {}) {
  const url = `${apiBase(baseUrl, api)}/listeners/${event}`;
  return ffRequest("GET", url, {}, opts.timeout);
}