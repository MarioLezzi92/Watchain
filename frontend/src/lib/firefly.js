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
  const headers = {
    Accept: "application/json",
    "Request-Timeout": timeout,
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

// --- TOKENS (connector built-in endpoints) ---

const tokensBase = (roleUrl) => `${roleUrl}/api/v1/namespaces/${NS}/tokens`;

// Cache in-memory (per sessione browser)
const _poolIdCache = new Map(); // key: `${roleUrl}:${poolName}` -> poolId

async function resolvePoolId(roleUrl, poolNameOrId) {
  // Se sembra già un UUID, usalo così com'è
  if (typeof poolNameOrId === "string" && poolNameOrId.includes("-")) return poolNameOrId;

  const cacheKey = `${roleUrl}:${poolNameOrId}`;
  if (_poolIdCache.has(cacheKey)) return _poolIdCache.get(cacheKey);

  // 1) Prova endpoint diretto /tokens/pools/{nameOrId}
  {
    const url = `${tokensBase(roleUrl)}/pools/${encodeURIComponent(poolNameOrId)}`;
    try {
      const pool = await ffRequest("GET", url);
      if (pool?.id) {
        _poolIdCache.set(cacheKey, pool.id);
        return pool.id;
      }
    } catch (_) {
      // ignore e fallback
    }
  }

  // 2) Fallback: lista pools e match per name
  const listUrl = `${tokensBase(roleUrl)}/pools`;
  const raw = await ffRequest("GET", listUrl);

  const pools = Array.isArray(raw) ? raw : (raw.items || raw.results || []);
  const found = pools.find(p => String(p?.name || "").toLowerCase() === String(poolNameOrId).toLowerCase());

  if (!found?.id) throw new Error(`Token pool not found: ${poolNameOrId}`);

  _poolIdCache.set(cacheKey, found.id);
  return found.id;
}

export async function ffTokensPoolsList(baseUrl) {
  return ffRequest("GET", `${tokensBase(baseUrl)}/pools`);
}

export async function ffTokensBalances(baseUrl, { pool, key }) {
  const poolId = await resolvePoolId(baseUrl, pool);
  const url = `${tokensBase(baseUrl)}/balances?pool=${encodeURIComponent(poolId)}&key=${encodeURIComponent(key)}`;
  return ffRequest("GET", url);
}


// ---- Subscriptions & Events ----

const subsBase = (baseUrl) => `${baseUrl}/api/v1/namespaces/${NS}/subscriptions`;

// cache in-memory: `${baseUrl}:${subName}` -> subId
const _subIdCache = new Map();

export async function ffSubscriptionsList(baseUrl) {
  return ffRequest("GET", subsBase(baseUrl));
}

export async function ffResolveSubscriptionId(baseUrl, subName) {
  const ck = `${baseUrl}:${subName}`;
  if (_subIdCache.has(ck)) return _subIdCache.get(ck);

  const raw = await ffRequest("GET", subsBase(baseUrl));
  const subs = Array.isArray(raw) ? raw : (raw.items || raw.results || []);

  const found = subs.find(s => String(s?.name || "").toLowerCase() === String(subName).toLowerCase());
  if (!found?.id) throw new Error(`Subscription not found: ${subName}`);

  _subIdCache.set(ck, found.id);
  return found.id;
}

export async function ffSubscriptionEvents(baseUrl, subId, { limit = 200 } = {}) {
  const url = `${subsBase(baseUrl)}/${encodeURIComponent(subId)}/events?limit=${limit}`;
  return ffRequest("GET", url);
}


// --- PUBLIC EXPORTS (Usati dal Proxy in api.js) ---

// In src/lib/firefly.js

export function ffInvoke(baseUrl, api, method, input = {}, opts = {}) {
  const { confirm = true, timeout = "2m0s", key } = opts;
  const url = `${apiBase(baseUrl, api)}/invoke/${method}?confirm=${confirm}`;
  const body = { input };
  if (key) {
    body.key = key;
  }

  return ffRequest("POST", url, body, timeout);
}

export function ffQuery(baseUrl, api, method, input = {}, opts = {}) {
  const { timeout = "2m0s" } = opts;
  const url = `${apiBase(baseUrl, api)}/query/${method}`;
  return ffRequest("POST", url, { input }, timeout);
}

export function ffListenerGet(baseUrl, api, event, opts = {}) {
  const url = `${apiBase(baseUrl, api)}/listeners/${event}`;
  return ffRequest("GET", url, {}, opts.timeout);
}



