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
  return String(base).replace(/\/+$/, "");
}

export async function ffInvoke(role, apiName, method, input = {}, key = "") {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/invoke/${method}`;
  
  let senderKey = key;

  // Se la chiave non è passata (o è "guest"), usiamo quella di sistema
  if (!key || key === "guest") {
    if (role === "producer") {
      senderKey = config.producerAddr; 
    } else if (role === "reseller") {
      senderKey = config.resellerAddr; 
    } else if (role === "consumer") {
      senderKey = config.consumerAddr;
    }
  }
  
  // --- LOG DI DEEP DEBUG ---
  console.log("--- FIREFLY INVOKE DEBUG ---");
  console.log(`Metodo Chiamato: ${method}`);
  console.log(`Ruolo Utente: ${role}`);
  console.log(`Chiave Mittente (SenderKey): ${senderKey}`);
  console.log(`Payload Input:`, JSON.stringify(input));
  console.log("----------------------------");

  if (!senderKey) {
    throw new Error(`Chiave mittente non configurata nel .env per il ruolo: ${role}`);
  }

  try {
    const { data } = await axios.post(url, { input, key: senderKey });
    return data;
  } catch (err) {
    // Log dell'errore specifico che torna dalla blockchain/EVM
    const errorMsg = err.response?.data?.error || err.message;
    console.error(`!!! ERRORE BLOCKCHAIN [${method}]:`, errorMsg);
    throw new Error(errorMsg);
  }
}

export async function ffQuery(role, apiName, method, input = {}, key = "") {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/query/${method}`;
  const senderKey = (key && key !== "guest") ? key : process.env.PRODUCER_ADDR;

  try {
    const { data } = await axios.post(url, { input, key: senderKey });
    return data;
  } catch (err) {
    throw err;
  }
}