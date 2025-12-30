import { apiGet } from "../lib/api";

//la rotta corretta è /wallet/balance
export async function getBalance() {
  return await apiGet("/wallet/balance");
}