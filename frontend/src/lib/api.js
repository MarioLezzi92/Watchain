import { clearSession } from "./auth.js";
import {
  FF_BASE,
  FF_APIS,
  ffInvoke,
  ffQuery,
  ffListenerGet,
  ffTokensPoolsList,
  ffTokensBalances,
  ffResolveSubscriptionId,
  ffSubscriptionEvents,
} from "./firefly";

export { FF_BASE, FF_APIS, ffInvoke, ffQuery, ffListenerGet };

const BACKEND_BASE = "http://localhost:3001";
const _cache = {};

// --- HELPER RETE ---
async function parseJsonSafely(res) {
  return res.json().catch(() => ({}));
}

function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

let refreshInFlight = null;

async function doRefreshOnce() {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BACKEND_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        // CSRF obbligatorio per refresh
        ...(getCookie("csrf_token") ? { "X-CSRF-Token": getCookie("csrf_token") } : {}),
      },
      body: "{}",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`refresh ${r.status}`);
        return r.json().catch(() => ({}));
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function request(method, path, body, _retry = false) {
  const csrf = getCookie("csrf_token");

  const res = await fetch(`${BACKEND_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(method !== "GET" && csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) {
    if (!_retry && path !== "/auth/refresh") {
      try {
        await doRefreshOnce();                 // una sola refresh per tutti
        return request(method, path, body, true); // ritenta
      } catch {
        clearSession();
        throw new Error("Unauthorized");
      }
    }

    clearSession();
    throw new Error("Unauthorized");
  }

  const data = await parseJsonSafely(res);
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}



export function apiGet(path) {
  return request("GET", path);
}
export function apiPost(path, body) {
  return request("POST", path, body);
}
export function apiPut(path, body) {
  return request("PUT", path, body);
}
export function apiDelete(path) {
  return request("DELETE", path);
}

// --- AUTH API ---
export const AuthAPI = {
  nonce: (address) => apiGet(`/auth/nonce?address=${encodeURIComponent(address)}`),
  login: (address, signature) => apiPost("/auth/login", { address, signature }),
  me: () => apiGet("/auth/me"),
  logout: () => apiPost("/auth/logout", {}),
  refresh: () => apiPost("/auth/refresh", {}), 
};

// --- PROXY GENERATOR ---
function createProxyApi(apiName) {
  return {
    invoke: new Proxy({}, { get: (_, method) => (roleUrl, input = {}, opts = {}) => ffInvoke(roleUrl, apiName, method, input, opts) }),
    query: new Proxy({}, { get: (_, method) => (roleUrl, input = {}, opts = {}) => ffQuery(roleUrl, apiName, method, input, opts) }),
    listeners: new Proxy({}, { get: (_, event) => (roleUrl, opts = {}) => ffListenerGet(roleUrl, apiName, event, opts) }),
  };
}

// --- OGGETTO FF PRINCIPALE ---
export const FF = {
  base: FF_BASE,
  apis: FF_APIS,

  directory: {
    // 1. Risolve Contratti (API)
    resolveApi: async (apiName) => {
      if (_cache[apiName]) return _cache[apiName];
      try {
        const url = `${FF_BASE.producer}/api/v1/namespaces/default/apis/${apiName}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const addr = data.location?.address || data.address;
        if (addr) _cache[apiName] = addr;
        return addr;
      } catch (e) {
        return null;
      }
    },

    // 2. Risolve Identità (Org -> Indirizzo Wallet)
    resolveIdentityAddress: async (identityName) => {
      const cacheKey = `id:${identityName}`;
      if (_cache[cacheKey]) return _cache[cacheKey];

      try {
        const idRes = await fetch(`${FF_BASE.producer}/api/v1/network/identities`);
        if (!idRes.ok) throw new Error("Identities endpoint failed");

        const identities = await idRes.json();
        const targetId = identities.find((i) => i.name.toLowerCase().includes(identityName.toLowerCase()));

        if (!targetId) {
          console.warn(`Identity '${identityName}' non trovata su FireFly.`);
          return null;
        }

        const verUrl = `${FF_BASE.producer}/api/v1/namespaces/default/verifiers?identity=${targetId.id}&type=ethereum_address`;
        const verRes = await fetch(verUrl);
        if (!verRes.ok) throw new Error(`Verifiers endpoint failed: ${verRes.status}`);

        const verifiers = await verRes.json();
        const address = verifiers[0]?.value;

        if (address) {
          _cache[cacheKey] = address;
          return address;
        }
        return null;
      } catch (e) {
        console.error("Discovery Error:", e);
        return null;
      }
    },
  },

  raw: {
    invoke: (roleBaseUrl, apiName, method, input = {}, opts = {}) => ffInvoke(roleBaseUrl, apiName, method, input, opts),
    query: (roleBaseUrl, apiName, method, input = {}, opts = {}) => ffQuery(roleBaseUrl, apiName, method, input, opts),
    listener: (roleBaseUrl, apiName, evt, opts = {}) => ffListenerGet(roleBaseUrl, apiName, evt, opts),
  },

  tokens: {
    pools: (roleBaseUrl) => ffTokensPoolsList(roleBaseUrl),
    balances: (roleBaseUrl, { pool, key }) => ffTokensBalances(roleBaseUrl, { pool, key }),
  },

  subscriptions: {
    eventsByName: async (roleBaseUrl, subName, opts) => {
      const subId = await ffResolveSubscriptionId(roleBaseUrl, subName);
      return ffSubscriptionEvents(roleBaseUrl, subId, opts);
    },
  },

  // --- API PROXIES ---
  watchMarket: createProxyApi(FF_APIS.watchMarket),
  watchNft: createProxyApi(FF_APIS.watchNft),
  luxuryCoin: createProxyApi(FF_APIS.luxuryCoin),
};
