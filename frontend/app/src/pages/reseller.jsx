// frontend/app/src/pages/Reseller.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, getConfig } from "../lib/api";
import { getAddress } from "../lib/auth";

function fromWei18(wei) {
  const s = String(wei ?? "").trim();
  if (!/^\d+$/.test(s)) return String(wei ?? "-");
  if (s === "0") return "0";

  if (s.length <= 18) return `0.${s.padStart(18, "0")}`.replace(/\.?0+$/, "");
  const head = s.slice(0, -18);
  const tail = s.slice(-18);
  const tailTrim = tail.replace(/0+$/, "");
  return tailTrim ? `${head}.${tailTrim}` : head;
}

function toWei18(lux) {
  const n = String(lux || "").trim();
  if (!n) return "0";
  if (n.includes(".")) throw new Error("Inserisci un numero intero di LUX (es. 20), niente decimali.");
  return `${n}000000000000000000`;
}

export default function Reseller({ address, onLogout }) {
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState("");
  const [inventory, setInventory] = useState([]);

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listings, setListings] = useState([]);

  const [secondaryPriceLux, setSecondaryPriceLux] = useState("20");

  const [status, setStatus] = useState({ type: "", text: "" }); // type: info|ok|err
  const [busy, setBusy] = useState(false);

  const [cfg, setCfg] = useState({ watchMarketAddress: "" });

  const [luxBalanceWei, setLuxBalanceWei] = useState("0");
  const [luxAllowanceWei, setLuxAllowanceWei] = useState("0");

  const [useApproveMax, setUseApproveMax] = useState(true);

  const me = useMemo(() => address || getAddress() || "-", [address]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("address");
    localStorage.removeItem("role");
    if (typeof onLogout === "function") onLogout();
    else window.location.reload();
  };

  useEffect(() => {
    (async () => {
      try {
        const c = await getConfig();
        setCfg({ watchMarketAddress: String(c.watchMarketAddress || "").trim() });
      } catch {
        setCfg({ watchMarketAddress: "" });
      }
    })();
  }, []);

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

  const refreshCoinInfo = async () => {
    try {
      const b = await apiGet("/coin/balance");
      setLuxBalanceWei(String(b?.balance ?? "0"));
    } catch {
      setLuxBalanceWei("0");
    }

    try {
      const a = await apiGet("/coin/allowance");
      setLuxAllowanceWei(String(a?.allowance ?? "0"));
    } catch {
      setLuxAllowanceWei("0");
    }
  };

  const ensureApprove = async (amountWei) => {
    const spender = String(cfg.watchMarketAddress || "").trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(spender)) {
      throw new Error(`WatchMarket address non valido da /config: '${spender}'`);
    }

    if (useApproveMax) {
      await apiPost("/coin/approveMax", { spender });
      return;
    }

    const amt = String(amountWei ?? "").trim();
    if (!/^\d+$/.test(amt)) throw new Error(`Prezzo non valido: '${amountWei}'`);
    await apiPost("/coin/approve", { spender, amount: amt });
  };

  const doBuyPrimary = async (listing) => {
    setBusy(true);
    setStatus({ type: "info", text: "Acquisto PRIMARY in corso: approve → buy…" });
    try {
      await ensureApprove(String(listing.price));
      await apiPost("/market/buy", { tokenId: String(listing.tokenId) });
      setStatus({ type: "ok", text: `Acquisto avviato per tokenId ${listing.tokenId}.` });
      await refreshListings();
      await refreshInventory();
      await refreshCoinInfo();
    } catch (e) {
      setStatus({ type: "err", text: String(e.message || e) });
    } finally {
      setBusy(false);
    }
  };

  const doCertify = async (tokenId) => {
    setBusy(true);
    setStatus({ type: "info", text: `Certificazione tokenId ${tokenId}…` });
    try {
      await apiPost("/nft/certify", { tokenId: String(tokenId) });
      setStatus({ type: "ok", text: `Certificazione avviata per tokenId ${tokenId}.` });
      await refreshInventory();
    } catch (e) {
      setStatus({ type: "err", text: String(e.message || e) });
    } finally {
      setBusy(false);
    }
  };

  const doListSecondary = async (tokenId) => {
    setBusy(true);
    setStatus({ type: "info", text: `Listing SECONDARY tokenId ${tokenId}…` });
    try {
      const p = toWei18(secondaryPriceLux);
      await apiPost("/market/listSecondary", { tokenId: String(tokenId), price: p });
      setStatus({ type: "ok", text: `Listing SECONDARY creato per tokenId ${tokenId}.` });
      await refreshListings();
    } catch (e) {
      setStatus({ type: "err", text: String(e.message || e) });
    } finally {
      setBusy(false);
    }
  };

  const primaryListings = listings.filter((x) => String(x.saleType).toUpperCase() === "PRIMARY");
  const secondaryListings = listings.filter((x) => String(x.saleType).toUpperCase() === "SECONDARY");

  const statusBg =
    status.type === "ok" ? "#103b1f" : status.type === "err" ? "#3b1010" : status.type === "info" ? "#10203b" : "transparent";

  return (
    <div style={{ padding: 32, color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 56, margin: 0, lineHeight: 1.05 }}>Reseller Dashboard</h1>
          <div style={{ marginTop: 10, opacity: 0.9 }}>
            <div>
              Logged as: <b>{me}</b>
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
              LUX balance: <b>{fromWei18(luxBalanceWei)}</b> | allowance→market: <b>{fromWei18(luxAllowanceWei)}</b>
              <button
                onClick={refreshCoinInfo}
                disabled={busy}
                style={{
                  marginLeft: 10,
                  background: "#111",
                  border: "1px solid #222",
                  color: "white",
                  padding: "6px 10px",
                  borderRadius: 10,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                Refresh coin
              </button>
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

      {status.text ? (
        <div
          style={{
            marginTop: 18,
            background: statusBg,
            border: "1px solid #222",
            borderRadius: 12,
            padding: "10px 12px",
            opacity: 0.95,
          }}
        >
          {status.text}
        </div>
      ) : null}

      <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="checkbox"
          checked={useApproveMax}
          onChange={(e) => setUseApproveMax(e.target.checked)}
          id="approveMax"
        />
        <label htmlFor="approveMax" style={{ opacity: 0.9 }}>
          Usa approve infinito (consigliato)
        </label>
      </div>

      <div style={{ marginTop: 26 }}>
        <h2 style={{ marginBottom: 8 }}>Market PRIMARY (compra dal Producer)</h2>

        {listError ? <div style={{ color: "#ff4d4f", marginBottom: 12 }}>{listError}</div> : null}

        <button
          onClick={refreshListings}
          disabled={listLoading || busy}
          style={{
            background: "#111",
            border: "1px solid #fff",
            color: "white",
            padding: "12px 18px",
            borderRadius: 10,
            cursor: listLoading || busy ? "not-allowed" : "pointer",
          }}
        >
          {listLoading ? "Loading..." : "Refresh listings"}
        </button>

        <ul style={{ marginTop: 16, opacity: 0.95 }}>
          {primaryListings.length === 0 ? (
            <li>Nessun listing PRIMARY attivo.</li>
          ) : (
            primaryListings.map((l, idx) => (
              <li key={`${l.tokenId}-${idx}`} style={{ marginBottom: 12 }}>
                <div>
                  <b>tokenId:</b> {String(l.tokenId)} | <b>seller:</b> {String(l.seller)} |{" "}
                  <b>price:</b> <b>{fromWei18(l.price)} LUX</b> | <b>saleType:</b> {String(l.saleType)}
                </div>
                <button
                  onClick={() => doBuyPrimary(l)}
                  disabled={busy}
                  style={{
                    marginTop: 8,
                    background: "#111",
                    border: "1px solid #222",
                    color: "white",
                    padding: "10px 14px",
                    borderRadius: 10,
                    cursor: busy ? "not-allowed" : "pointer",
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
          disabled={invLoading || busy}
          style={{
            background: "#111",
            border: "1px solid #222",
            color: "white",
            padding: "12px 18px",
            borderRadius: 10,
            cursor: invLoading || busy ? "not-allowed" : "pointer",
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

        <ul style={{ marginTop: 16, opacity: 0.95 }}>
          {inventory.length === 0 ? (
            <li>Nessun NFT in inventory (o non hai fatto refresh).</li>
          ) : (
            inventory.map((it, idx) => (
              <li key={`${it.tokenId ?? idx}-${idx}`} style={{ marginBottom: 14 }}>
                <div>
                  <b>tokenId:</b> {String(it.tokenId)} | <b>certified:</b> <b>{String(it.certified)}</b>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => doCertify(it.tokenId)}
                    disabled={busy}
                    style={{
                      background: "#111",
                      border: "1px solid #222",
                      color: "white",
                      padding: "10px 14px",
                      borderRadius: 10,
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    Certifica
                  </button>

                  <button
                    onClick={() => doListSecondary(it.tokenId)}
                    disabled={busy}
                    style={{
                      background: "#111",
                      border: "1px solid #fff",
                      color: "white",
                      padding: "10px 14px",
                      borderRadius: 10,
                      cursor: busy ? "not-allowed" : "pointer",
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
        <ul style={{ marginTop: 16, opacity: 0.95 }}>
          {secondaryListings.length === 0 ? (
            <li>Nessun listing SECONDARY attivo.</li>
          ) : (
            secondaryListings.map((l, idx) => (
              <li key={`${l.tokenId}-s-${idx}`} style={{ marginBottom: 10 }}>
                <b>tokenId:</b> {String(l.tokenId)} | <b>seller:</b> {String(l.seller)} |{" "}
                <b>price:</b> <b>{fromWei18(l.price)} LUX</b> | <b>saleType:</b> {String(l.saleType)}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
