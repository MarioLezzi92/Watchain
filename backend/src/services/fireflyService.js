import axios from "axios";
import { config } from "../config/env.js";

/**
 * FIREFLY SERVICE LAYER
 * Driver di basso livello per la comunicazione con Hyperledger FireFly.
 * Implementa timeout di sicurezza e gestione centralizzata degli errori.
 */

// 1. Istanza Axios Sicura (con Timeout)
const http = axios.create({
  timeout: 30000, // 30 secondi massimo per operazione blockchain
  headers: { "Content-Type": "application/json" }
});

// Helper per risolvere l'URL del nodo corretto
function getBase(role) {
  const r = String(role || "").toLowerCase();
  const base = {
    producer: config.producerBase,
    reseller: config.resellerBase,
    consumer: config.consumerBase,
  }[r];
  
  if (!base) throw new Error(`Ruolo non valido o sconosciuto: '${role}'`);
  return String(base).replace(/\/+$/, "");
}

/**
 * Esegue una TRANSAZIONE (Scrittura/Invoke)
 */
export async function ffInvoke(role, apiName, method, input = {}, key = "") {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/invoke/${method}`;
  
  // Determinazione sicura del firmatario
  let senderKey = key;
  if (!senderKey || senderKey === "guest") {
    if (role === "producer") senderKey = config.producerAddr; 
    else if (role === "reseller") senderKey = config.resellerAddr; 
    else if (role === "consumer") senderKey = config.consumerAddr;
  }
  
  if (!senderKey) {
    throw new Error(`[Security] Nessuna chiave di firma trovata per il ruolo: ${role}`);
  }

  try {
    const { data } = await http.post(url, { input, key: senderKey });
    return data;
  } catch (err) {
    handleAxiosError(err, `INVOKE ${method}`);
  }
}

/**
 * Esegue una QUERY (Lettura/Call)
 */
export async function ffQuery(role, apiName, method, input = {}, key = "") {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/query/${method}`;
  
  // Per le query, se manca la chiave usiamo quella del producer (è solo lettura, ma serve un'identità)
  const senderKey = (key && key !== "guest") ? key : config.producerAddr;

  try {
    const { data } = await http.post(url, { input, key: senderKey });
    return data;
  } catch (err) {
    handleAxiosError(err, `QUERY ${method}`);
  }
}

/**
 * Esegue chiamate dirette alle API Core di FireFly (es. /tokens/balances)
 */
export async function ffGetCore(role, path, params = {}) {
  const base = getBase(role); 
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = `${base}/${cleanPath}`;

  try {
    const { data } = await http.get(url, { params });
    return data;
  } catch (err) {
    handleAxiosError(err, `CORE GET ${cleanPath}`);
  }
}

// --- PRIVATE HELPERS ---

function handleAxiosError(err, context) {
  // Estrae il messaggio di errore reale restituito da FireFly o dalla rete
  const errorMsg = err.response?.data?.error || err.message || "Errore sconosciuto";
  console.error(` FIREFLY ERROR [${context}]: ${errorMsg}`);
  
  // Rilancia un errore pulito che il controller può catturare
  throw new Error(errorMsg);
}