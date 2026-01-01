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
  const payload = { input };
  if (key) payload.key = String(key);
  
  const { data } = await axios.post(url, payload);
  return data;
}

export async function ffQuery(role, apiName, method, input = {}) {
  const base = getBase(role);
  const url = `${base}/apis/${apiName}/query/${method}`;
  const { data } = await axios.post(url, { input });
  return data;
}