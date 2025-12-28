// frontend/app/src/pages/Reseller.jsx
import React, { useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { getAddress, logout as authLogout } from "../lib/auth";

export default function Reseller({ address, onLogout }) {
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState("");
  const [inventory, setInventory] = useState([]);

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listings, setListings] = useState([]);

  const [secondaryPriceLux, setSecondaryPriceLux] = useState("20");

  // WatchMarket address: serve per approve (spender)
  const WATCHMARKET_ADDRESS =
    (import.meta.env.VITE_WATCHMARKET_ADDRESS || "").trim();

  const me = useMemo(() => address || getAddress() || "-", [address]);

  const logout = () => {
    authLogout();
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
    const n = String(lux || "").trim();
    if (!n) return "0";
    if (n.includes(".")) {
      throw new Error("Inserisci un numero intero di LUX (es. 20), niente decimali.");
    }
    return `${n}000000000000000000`;
  };

  // Approve ERC20 (LuxuryCoin) -> spender WatchMarket
  // amount deve essere in wei (18 decimali) es: 10 LUX => 10000000000000000000
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

    await apiPost("/coin/approve", { spender: s, amount: amt });
  };

  const doBuyPrimary = async (listing) => {
    try {
      // 1) approve spender=WatchMarket amount=price
      await ensureApprove(String(listing.price));

      // 2) buy
      await apiPost("/market/buy", { tokenId: String(listing.tokenId) });

      alert(`Acquisto avviato per tokenId ${listing.tokenId}.`);
      await refreshListings();
      await refreshInventory();
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  const doCertify = async (tokenId) => {
    try {
      await apiPost("/nft/certify", { tokenId: String(tokenId) });
      alert(`Certificazione avviata per tokenId ${tokenId}.`);
      await refreshInventory();
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  const doListSecondary = async (tokenId) => {
    try {
      const p = toWei18(secondaryPriceLux);
      await apiPost("/market/listSecondary", { tokenId: String(tokenId), price: p });
      alert(`Listing SECONDARY creato per tokenId ${tokenId}.`);
      await refreshListings();
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  const primaryListings = listings.filter(
    (x) => String(x.saleType).toUpperCase() === "PRIMARY"
  );
  const secondaryListings = listings.filter(
    (x) => String(x.saleType).toUpperCase() === "SECONDARY"
  );

  return (
    <div style={{ padding: 32, color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 56, margin: 0, lineHeight: 1.05 }}>Reseller Dashboard</h1>
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
        <h2 style={{ marginBottom: 8 }}>Market PRIMARY (compra dal Producer)</h2>

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
          {primaryListings.length === 0 ? (
            <li>Nessun listing PRIMARY attivo.</li>
          ) : (
            primaryListings.map((l, idx) => (
              <li key={`${l.tokenId}-${idx}`} style={{ marginBottom: 12 }}>
                <div>
                  <b>tokenId:</b> {String(l.tokenId)} | <b>seller:</b> {String(l.seller)} |{" "}
                  <b>price:</b> {String(l.price)} | <b>saleType:</b> {String(l.saleType)}
                </div>

                <button
                  onClick={() => doBuyPrimary(l)}
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
                  Compra (PRIMARY)
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <hr style={{ margin: "28px 0", borderColor: "#2a2a2a" }} />

      <div>
        <h2 style={{ marginBottom: 8 }}>I miei orologi (Inventory)</h2>

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
          {invLoading ? "Loading..." : "Refresh inventory"}
        </button>

        <div style={{ marginTop: 18, display: "flex", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Prezzo SECONDARY (LUX intero)</div>
            <input
              value={secondaryPriceLux}
              onChange={(e) => setSecondaryPriceLux(e.target.value)}
              placeholder="es. 20"
              style={{
                width: 200,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #222",
                background: "#111",
                color: "#fff",
              }}
            />
          </div>
        </div>

        <ul style={{ marginTop: 16, opacity: 0.9 }}>
          {inventory.length === 0 ? (
            <li>Nessun NFT in inventory (o non hai fatto refresh).</li>
          ) : (
            inventory.map((it, idx) => (
              <li key={`${it.tokenId ?? idx}-${idx}`} style={{ marginBottom: 14 }}>
                <div>
                  <b>tokenId:</b> {String(it.tokenId)} | <b>certified:</b>{" "}
                  <b>{String(it.certified)}</b>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => doCertify(it.tokenId)}
                    style={{
                      background: "#111",
                      border: "1px solid #222",
                      color: "white",
                      padding: "10px 14px",
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                  >
                    Certifica
                  </button>

                  <button
                    onClick={() => doListSecondary(it.tokenId)}
                    style={{
                      background: "#111",
                      border: "1px solid #fff",
                      color: "white",
                      padding: "10px 14px",
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                  >
                    Lista SECONDARY
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <hr style={{ margin: "28px 0", borderColor: "#2a2a2a" }} />

      <div>
        <h2 style={{ marginBottom: 8 }}>Market SECONDARY (vista)</h2>
        <ul style={{ marginTop: 16, opacity: 0.9 }}>
          {secondaryListings.length === 0 ? (
            <li>Nessun listing SECONDARY attivo.</li>
          ) : (
            secondaryListings.map((l, idx) => (
              <li key={`${l.tokenId}-s-${idx}`} style={{ marginBottom: 10 }}>
                <b>tokenId:</b> {String(l.tokenId)} | <b>seller:</b> {String(l.seller)} |{" "}
                <b>price:</b> {String(l.price)} | <b>saleType:</b> {String(l.saleType)}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
