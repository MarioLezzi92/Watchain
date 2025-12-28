// frontend/app/src/pages/Consumer.jsx
import React, { useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { getAddress } from "../lib/auth";

export default function Consumer({ address, onLogout }) {
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState("");
  const [inventory, setInventory] = useState([]);

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listings, setListings] = useState([]);

  // Serve per fare approve(spender=WatchMarket, value=price) prima del buy
  const WATCHMARKET_ADDRESS = String(import.meta.env.VITE_WATCHMARKET_ADDRESS || "")
    .trim()
    .replace(/["';\s]/g, "");

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
      const arr = Array.isArray(data) ? data : [];
      // safety: consumer deve vedere solo SECONDARY
      setListings(arr.filter((x) => String(x.saleType).toUpperCase() === "SECONDARY"));
    } catch (e) {
      setListings([]);
      setListError(String(e.message || e));
    } finally {
      setListLoading(false);
    }
  };

  const ensureApprove = async (amountWei) => {
    const s = (WATCHMARKET_ADDRESS || "").trim();

    if (!/^0x[a-fA-F0-9]{40}$/.test(s)) {
      throw new Error(
        `VITE_WATCHMARKET_ADDRESS non valido: '${WATCHMARKET_ADDRESS}'. Deve essere un address 0x... da 40 hex.`
      );
    }

    const amt = String(amountWei ?? "").trim();
    if (!/^\d+$/.test(amt)) {
      throw new Error(`Prezzo non valido per approve: '${amountWei}'`);
    }

    // Backend: /coin/approve -> FireFly LuxuryCoin.approve(spender, value)
    await apiPost("/coin/approve", { spender: s, amount: amt });
  };

  const doBuy = async (listing) => {
    try {
      // 1) approve ERC20 per il prezzo del listing
      await ensureApprove(String(listing.price));

      // 2) buy del market
      await apiPost("/market/buy", { tokenId: String(listing.tokenId) });

      await refreshListings();
      await refreshInventory();
      alert(`Acquisto avviato per tokenId ${listing.tokenId} (controlla Events/Inventory).`);
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  return (
    <div style={{ padding: 32, color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 56, margin: 0, lineHeight: 1.05 }}>Consumer Dashboard</h1>
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
        <h2 style={{ marginBottom: 8 }}>Market listings (SECONDARY)</h2>

        {WATCHMARKET_ADDRESS ? null : (
          <div style={{ color: "#ffcc00", marginBottom: 12 }}>
            Nota: manca <b>VITE_WATCHMARKET_ADDRESS</b> nel frontend .env → l&apos;acquisto fallirà
            perché serve approve prima di buy.
          </div>
        )}

        {listError ? <div style={{ color: "#ff4d4f", marginBottom: 12 }}>{listError}</div> : null}

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
            <li>Nessun listing SECONDARY attivo.</li>
          ) : (
            listings.map((l, idx) => (
              <li key={`${l.tokenId}-${idx}`} style={{ marginBottom: 10 }}>
                <div>
                  <b>tokenId:</b> {String(l.tokenId ?? "-")} | <b>seller:</b> {String(l.seller ?? "-")} |{" "}
                  <b>price:</b> {String(l.price ?? "-")} | <b>saleType:</b> {String(l.saleType ?? "-")}
                </div>
                <button
                  onClick={() => doBuy(l)}
                  style={{
                    marginTop: 8,
                    background: "#111",
                    border: "1px solid #222",
                    color: "white",
                    padding: "10px 14px",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  Compra
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
