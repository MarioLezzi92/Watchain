import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
// IMPORTIAMO I SERVIZI ORIGINALI CHE FUNZIONAVANO
import { getBalance } from "../services/walletService";
import { getCredits } from "../services/marketService";
import { apiGet } from "../lib/api";

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [role, setRole] = useState(null);
  
  const [balance, setBalance] = useState("0");          // Saldo LUX
  const [pendingBalance, setPendingBalance] = useState("0"); // Crediti da incassare (Wei)
  
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshWallet = useCallback(async () => {
    try {
      const storedAddress = localStorage.getItem("address");
      const storedRole = localStorage.getItem("role");

      if (storedAddress) {
        setAddress(storedAddress);
        setRole(storedRole);

        // 1. RECUPERO SALDO (Logica originale)
        // Usa la funzione getBalance del service che restituisce { lux: ... }
        try {
            const b = await getBalance();
            // Il tuo vecchio codice faceva: String(b?.lux ?? "-")
            setBalance(String(b?.lux ?? "0"));
        } catch (e) {
            console.warn("Errore Saldo:", e);
            setBalance("0");
        }

        // 2. RECUPERO CREDITI (Logica originale)
        // Usa getCredits del marketService che restituisce { creditsWei: ... }
        try {
            const c = await getCredits();
            // Il tuo vecchio codice usava: c?.creditsWei
            setPendingBalance(String(c?.creditsWei || "0"));
        } catch (e) {
            console.warn("Errore Crediti:", e);
            setPendingBalance("0");
        }

        // 3. INVENTARIO
        const invData = await apiGet("/inventory").catch(() => []);
        setInventory(Array.isArray(invData) ? invData : []);

      } else {
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