import { ffQuery } from "./fireflyService.js";
import { unwrapFFOutput, normalizeRole } from "../utils/formatters.js";

const LUX_API = "LuxuryCoin_API";

export async function getBalance(role, address) {
  const r = normalizeRole(role);
  try {
    const res = await ffQuery(r, LUX_API, "balanceOf", { account: address }, address);
    return unwrapFFOutput(res) || "0";
  } catch (err) {
    console.error("[WalletService] Errore saldo:", err.message);
    return "0";
  }
}