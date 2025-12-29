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
  return String(base).replace(/\/+$/, "");
}

/**
 * INVOKE (tx): FireFly richiede spesso "key" e "input"
 * - key: usala se la tua API la usa (spesso non serve, ma non fa male)
 * - input: gli argomenti del metodo.
 */
export async function ffInvoke(role, apiName, method, input = {}, key = "") {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/invoke/${method}`;

  const payload = {
    input,
  };

  // key opzionale: se vuota, FireFly in genere la ignora.
  if (key !== undefined && key !== null) payload.key = String(key);

  const { data } = await axios.post(url, payload);
  return data;
}

/**
 * QUERY (read-only)
 */
export async function ffQuery(role, apiName, method, input = {}) {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/query/${method}`;

  const { data } = await axios.post(url, { input });
  return data;
}
