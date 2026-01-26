const KEY_ADDRESS = "watchain.address";
const KEY_ROLE = "watchain.role";
export const AUTH_EVENT = "watchain:auth";

export function saveSession(address, role) {
  if (!address || !role) throw new Error("saveSession: dati mancanti");
  localStorage.setItem(KEY_ADDRESS, address);
  localStorage.setItem(KEY_ROLE, role);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearSession() {
  localStorage.removeItem(KEY_ADDRESS);
  localStorage.removeItem(KEY_ROLE);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function getAddress() {
  return localStorage.getItem(KEY_ADDRESS);
}

export function getRole() {
  return localStorage.getItem(KEY_ROLE);
}

export function isLoggedIn() {
  return !!getAddress() && !!getRole();
}

export function logout() {
  clearSession();
}
