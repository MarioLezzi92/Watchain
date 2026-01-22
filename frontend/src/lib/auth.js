// src/lib/auth.js

const KEY_TOKEN = "watchain.jwt";
const KEY_ADDRESS = "watchain.address";
const KEY_ROLE = "watchain.role";
export const AUTH_EVENT = "watchain:auth";

export function saveSession(token, address, role) {
  if (!token || !address || !role) throw new Error("saveSession: dati mancanti");
  localStorage.setItem(KEY_TOKEN, token);
  localStorage.setItem(KEY_ADDRESS, address);
  localStorage.setItem(KEY_ROLE, role);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearSession() {
  localStorage.removeItem(KEY_TOKEN);
  localStorage.removeItem(KEY_ADDRESS);
  localStorage.removeItem(KEY_ROLE);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function getToken() {
  return localStorage.getItem(KEY_TOKEN);
}

export function getAddress() {
  return localStorage.getItem(KEY_ADDRESS);
}

export function getRole() {
  return localStorage.getItem(KEY_ROLE);
}

export function isLoggedIn() {
  return !!getToken();
}

export function logout() {
  clearSession();
}

