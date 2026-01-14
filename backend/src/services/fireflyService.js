import axios from "axios";
import { config } from "../config/env.js";

/**
 * FIREFLY SERVICE
 * Questo modulo gestisce tutte le comunicazioni a basso livello con Hyperledger FireFly.
 * Isola il resto dell'applicazione dalla complessità delle chiamate REST alla blockchain.
 */

function getBase(role) {
  const r = String(role || "").toLowerCase();
  const base = {
    producer: config.producerBase,
    reseller: config.resellerBase,
    consumer: config.consumerBase,
  }[r];
  
  if (!base) throw new Error(`Unknown role '${role}'`);
  // Rimuove slash finali per evitare doppi // negli URL
  return String(base).replace(/\/+$/, "");
}

/**
 * Esegue una TRANSAZIONE sulla Blockchain (Scrittura).
 * Usa il metodo "invoke" di FireFly.
 * @param {string} role - Chi sta chiamando? ("producer", "reseller", "consumer")
 * @param {string} apiName - Nome dell'interfaccia definita in FireFly (es. "WatchMarket")
 * @param {string} method - Nome della funzione nello Smart Contract (es. "buy", "certify")
 * @param {Object} input - parametri della funzione (es. { tokenId: 1 })
 * @param {string} key - La chiave privata specifica da usare per firmare
 */
export async function ffInvoke(role, apiName, method, input = {}, key = "") {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/invoke/${method}`;
  
  let senderKey = key;

  // Logica di fallback per la chiave
  if (!key || key === "guest") {
    if (role === "producer") senderKey = config.producerAddr; 
    else if (role === "reseller") senderKey = config.resellerAddr; 
    else if (role === "consumer") senderKey = config.consumerAddr;
  }
  
  if (!senderKey) {
    throw new Error(`Chiave mittente non configurata per il ruolo: ${role}`);
  }

  try {
    const { data } = await axios.post(url, { input, key: senderKey });
    return data;
  } catch (err) {
    const errorMsg = err.response?.data?.error || err.message;
    console.error(`!!! ERRORE BLOCKCHAIN [${method}]:`, errorMsg);
    throw new Error(errorMsg);
  }
}


/**
 * Esegue una QUERY sulla Blockchain (Lettura).
 * Usa il metodo "query" di FireFly che restituisce il dato immediatamente.
 * @param {string} role - Il ruolo che legge 
 * @param {string} apiName - Nome dell'interfaccia
 * @param {string} method - Funzione "view" o "pure" del contratto
 */
export async function ffQuery(role, apiName, method, input = {}, key = "") {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/query/${method}`;
  const senderKey = (key && key !== "guest") ? key : config.producerAddr;

  try {
    const { data } = await axios.post(url, { input, key: senderKey });
    return data;
  } catch (err) {
    throw err;
  }
}

// funzione per l'inventario
export async function ffGetCore(role, path, params = {}) {
  const base = getBase(role); 
  // Rimuove slash iniziale dal path se presente per evitare doppi //
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = `${base}/${cleanPath}`;

  try {
    const { data } = await axios.get(url, { params });
    return data;
  } catch (err) {
    const errorMsg = err.response?.data?.error || err.message;
    console.error(`!!! ERRORE FIREFLY CORE [GET ${path}]:`, errorMsg);
    throw new Error(errorMsg);
  }
}