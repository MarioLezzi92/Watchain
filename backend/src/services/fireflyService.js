import axios from "axios";
import { config } from "../config/env.js";

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

export async function ffInvoke(role, apiName, method, input = {}, key = "") {
  const base = getBase(role);
  // NOTA: Qui assumiamo che 'base' includa '/api/v1/namespaces/default'
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

export async function ffQuery(role, apiName, method, input = {}, key = "") {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/query/${method}`;
  // CORREZIONE: Uso config invece di process.env diretto per coerenza
  const senderKey = (key && key !== "guest") ? key : config.producerAddr;

  try {
    const { data } = await axios.post(url, { input, key: senderKey });
    return data;
  } catch (err) {
    // Rilanciamo l'errore pulito o l'originale
    throw err;
  }
}

// Questa è la funzione che useremo per l'inventario
export async function ffGetCore(role, path, params = {}) {
  const base = getBase(role); 
  // Rimuoviamo slash iniziale dal path se presente per evitare doppi //
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = `${base}/${cleanPath}`;

  try {
    // Axios gestisce automaticamente la conversione dell'oggetto params in query string
    // es: params { limit: 50 } diventa ?limit=50
    const { data } = await axios.get(url, { params });
    return data;
  } catch (err) {
    const errorMsg = err.response?.data?.error || err.message;
    console.error(`!!! ERRORE FIREFLY CORE [GET ${path}]:`, errorMsg);
    throw new Error(errorMsg);
  }
}