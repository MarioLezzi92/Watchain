import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthAPI, FF, FF_BASE } from "../lib/api";
import { saveSession } from "../lib/auth";
import { useWallet } from "../context/WalletContext";
import { useSystem } from "../context/SystemContext";

export default function Login() {
  const navigate = useNavigate();
  const { refreshWallet } = useWallet();
  const { forceRefresh } = useSystem();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onLogin = async () => {
    setErr("");
    setLoading(true);
    try {
      if (!window.ethereum) throw new Error("MetaMask non trovato.");

      // 1. Richiediamo l'account ATTIVO su MetaMask
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });

      if (!accounts || accounts.length === 0) {
        throw new Error("Nessun account selezionato.");
      }

      const address = accounts[0];

      // 2. Otteniamo il Nonce dal Backend
      const resNonce = await AuthAPI.nonce(address);
      const nonce = resNonce?.nonce;
      const message = resNonce?.message;

      if (!nonce) throw new Error("Errore: Nonce non ricevuto.");

      // 3. Firma con MetaMask
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });

      // 4. Login Backend
      const resLogin = await AuthAPI.login(address, signature);
      if (!resLogin?.success) throw new Error("Login fallito.");

      // --- 5. LOGICA DECENTRALIZZATA: Chiediamo il ruolo alla Blockchain ---
      // Usiamo il nodo Producer come fonte pubblica di lettura
      const readNode = FF_BASE.producer;

      const [factoryRes, resellerPermRes, activeResellerRes] = await Promise.all([
        FF.watchNft.query.factory(readNode),
        // reseller(address) = ruolo permanente
        FF.watchNft.query.reseller(readNode, { "": address }),
        // activeReseller(address) = abilitazione operativa
        FF.watchNft.query.activeReseller(readNode, { "": address }),
      ]);

      const factoryAddr = String(factoryRes.output || "").toLowerCase();
      const myAddr = String(address).toLowerCase();

      const isResellerPermanent =
        resellerPermRes.output === true || String(resellerPermRes.output) === "true";

      const isActiveReseller =
        activeResellerRes.output === true || String(activeResellerRes.output) === "true";

      let blockchainRole = "consumer";
      if (myAddr === factoryAddr) {
        blockchainRole = "producer";
      } else if (isResellerPermanent) {
        blockchainRole = "reseller";
      }

      console.log(
        `Ruolo assegnato: ${blockchainRole} (ResellerPerm: ${isResellerPermanent}, Active: ${isActiveReseller})`
      );

      // 6. Salvataggio Sessione con il ruolo reale
      saveSession(address, blockchainRole);

      // 7. Aggiornamento UI e redirect
      await refreshWallet();
      forceRefresh();
      navigate("/market");
    } catch (e) {
      console.error("Login Error:", e);
      if (e.code === 4001) {
        setErr("Connessione annullata dall'utente.");
      } else {
        setErr(e?.message || "Errore durante il login.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f2e9d0] flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-[#4A0404] text-[#f2e9d0] rounded-3xl shadow-2xl overflow-hidden relative border border-[#5e0a0a]">
        <div className="h-2 w-full bg-[#D4AF37]"></div>
        <div className="p-10 md:p-14 text-center">
          <div className="mx-auto h-16 w-16 bg-[#D4AF37] rounded-full flex items-center justify-center mb-6 shadow-lg text-[#4A0404]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
              />
            </svg>
          </div>

          <h1 className="text-5xl font-serif font-bold tracking-tight mb-2 text-white">Watchain</h1>
          <p className="text-[#f2e9d0]/60 text-xs tracking-[0.2em] uppercase font-bold mb-8">
            The Luxury Blockchain Market
          </p>

          <div className="w-12 h-px bg-[#D4AF37]/40 mx-auto mb-8"></div>

          <p className="text-[#f2e9d0]/80 mb-8 font-light leading-relaxed">
            Connect your wallet to access the exclusive marketplace.
            <br className="hidden sm:block" />
            Identity verification is handled automatically via JWT.
          </p>

          {err && (
            <div className="mb-6 rounded-xl border border-red-500/50 bg-red-900/30 p-4 text-red-200 text-sm animate-pulse">
              {err}
            </div>
          )}

          <button
            onClick={onLogin}
            disabled={loading}
            className="w-full py-4 px-6 rounded-xl bg-[#D4AF37] text-[#4A0404] font-bold text-lg tracking-wide hover:bg-[#c49f27] hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? (
              <span>Connecting...</span>
            ) : (
              <>
                <span>Connect MetaMask</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </>
            )}
          </button>

          <div className="mt-8 text-[10px] text-[#f2e9d0]/30 font-mono">
            Secure connection required. Please ensure MetaMask is unlocked.
          </div>
        </div>
      </div>
    </div>
  );
}
