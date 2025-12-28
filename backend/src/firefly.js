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

  if (!base) throw new Error(`Unknown role '${role}' (missing FF_*_BASE?)`);
  return String(base).replace(/\/$/, "");
}

/**
 * INVOKE (tx): POST /apis/{api}/invoke/{method}
 * payload: { input, key? }
 */
export async function ffInvoke(role, apiName, method, input = {}, key = undefined) {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/invoke/${method}`;

  const payload = { input };
  if (key !== undefined && key !== null && String(key) !== "") payload.key = String(key);

  const { data } = await axios.post(url, payload, {
    headers: { "Content-Type": "application/json" },
  });

  return data;
}

/**
 * QUERY (read-only): POST /apis/{api}/query/{method}
 * payload: { input }
 */
export async function ffQuery(role, apiName, method, input = {}) {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/query/${method}`;

  const { data } = await axios.post(
    url,
    { input },
    { headers: { "Content-Type": "application/json" } }
  );

  return data;
}
