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

export async function ffInvoke(role, apiName, method, input = {}) {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/invoke/${method}`;
  const { data } = await axios.post(url, { input });
  return data;
}

export async function ffQuery(role, apiName, method, input = {}) {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/query/${method}`;
  const { data } = await axios.post(url, { input });
  return data;
}
