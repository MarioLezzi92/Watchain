import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { getAddress } from "../lib/auth";

export default function Reseller({ address, onLogout }) {
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState("");
  const [inventory, setInventory] = useState([]);

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listings, setListings] = useState([]);

  const [secondaryPriceLux, setSecondaryPriceLux] = useState("20");

  // Balance
  const [balanceLux, setBalanceLux] = useState("-");
  const [balLoading, setBalLoading] = useState(false);

  const me = useMemo(() => address || getAddress() || "-", [address]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("address");
    localStorage.removeItem("role");
    if (typeof onLogout === "function") onLogout();
    else window.location.reload();
  };

  const refreshBalance = async () => {
    setBalLoading(true);
    try {
      const b = await apiGet("/wallet/balance");
      setBalanceLux(String(b?.lux ?? "-"));
    } catch {
      setBalanceLux("?");
    } finally {
      setBalLoading(false);
    }
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

  useEffect(() => {
    refreshBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toWei18 = (lux) => {
    const n = String(lux || "").trim();
    if (!n) return "0";
    if (n.includes(".")) throw new Error("Inserisci un numero intero di LUX (es. 20), niente decimali.");
    return `${n}000000000000000000`;
  };

  const doBuy = async (tokenId) => {
    try {
      await apiPost("/market/buy", { tokenId: String(tokenId) });
      alert(`Acquisto avviato per tokenId ${tokenId}.`);
      await refreshListings();
      await refreshInventory();
      await refreshBalance();
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

  const doCancel = async (tokenId) => {
    try {
      await apiPost("/market/cancelListing", { tokenId: String(tokenId) });
      alert(`Listing cancellato per tokenId ${tokenId}.`);
      await refreshListings();
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  const primaryListings = listings.filter((x) => String(x.saleType).toUpperCase() === "PRIMARY");
  const secondaryListings = listings.filter((x) => String(x.saleType).toUpperCase() === "SECONDARY");

  const isMineSeller = (seller) => String(seller || "").toLowerCase() === String(me || "").toLowerCase();

  return (
    <div style={{ padding: 32, color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 56, margin: 0, lineHeight: 1.05 }}>Reseller Dashboard</h1>

          <div style={{ marginTop: 10, opacity: 0.9 }}>
            Logged as: <b>{me}</b>
          </div>

          <div style={{ marginTop: 10, opacity: 0.9, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              Balance: <b>{balanceLux}</b> LUX
            </div>
            <button onClick={refreshBalance} disabled={balLoading} style={{ ...btn(balLoading), padding: "8px 12px" }}>
              {balLoading ? "..." : "Refresh balance"}
            </button>
          </div>
        </div>

        <button onClick={logout} style={btn()}>
          Logout
        </button>
      </div>

      <div style={{ marginTop: 34 }}>
        <h2 style={{ marginBottom: 8 }}>Market PRIMARY (compra dal Producer)</h2>

        {listError ? <div style={{ color: "#ff4d4f", marginBottom: 12 }}>{listError}</div> : null}

        <button onClick={refreshListings} disabled={listLoading} style={{ ...btn(listLoading), border: "1px solid #fff" }}>
          {listLoading ? "Loading..." : "Refresh listings"}
        </button>

        <ul style={{ marginTop: 16, opacity: 0.9 }}>
          {primaryListings.length === 0 ? (
            <li>Nessun listing PRIMARY attivo.</li>
          ) : (
            primaryListings.map((l, idx) => (
              <li key={`${l.tokenId}-${idx}`} style={{ marginBottom: 12 }}>
                <div>
                  <b>tokenId:</b> {String(l.tokenId)} | <b>seller:</b> {String(l.seller)} | <b>price:</b>{" "}
                  {String(l.price)} | <b>saleType:</b> {String(l.saleType)}
                </div>
                <button onClick={() => doBuy(l.tokenId)} style={{ ...btn(), marginTop: 8 }}>
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

        <button onClick={refreshInventory} disabled={invLoading} style={btn(invLoading)}>
          {invLoading ? "Loading..." : "Refresh inventory"}
        </button>

        <div style={{ marginTop: 18, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Prezzo SECONDARY (LUX intero)</div>
            <input value={secondaryPriceLux} onChange={(e) => setSecondaryPriceLux(e.target.value)} placeholder="es. 20" style={input(220)} />
          </div>
        </div>

        <ul style={{ marginTop: 16, opacity: 0.9 }}>
          {inventory.length === 0 ? (
            <li>Nessun NFT in inventory (o non hai fatto refresh).</li>
          ) : (
            inventory.map((it, idx) => (
              <li key={`${it.tokenId ?? idx}-${idx}`} style={{ marginBottom: 14 }}>
                <div>
                  <b>tokenId:</b> {String(it.tokenId)} | <b>certified:</b> <b>{String(it.certified)}</b>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <button onClick={() => doCertify(it.tokenId)} style={btn()}>
                    Certifica
                  </button>

                  <button onClick={() => doListSecondary(it.tokenId)} style={{ ...btn(), border: "1px solid #fff" }}>
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
              <li key={`${l.tokenId}-s-${idx}`} style={{ marginBottom: 12 }}>
                <div>
                  <b>tokenId:</b> {String(l.tokenId)} | <b>seller:</b> {String(l.seller)} | <b>price:</b>{" "}
                  {String(l.price)} | <b>saleType:</b> {String(l.saleType)}
                </div>

                {isMineSeller(l.seller) ? (
                  <button onClick={() => doCancel(l.tokenId)} style={{ ...btn(), marginTop: 8 }}>
                    Cancel listing
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function btn(disabled = false) {
  return {
    background: "#111",
    border: "1px solid #222",
    color: "white",
    padding: "12px 18px",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function input(w) {
  return {
    width: w,
    padding: 10,
    borderRadius: 10,
    border: "1px solid #222",
    background: "#111",
    color: "#fff",
  };
}
