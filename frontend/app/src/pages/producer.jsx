// frontend/app/src/pages/Producer.jsx
import React, { useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { getAddress } from "../lib/auth";

export default function Producer({ address, onLogout }) {
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState("");
  const [inventory, setInventory] = useState([]);

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listings, setListings] = useState([]);

  const [tokenId, setTokenId] = useState("");
  const [priceLux, setPriceLux] = useState("10");

  const me = useMemo(() => address || getAddress() || "-", [address]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("address");
    localStorage.removeItem("role");
    if (typeof onLogout === "function") onLogout();
    else window.location.reload();
  };

  const refreshInventory = async () => {
    setInvLoading(true);
    setInvError("");
    try {
      const data = await apiGet("/inventory");
      setInventory(Array.isArray(data) ? data : []);
    } catch (e) {
      setInventory([]);
      setInvError(String(e.message || e));
    } finally {
      setInvLoading(false);
    }
  };

  const refreshListings = async () => {
    setListLoading(true);
    setListError("");
    try {
      const data = await apiGet("/market/listings");
      setListings(Array.isArray(data) ? data : []);
    } catch (e) {
      setListings([]);
      setListError(String(e.message || e));
    } finally {
      setListLoading(false);
    }
  };

  const toWei18 = (lux) => {
    // UX semplice: supporta numeri interi (10 -> 10e18)
    const n = String(lux || "").trim();
    if (!n) return "0";
    if (n.includes(".")) {
      // evita casino: niente decimali
      throw new Error("Inserisci un numero intero di LUX (es. 10), niente decimali.");
    }
    return `${n}000000000000000000`;
  };

  const doListPrimary = async () => {
    try {
      const p = toWei18(priceLux);
      await apiPost("/market/listPrimary", { tokenId: String(tokenId), price: p });
      alert("Listing PRIMARY creato (controlla Market listings).");
      await refreshListings();
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  return (
    <div style={{ padding: 32, color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 56, margin: 0, lineHeight: 1.05 }}>Producer Dashboard</h1>
          <div style={{ marginTop: 10, opacity: 0.9 }}>
            <div>
              Logged as: <b>{me}</b>
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

        {invError ? <div style={{ color: "#ff4d4f", marginBottom: 12 }}>{invError}</div> : null}

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
                <b>tokenId:</b> {String(it.tokenId)} | <b>owner:</b> {String(it.owner)} |{" "}
                <b>certified:</b> <b>{String(it.certified)}</b>
              </li>
            ))
          )}
        </ul>
      </div>

      <hr style={{ margin: "28px 0", borderColor: "#2a2a2a" }} />

      <div>
        <h2 style={{ marginBottom: 8 }}>Crea listing PRIMARY (Producer → Reseller)</h2>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>tokenId</div>
            <input
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              placeholder="es. 3"
              style={{
                width: 140,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #222",
                background: "#111",
                color: "#fff",
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>prezzo (LUX intero)</div>
            <input
              value={priceLux}
              onChange={(e) => setPriceLux(e.target.value)}
              placeholder="es. 10"
              style={{
                width: 160,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #222",
                background: "#111",
                color: "#fff",
              }}
            />
          </div>

          <button
            onClick={doListPrimary}
            style={{
              marginTop: 18,
              background: "#111",
              border: "1px solid #fff",
              color: "white",
              padding: "12px 18px",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            Lista PRIMARY
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <h2 style={{ marginBottom: 8 }}>Market listings (live)</h2>

          {listError ? <div style={{ color: "#ff4d4f", marginBottom: 12 }}>{listError}</div> : null}

          <button
            onClick={refreshListings}
            disabled={listLoading}
            style={{
              background: "#111",
              border: "1px solid #222",
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
                <li key={`${l.tokenId}-${idx}`} style={{ marginBottom: 10 }}>
                  <b>tokenId:</b> {String(l.tokenId)} | <b>seller:</b> {String(l.seller)} |{" "}
                  <b>price:</b> {String(l.price)} | <b>saleType:</b> {String(l.saleType)}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
