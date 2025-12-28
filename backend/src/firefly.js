// backend/src/firefly.js
import axios from "axios";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getBase(role) {
  const r = normalizeRole(role);
  const base = {
    producer: process.env.FF_PRODUCER_BASE,
    reseller: process.env.FF_RESELLER_BASE,
    consumer: process.env.FF_CONSUMER_BASE,
  }[r];

  if (!base) throw new Error(`Unknown role '${role}'`);
  return base.replace(/\/+$/, "");
}

function getKey(role) {
  const r = normalizeRole(role);
  const key = {
    producer: process.env.PRODUCER_ADDR,
    reseller: process.env.RESELLER_ADDR,
    consumer: process.env.CONSUMER_ADDR,
  }[r];

  // Se non è settata, lasciamo null (FireFly userà il default del nodo)
  return key ? String(key).trim() : null;
}

/**
 * INVOKE (tx on-chain): serve la key, altrimenti FireFly firma col default del nodo.
 */
export async function ffInvoke(role, apiName, method, input = {}) {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/invoke/${method}`;

  const payload = { input };

  const key = getKey(role);
  if (key) payload.key = key;

  const { data } = await axios.post(url, payload);
  return data;
}

/**
 * QUERY (read-only): la key di solito non serve.
 */
export async function ffQuery(role, apiName, method, input = {}) {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/query/${method}`;

  const { data } = await axios.post(url, { input });
  return data;
}
