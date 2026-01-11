
// gestione del local storage per l'autenticazione

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

export async function logout() {
  try {
    const token = getToken();
    if (token) {
      // Avvisa il backend 
      await fetch("http://localhost:3001/api/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
    }
  } catch (err) {
    console.warn("Backend logout failed, cleaning up locally...", err);
  } finally {
    // Pulizia del LocalStorage (Stateful session cleanup) 
    localStorage.removeItem("token");
    localStorage.removeItem("address");
    localStorage.removeItem("role");

    // Redirect forzato alla pagina di login 
    window.location.href = "/market";
  }
}