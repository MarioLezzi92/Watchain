/**
 * GESTORE DELLA SESSIONE LOCALE
 * Centralizza l'accesso al LocalStorage ed evita "stringhe magiche" sparse nel codice.
 */

// 1. Definiamo le costanti per le chiavi (così non sbagliamo a scriverle)
const STORAGE_KEYS = {
  TOKEN: "token",
  ADDRESS: "address",
  ROLE: "role"
};

// --- GETTERS (Lettura) ---

export function getToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

export function getAddress() {
  return localStorage.getItem(STORAGE_KEYS.ADDRESS);
}

export function getRole() {
  return localStorage.getItem(STORAGE_KEYS.ROLE);
}

export function isAuthenticated() {
  return !!getToken();
}

// --- SETTERS (Scrittura) ---

/**
 * Salva l'intera sessione in un colpo solo.
 * Da usare nella pagina di Login dopo il successo.
 */
export function saveSession(token, address, role) {
  if(token) localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  if(address) localStorage.setItem(STORAGE_KEYS.ADDRESS, address);
  if(role) localStorage.setItem(STORAGE_KEYS.ROLE, role);
}

/**
 * Pulisce tutto e reindirizza.
 * Nota: La chiamata API al backend per invalidare il token
 * dovrebbe essere fatta dal componente UI *prima* di chiamare questa funzione.
 */
export function logout() {
  // 1. Pulizia Totale
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });

  // 2. Redirect forzato
  window.location.href = "/market";
}

export function getAddressFromToken() {
  const token = getToken();
  if (!token) return null;
  try {
    // Decodifica la parte centrale (payload) del JWT
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    
    // Il backend mette l'indirizzo in 'sub'
    return payload.sub; 
  } catch (e) {
    return null;
  }
}