// src/pages/login.jsx
import React, { useState } from "react";
import { apiGet, apiPost } from "../lib/api";

/**
 * Funzione per connettere MetaMask e recuperare l'indirizzo pubblico[cite: 152, 158].
 */
async function connectMetamask() {
  if (!window.ethereum) throw new Error("MetaMask non trovato (installa l’estensione).");

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) throw new Error("Nessun account MetaMask disponibile.");

  const address = accounts[0];
  return { address };
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onLogin = async () => {
    setErr("");
    setLoading(true);
    try {
      // 1) Connessione al Wallet [cite: 11, 32]
      const { address } = await connectMetamask();

      // 2) Recupero del Nonce dal server per prevenire Replay Attack [cite: 83, 84, 136]
      const resNonce = await apiGet(`/auth/nonce?address=${address}`);
      const nonce = resNonce?.nonce; 

      if (!nonce) throw new Error("Nonce non ricevuto dal backend.");

      // 3) Firma del messaggio (Standard personal_sign richiesto dal lab) [cite: 44, 152, 163]
      const message = `Login to WatchDApp\nNonce: ${nonce}`;
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });

      // 4) Invio firma al server per ricevere il JWT [cite: 46, 224, 345, 346]
      const resLogin = await apiPost("/auth/login", { address, signature });
      
      const token = resLogin?.token;
      const role = resLogin?.role;

      if (!token || !role) throw new Error("Login fallito: credenziali non valide.");

      // 5) Salvataggio sessione nel browser 
      localStorage.setItem("token", token);
      localStorage.setItem("role", role);
      localStorage.setItem("address", address);

      // 6) Redirect alla Dashboard/Marketplace
      window.location.href = "/market"; 

    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    // SFONDO GENERALE: Beige crema #f2e9d0
    <div className="min-h-screen w-full bg-[#f2e9d0] flex items-center justify-center p-6">
      
      {/* CARD LOGIN: Bordeaux #4A0404 con ombra profonda */}
      <div className="w-full max-w-lg bg-[#4A0404] text-[#f2e9d0] rounded-3xl shadow-2xl overflow-hidden relative border border-[#5e0a0a]">
        
        {/* Decorazione: Linea dorata in alto */}
        <div className="h-2 w-full bg-[#D4AF37]"></div>

        <div className="p-10 md:p-14 text-center">
          
          {/* Logo / Icona decorativa */}
          <div className="mx-auto h-16 w-16 bg-[#D4AF37] rounded-full flex items-center justify-center mb-6 shadow-lg text-[#4A0404]">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
               <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
             </svg>
          </div>

          <h1 className="text-5xl font-serif font-bold tracking-tight mb-2 text-white">WatchDApp</h1>
          <p className="text-[#f2e9d0]/60 text-xs tracking-[0.2em] uppercase font-bold mb-8">
            The Luxury Blockchain Market
          </p>

          <div className="w-12 h-px bg-[#D4AF37]/40 mx-auto mb-8"></div>

          <p className="text-[#f2e9d0]/80 mb-8 font-light leading-relaxed">
            Connect your wallet to access the exclusive marketplace. 
            <br className="hidden sm:block"/>
            Identity verification is handled automatically via JWT.
          </p>

          {err ? (
            <div className="mb-6 rounded-xl border border-red-500/50 bg-red-900/30 p-4 text-red-200 text-sm animate-pulse">
              {err}
            </div>
          ) : null}

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
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </>
            )}
          </button>

          <div className="mt-8 text-[10px] text-[#f2e9d0]/30 font-mono">
            Secure connection required. Please ensure MetaMask is unlocked. [cite: 127, 134]
          </div>
        </div>
      </div>
    </div>
  );
}