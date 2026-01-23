import { getToken, clearSession } from "./auth.js";
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

const BACKEND_BASE = "http://127.0.0.1:3001";
const _cache = {};

// --- HELPER RETE ---
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

  // FIX: 401 => logout client-side + stop
  if (res.status === 401) {
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
  logout: () => apiPost("/auth/logout", {}),
  me: () => apiGet("/auth/me"), // <-- aggiunto
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

  // --- MARKET OPERATIONS (Gestione Approvazione Automatica) ---
  marketOps: {
    ensureApprovalAndList: async (roleUrl, userAddress, tokenId, priceLuxWei, isSecondary) => {
      // 1. Trova l'indirizzo del Market
      const marketAddr = await FF.directory.resolveApi(FF_APIS.watchMarket);
      if (!marketAddr) throw new Error("Impossibile trovare l'indirizzo del contratto WatchMarket");

      // 2. Controlla se il Market è approvato per questo utente
      // isApprovedForAll(owner, operator)
      const isApproved = await FF.watchNft.query.isApprovedForAll(roleUrl, {
        owner: userAddress,
        operator: marketAddr,
      });

      // 3. Se non approvato, esegui approve (setApprovalForAll)
      if (!isApproved?.output) {
        console.log(`Market ${marketAddr} non approvato. Richiesta approvazione...`);
        await FF.watchNft.invoke.setApprovalForAll(roleUrl, {
          operator: marketAddr,
          approved: true,
        });
        console.log("Approvazione confermata.");
      }

      // 4. Esegui il listing (Primary o Secondary)
      const method = isSecondary ? "listSecondary" : "listPrimary";
      return await FF.watchMarket.invoke[method](roleUrl, {
        tokenId: tokenId,
        price: priceLuxWei,
      });
    },
  },
};
