import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
// 1. Importiamo le astrazioni da auth.js (Niente più localStorage diretto!)
import { getAddress, getRole } from "../lib/auth";
import { apiGet } from "../lib/api";
import { getBalance } from "../services/walletService";
import { getCredits } from "../services/marketService";

/**
 * Centralizza tutti i dati personali dell'utente connesso:
 * - Chi è (Address, Ruolo) -> Presi da auth.js
 * - Cosa possiede (Inventario) -> API /inventory
 * - Quanto ha (Saldo, Crediti) -> API /wallet, /market
 */
const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [role, setRole] = useState(null);
  
  const [balance, setBalance] = useState("0");           // Saldo LUX
  const [pendingBalance, setPendingBalance] = useState("0"); // Crediti da incassare (Wei)
  
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshWallet = useCallback(async () => {
    try {
      // 2. USIAMO I GETTERS SICURI
      const storedAddress = getAddress();
      const storedRole = getRole();

      if (storedAddress) {
        setAddress(storedAddress);
        setRole(storedRole);

        // --- A. SALDO & CREDITI (Parallelizziamo per velocità) ---
        // Eseguiamo le chiamate in parallelo invece che una dopo l'altra
        const [balRes, credRes, invRes] = await Promise.allSettled([
            getBalance(),
            getCredits(),
            apiGet("/inventory")
        ]);

        // Gestione Saldo
        if (balRes.status === "fulfilled" && balRes.value) {
            const rawBalance = String(balRes.value.lux ?? "0");
            setBalance(rawBalance.split('.')[0]);
        } else {
            // Se fallisce (es. backend offline), mettiamo 0 ma non rompiamo tutto
            console.warn("Impossibile recuperare saldo:", balRes.reason);
            setBalance("0");
        }

        // Gestione Crediti
        if (credRes.status === "fulfilled" && credRes.value) {
            setPendingBalance(String(credRes.value.creditsWei || "0"));
        } else {
            setPendingBalance("0");
        }

        // Gestione Inventario
        if (invRes.status === "fulfilled" && Array.isArray(invRes.value)) {
            setInventory(invRes.value);
        } else {
            setInventory([]);
        }

      } else {
        // Nessun utente loggato -> Reset totale
        setAddress(null);
        setRole(null);
        setBalance("0");
        setPendingBalance("0");
        setInventory([]);
      }
    } catch (error) {
      console.error("Critical Wallet Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Aggiorna al mount e quando cambia la funzione refresh
  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  return (
    <WalletContext.Provider
      value={{
        address,
        role,
        balance,         
        pendingBalance,  
        inventory,
        loading,
        refreshWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}