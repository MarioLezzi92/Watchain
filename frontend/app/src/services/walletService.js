import { apiGet, apiPost } from "../lib/api";

export async function getBalance() {
  return await apiGet("/wallet/balance");
}

export async function transferLux(to, amountLux) {

  return await apiPost("/wallet/transfer", {
    to,
    amountLux 
  });
}