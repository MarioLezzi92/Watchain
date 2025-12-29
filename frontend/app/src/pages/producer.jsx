import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { getAddress } from "../lib/auth";

export default function Producer({ address, onLogout }) {
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState("");
  const [inventory, setInventory] = useState([]);

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listings, setListings] = useState([]);

  const [tokenId, setTokenId] = useState("1");
  const [priceLux, setPriceLux] = useState("10");

  const [mintTo, setMintTo] = useState("");
  const [mintLoading, setMintLoading] = useState(false);

  // Admin controls (owner)
  const [resellerAddr, setResellerAddr] = useState("");
  const [resellerEnabled, setResellerEnabled] = useState(true);

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
    if (n.includes(".")) throw new Error("Inserisci un numero intero di LUX (es. 10), niente decimali.");
    return `${n}000000000000000000`;
  };

  const doMint = async () => {
    setMintLoading(true);
    try {
      const body = {};
      if (String(mintTo || "").trim()) body.to = String(mintTo).trim();
      await apiPost("/nft/mint", body);
      alert("Mint avviato. Ora fai Refresh inventory (o aspetta qualche secondo).");
      await refreshInventory();
      await refreshListings();
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setMintLoading(false);
    }
  };

  const doListPrimary = async () => {
    try {
      const p = toWei18(priceLux);
      await apiPost("/market/listPrimary", { tokenId: String(tokenId), price: p });
      alert(`Listing PRIMARY creato per tokenId ${tokenId}.`);
      await refreshListings();
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  const doCancel = async (tid) => {
    try {
      await apiPost("/market/cancelListing", { tokenId: String(tid) });
      alert(`Listing cancellato per tokenId ${tid}.`);
      await refreshListings();
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  // Admin (EmergencyStop + whitelist)
  const doPauseNft = async () => {
    try {
      await apiPost("/nft/pause", {});
      alert("NFT paused.");
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  const doUnpauseNft = async () => {
    try {
      await apiPost("/nft/unpause", {});
      alert("NFT unpaused.");
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  const doPauseMarket = async () => {
    try {
      await apiPost("/market/pause", {});
      alert("Market paused.");
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  const doUnpauseMarket = async () => {
    try {
      await apiPost("/market/unpause", {});
      alert("Market unpaused.");
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  const doSetReseller = async () => {
    try {
      await apiPost("/nft/setReseller", {
        who: String(resellerAddr).trim(),
        enabled: Boolean(resellerEnabled),
      });
      alert("Reseller whitelist aggiornata.");
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  const primaryListings = listings.filter((x) => String(x.saleType).toUpperCase() === "PRIMARY");
  const isMineSeller = (seller) => String(seller || "").toLowerCase() === String(me || "").toLowerCase();

  return (
    <div style={{ padding: 32, color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 56, margin: 0, lineHeight: 1.05 }}>Producer Dashboard</h1>

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

      {/* Admin controls */}
      <div style={{ marginTop: 26 }}>
        <h2 style={{ marginBottom: 8 }}>Admin controls (owner)</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={doPauseNft} style={btn()}>
            Pause NFT
          </button>
          <button onClick={doUnpauseNft} style={btn()}>
            Unpause NFT
          </button>
          <button onClick={doPauseMarket} style={btn()}>
            Pause Market
          </button>
          <button onClick={doUnpauseMarket} style={btn()}>
            Unpause Market
          </button>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Reseller address</div>
            <input
              value={resellerAddr}
              onChange={(e) => setResellerAddr(e.target.value)}
              placeholder="0x..."
              style={input(420)}
            />
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center", opacity: 0.9 }}>
            <input type="checkbox" checked={resellerEnabled} onChange={(e) => setResellerEnabled(e.target.checked)} />
            enabled
          </label>

          <button onClick={doSetReseller} style={{ ...btn(), border: "1px solid #fff" }}>
            Set Reseller
          </button>
        </div>
      </div>

      <hr style={{ margin: "28px 0", borderColor: "#2a2a2a" }} />

      {/* MINT */}
      <div style={{ marginTop: 10 }}>
        <h2 style={{ marginBottom: 8 }}>Manufacture / Mint nuovo orologio (NFT)</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Mint to (opzionale)</div>
            <input
              value={mintTo}
              onChange={(e) => setMintTo(e.target.value)}
              placeholder="0x... (se vuoto: mint al Producer)"
              style={input(420)}
            />
          </div>

          <button
            onClick={doMint}
            disabled={mintLoading}
            style={{
              ...btn(),
              border: "1px solid #fff",
              cursor: mintLoading ? "not-allowed" : "pointer",
            }}
          >
            {mintLoading ? "Minting..." : "Mint"}
          </button>
        </div>
      </div>

      <hr style={{ margin: "28px 0", borderColor: "#2a2a2a" }} />

      {/* INVENTORY */}
      <div style={{ marginTop: 10 }}>
        <h2 style={{ marginBottom: 8 }}>Inventory</h2>

        {invError ? <div style={{ color: "#ff4d4f", marginBottom: 12 }}>{invError}</div> : null}

        <button onClick={refreshInventory} disabled={invLoading} style={btn(invLoading)}>
          {invLoading ? "Loading..." : "Refresh"}
        </button>

        <ul style={{ marginTop: 16, opacity: 0.9 }}>
          {inventory.length === 0 ? (
            <li>Nessun NFT in inventory (o non hai fatto refresh).</li>
          ) : (
            inventory.map((it, idx) => (
              <li key={`${it.tokenId ?? idx}-${idx}`} style={{ marginBottom: 8 }}>
                <b>tokenId:</b> {String(it.tokenId)} | <b>owner:</b> {String(it.owner)} | <b>certified:</b>{" "}
                <b>{String(it.certified)}</b>
              </li>
            ))
          )}
        </ul>
      </div>

      <hr style={{ margin: "28px 0", borderColor: "#2a2a2a" }} />

      {/* LIST PRIMARY */}
      <div>
        <h2 style={{ marginBottom: 8 }}>Crea listing PRIMARY (Producer → Reseller)</h2>

        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>tokenId</div>
            <input value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="es. 1" style={input(180)} />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>prezzo (LUX intero)</div>
            <input value={priceLux} onChange={(e) => setPriceLux(e.target.value)} placeholder="es. 10" style={input(220)} />
          </div>

          <button onClick={doListPrimary} style={{ ...btn(), border: "1px solid #fff" }}>
            Lista PRIMARY
          </button>
        </div>

        {listError ? <div style={{ color: "#ff4d4f", marginTop: 12 }}>{listError}</div> : null}
      </div>

      <hr style={{ margin: "28px 0", borderColor: "#2a2a2a" }} />

      {/* LISTINGS */}
      <div>
        <h2 style={{ marginBottom: 8 }}>Market listings</h2>

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
