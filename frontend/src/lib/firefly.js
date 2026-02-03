
// --- CONFIGURAZIONE NODI ---
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

// Endpoint del Backend Proxy per l'inoltro sicuro delle transazioni (Write Operations)
const BACKEND_PROXY = "http://localhost:3001/firefly/invoke";

const NS = "default";

// --- PRIVATE HELPERS ---
const apiBase = (roleUrl, api) => `${roleUrl}/api/v1/namespaces/${NS}/apis/${api}`;
const parseJson = (res) => res.json().catch(() => ({}));

// Helper per le chiamate HTTP dirette verso i nodi FireFly.
// Utilizzato esclusivamente per operazioni di lettura (Query) che non richiedono firma.
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

// --- PUBLIC EXPORTS ---

/**
 * ffInvoke - Esegue una transazione di scrittura tramite il Backend Proxy.
 * *  il client non comunica direttamente con il nodo
 * per le operazioni che richiedono firma. La richiesta viene delegata al backend,
 * che verifica l'autenticazione (JWT) e inietta la chiave di firma corretta server-side.
 * * @param {string} baseUrl - URL base del nodo (usato per inferire il ruolo)
 * @param {string} api - Nome dell'API definita in FireFly
 * @param {string} method - Metodo dello smart contract da invocare
 * @param {object} input - Parametri della funzione
 * @param {object} opts - Opzioni aggiuntive
 */
export async function ffInvoke(baseUrl, api, method, input = {}, opts = {}) {
  // 1. Risoluzione del ruolo target in base all'URL di origine
  let role = "consumer";
  if (baseUrl.includes("5000")) role = "producer";
  else if (baseUrl.includes("5001")) role = "reseller";

  // 2. Invocazione sicura verso il Backend Proxy
  // L'opzione credentials: 'include' assicura l'invio dei cookie HTTP-Only (JWT).
  const res = await fetch(BACKEND_PROXY, {
    method: "POST",
    credentials: "include", 
    headers: {
      "Content-Type": "application/json",
      // Inclusione token CSRF se presente nei cookie non-HttpOnly per protezione aggiuntiva
      ...(document.cookie.match(/csrf_token=([^;]+)/) ? { "X-CSRF-Token": decodeURIComponent(document.cookie.match(/csrf_token=([^;]+)/)[1]) } : {})
    },
    body: JSON.stringify({
      role,    // Specifica al Proxy quale client FireFly utilizzare
      api,     // Identificativo dell'API registrata
      method,  // Funzione da invocare
      input    // Payload della transazione
      // NOTA DI SICUREZZA: La proprietà 'key' (signer) è omessa intenzionalmente.
      // Sarà il backend a determinarla univocamente dall'identità autenticata.
    })
  });

  const data = await parseJson(res);
  
  if (!res.ok) {
    // Gestione unificata degli errori provenienti dal Proxy o dal nodo FireFly sottostante
    throw new Error(data.error || data.message || "Errore durante l'esecuzione della transazione sicura");
  }

  return data;
}

// --- OPERAZIONI DI LETTURA  ---
// Le seguenti funzioni mantengono un accesso diretto ai nodi FireFly.
// Poiché le operazioni di lettura (Query) sono pubbliche e non comportano
// costi di gas o modifiche di stato, non richiedono l'intermediazione del Proxy.

export function ffQuery(baseUrl, api, method, input = {}, opts = {}) {
  const { timeout = "2m0s" } = opts;
  const url = `${apiBase(baseUrl, api)}/query/${method}`;
  return ffRequest("POST", url, { input }, timeout);
}

export function ffListenerGet(baseUrl, api, event, opts = {}) {
  const url = `${apiBase(baseUrl, api)}/listeners/${event}`;
  return ffRequest("GET", url, {}, opts.timeout);
}

// --- GESTIONE TOKEN & POOLS (Lettura) ---

const tokensBase = (roleUrl) => `${roleUrl}/api/v1/namespaces/${NS}/tokens`;
const _poolIdCache = new Map();

// Risolve l'ID di una Token Pool partendo dal nome, con caching locale per performance.
async function resolvePoolId(roleUrl, poolNameOrId) {
  if (typeof poolNameOrId === "string" && poolNameOrId.includes("-")) return poolNameOrId;
  const cacheKey = `${roleUrl}:${poolNameOrId}`;
  if (_poolIdCache.has(cacheKey)) return _poolIdCache.get(cacheKey);

  // Tentativo di risoluzione tramite lista pools
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

// --- GESTIONE SUBSCRIPTIONS & EVENTI (Lettura) ---

const subsBase = (baseUrl) => `${baseUrl}/api/v1/namespaces/${NS}/subscriptions`;
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