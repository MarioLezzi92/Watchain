import React, { useMemo, useState } from "react";

const API_BASE = "http://localhost:3001";

function getStoredJwt() {
  // compatibilità: a volte hai salvato jwt, a volte token
  return localStorage.getItem("jwt") || localStorage.getItem("token") || "";
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchJSON(path) {
  const token = getStoredJwt();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await res.text(); // così catturiamo anche HTML tipo "Cannot GET ..."
  const maybeJson = safeJsonParse(text);

  if (!res.ok) {
    const msg =
      (maybeJson && (maybeJson.error || maybeJson.message)) ||
      text ||
      `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  // Se torna JSON ok, usalo. Se torna testo, prova a parsarlo.
  return maybeJson ?? text;
}

export default function Consumer({ address, onLogout }) {
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState("");
  const [inventory, setInventory] = useState([]);

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listings, setListings] = useState([]);

  const jwt = useMemo(() => getStoredJwt(), []);

  const logout = () => {
    // pulizia "hard"
    localStorage.removeItem("jwt");
    localStorage.removeItem("token");
    localStorage.removeItem("address");
    if (typeof onLogout === "function") onLogout();
    else window.location.reload();
  };

  const refreshInventory = async () => {
    setInvLoading(true);
    setInvError("");
    try {
      const data = await fetchJSON("/inventory");
      // mi aspetto: [{ tokenId, owner, certified }, ...]
      if (Array.isArray(data)) setInventory(data);
      else setInventory([]);
    } catch (e) {
      setInventory([]);
      setInvError(`HTTP ${e.status || "?"} - ${e.message}`);
    } finally {
      setInvLoading(false);
    }
  };

  const refreshListings = async () => {
    setListLoading(true);
    setListError("");
    try {
      const data = await fetchJSON("/market/listings");
      // mi aspetto: array (anche vuoto)
      if (Array.isArray(data)) setListings(data);
      else setListings([]);
    } catch (e) {
      setListings([]);
      setListError(`HTTP ${e.status || "?"} - ${e.message}`);
    } finally {
      setListLoading(false);
    }
  };

  return (
    <div style={{ padding: 32, color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 56, margin: 0, lineHeight: 1.05 }}>Consumer Dashboard</h1>
          <div style={{ marginTop: 10, opacity: 0.9 }}>
            <div>Logged as: <b>{address || localStorage.getItem("address") || "-"}</b></div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              JWT presente: <b>{jwt ? "sì" : "no"}</b>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            background: "#111",
            border: "1px solid #222",
            color: "white",
            padding: "12px 18px",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ marginTop: 34 }}>
        <h2 style={{ marginBottom: 8 }}>Inventory (live)</h2>

        {invError ? (
          <div style={{ color: "#ff4d4f", marginBottom: 12 }}>{invError}</div>
        ) : null}

        <button
          onClick={refreshInventory}
          disabled={invLoading}
          style={{
            background: "#111",
            border: "1px solid #222",
            color: "white",
            padding: "12px 18px",
            borderRadius: 10,
            cursor: invLoading ? "not-allowed" : "pointer",
          }}
        >
          {invLoading ? "Loading..." : "Refresh"}
        </button>

        <ul style={{ marginTop: 16, opacity: 0.9 }}>
          {inventory.length === 0 ? (
            <li>Nessun NFT in inventory (o non hai fatto refresh).</li>
          ) : (
            inventory.map((it, idx) => (
              <li key={`${it.tokenId ?? idx}-${idx}`} style={{ marginBottom: 8 }}>
                <b>tokenId:</b> {String(it.tokenId)}{" "}
                | <b>owner:</b> {String(it.owner)}{" "}
                | <b>certified:</b> <b>{String(it.certified)}</b>
              </li>
            ))
          )}
        </ul>
      </div>

      <hr style={{ margin: "28px 0", borderColor: "#2a2a2a" }} />

      <div>
        <h2 style={{ marginBottom: 8 }}>Market listings (live)</h2>

        {listError ? (
          <div style={{ color: "#ff4d4f", marginBottom: 12 }}>{listError}</div>
        ) : null}

        <button
          onClick={refreshListings}
          disabled={listLoading}
          style={{
            background: "#111",
            border: "1px solid #fff",
            color: "white",
            padding: "12px 18px",
            borderRadius: 10,
            cursor: listLoading ? "not-allowed" : "pointer",
          }}
        >
          {listLoading ? "Loading..." : "Refresh listings"}
        </button>

        <ul style={{ marginTop: 16, opacity: 0.9 }}>
          {listings.length === 0 ? (
            <li>Nessun listing attivo.</li>
          ) : (
            listings.map((l, idx) => (
              <li key={l.id || idx} style={{ marginBottom: 10 }}>
                <div>
                  <b>tokenId:</b> {String(l.tokenId ?? "-")}{" "}
                  | <b>seller:</b> {String(l.seller ?? "-")}{" "}
                  | <b>price:</b> {String(l.price ?? "-")}{" "}
                  | <b>requireCertified:</b> {String(l.requireCertified ?? "-")}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
