// src/lib/auth.js

// Nota: La logica di login con MetaMask ora è interamente in login.jsx
// Qui gestiamo solo il LocalStorage

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("address");
  localStorage.removeItem("role");
  // Redirect forzato
  window.location.href = "/login";
}

export function getToken() {
  return localStorage.getItem("token");
}

export function getAddress() {
  return localStorage.getItem("address");
}

export function getRole() {
  return localStorage.getItem("role");
}

export function isAuthenticated() {
  return !!getToken();
}