export async function metamaskLogin() {
  if (!window.ethereum) throw new Error("MetaMask non trovato");

  const [address] = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  // 1) nonce dal backend
  const base = import.meta.env.VITE_BACKEND_BASE || "http://localhost:3001";
  const nonceRes = await fetch(`${base}/auth/nonce?address=${address}`);
  if (!nonceRes.ok) throw new Error("Errore nonce");
  const { nonce } = await nonceRes.json();

  // 2) firma
  const message = `Login to WatchDApp\nNonce: ${nonce}`;
  const signature = await window.ethereum.request({
    method: "personal_sign",
    params: [message, address],
  });

  // 3) login -> JWT (role deciso dal backend)
  const loginRes = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature }),
  });

  if (!loginRes.ok) {
    const txt = await loginRes.text().catch(() => "");
    throw new Error(`Login fallito: ${loginRes.status} ${txt}`);
  }

  const { token, role } = await loginRes.json();

  localStorage.setItem("token", token);
  localStorage.setItem("address", address);
  localStorage.setItem("role", role);

  return { address, token, role };
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("address");
  localStorage.removeItem("role");
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
