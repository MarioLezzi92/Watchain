import { getToken, clearSession } from "./auth.js";
import { FF_BASE, FF_APIS, ffInvoke, ffQuery, ffListenerGet } from "./firefly";

// Riesportiamo le costanti per comodità delle altre pagine
export { FF_BASE, FF_APIS, ffInvoke, ffQuery, ffListenerGet };

const BACKEND_BASE = "http://127.0.0.1:3001";

// --- HELPERS RETE BACKEND (Node.js) ---

async function parseJsonSafely(res) {
  return res.json().catch(() => ({}));
}

async function request(method, path, body) {
  const token = getToken();

  const res = await fetch(`${BACKEND_BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  // Se il token è scaduto, logout automatico
  if (res.status === 401) {
    clearSession();
  }

  const data = await parseJsonSafely(res);
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

export function apiGet(path) { return request("GET", path); }
export function apiPost(path, body) { return request("POST", path, body); }
export function apiPut(path, body) { return request("PUT", path, body); }
export function apiDelete(path) { return request("DELETE", path); }

// --- API DI AUTENTICAZIONE (Backend) ---

export const AuthAPI = {
  nonce: (address) => apiGet(`/auth/nonce?address=${encodeURIComponent(address)}`),
  login: (address, signature) => apiPost("/auth/login", { address, signature }),
  logout: () => apiPost("/auth/logout", {}),
  me: () => apiGet("/auth/me"),
  checkReseller: (address) => apiPost("/auth/check-reseller", { address }),
};

// --- GENERATORE API FIREFLY (Blockchain) ---

/**
 * PROXY GENERATOR
 * Intercetta dinamicamente le chiamate alle funzioni.
 * Esempio: FF.watchMarket.invoke.buy(...) -> chiama automaticamente "buy" su FireFly.
 */
function createProxyApi(apiName) {
  return {
    // Intercetta metodi di scrittura (Invoke)
    invoke: new Proxy({}, {
      get: (_, method) => (roleUrl, input = {}, opts = {}) => 
        ffInvoke(roleUrl, apiName, method, input, opts)
    }),

    // Intercetta metodi di lettura (Query)
    query: new Proxy({}, {
      get: (_, method) => (roleUrl, input = {}, opts = {}) => 
        ffQuery(roleUrl, apiName, method, input, opts)
    }),

    // Intercetta listener di eventi
    listeners: new Proxy({}, {
      get: (_, event) => (roleUrl, opts = {}) => 
        ffListenerGet(roleUrl, apiName, event, opts)
    })
  };
}

// --- OGGETTO FF PRINCIPALE ---

export const FF = {
  // Dati statici
  base: FF_BASE,
  apis: FF_APIS,

  // Accesso RAW (per debug o usi manuali)
  raw: {
    invoke: (roleBaseUrl, apiName, method, input = {}, opts = {}) => ffInvoke(roleBaseUrl, apiName, method, input, opts),
    query: (roleBaseUrl, apiName, method, input = {}, opts = {}) => ffQuery(roleBaseUrl, apiName, method, input, opts),
    listener: (roleBaseUrl, apiName, evt, opts = {}) => ffListenerGet(roleBaseUrl, apiName, evt, opts),
  },  

  // API Dinamiche (create col Proxy)
  watchMarket: createProxyApi(FF_APIS.watchMarket),
  watchNft:    createProxyApi(FF_APIS.watchNft),
  luxuryCoin:  createProxyApi(FF_APIS.luxuryCoin),
};