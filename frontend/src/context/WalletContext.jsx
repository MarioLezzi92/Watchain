import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAddress, getRole, logout, AUTH_EVENT } from "../lib/auth";
import { FF, FF_BASE } from "../lib/api";

const WalletContext = createContext();

// Helper per gestire i BigInt
const safeBigInt = (val) => {
  try {
    return val != null ? BigInt(val) : 0n;
  } catch {
    return 0n;
  }
};

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [role, setRole] = useState(null);
  const [balance, setBalance] = useState("0");
  const [pendingBalance, setPendingBalance] = useState("0");
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- 1. SYNC DATI ---
  const refreshWallet = useCallback(async () => {
    const storedAddress = getAddress();
    const storedRole = getRole();

    if (!storedAddress || storedAddress === "undefined" || !storedRole) {
      setAddress(null);
      setRole(null);
      setBalance("0");
      setPendingBalance("0");
      setInventory([]);
      setLoading(false);
      return;
    }

    setAddress(storedAddress);
    setRole(storedRole);

    const roleUrl = FF_BASE[storedRole] || FF_BASE.consumer;

    try {
      const [balRes, credRes] = await Promise.allSettled([
        FF.luxuryCoin.query.balanceOf(roleUrl, { account: storedAddress }),
        FF.watchMarket.query.creditsOf(roleUrl, { payee: storedAddress }),
      ]);

      if (balRes.status === "fulfilled") {
        const lux = (safeBigInt(balRes.value.output) / 10n ** 18n).toString();
        setBalance(lux);
      } else {
        setBalance("0");
      }

      if (credRes.status === "fulfilled") {
        setPendingBalance(String(credRes.value.output || "0"));
      } else {
        setPendingBalance("0");
      }

      // WalletContext non deve più calcolare inventory (lo fa MePage)
      setInventory([]);
    } catch (error) {
      console.error("Critical Wallet Sync Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync iniziale
  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  // Sync wallet quando cambia la sessione (login/logout/401)
  useEffect(() => {
    const onAuthChange = async () => {
      setLoading(true);
      await refreshWallet();

      const storedAddr = getAddress();
      const storedRole = getRole();
      const noSession = !storedAddr || storedAddr === "undefined" || !storedRole;

      if (noSession && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    };

    window.addEventListener(AUTH_EVENT, onAuthChange);
    return () => window.removeEventListener(AUTH_EVENT, onAuthChange);
  }, [refreshWallet]);

  // --- 2. SECURITY: AUTO-LOGOUT SU CAMBIO ACCOUNT ---
  useEffect(() => {
    if (!window.ethereum) return;

    // A. CONTROLLO ALL'AVVIO
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const storedAddr = getAddress();

        if (
          storedAddr &&
          (accounts.length === 0 || accounts[0].toLowerCase() !== storedAddr.toLowerCase())
        ) {
          console.warn("Sessione non valida rilevata all'avvio. Logout automatico.");
          logout();
          setAddress(null);
          setRole(null);

          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
      })
      .catch(console.error);

    // B. ASCOLTO CAMBIAMENTI
    const handleAccountsChanged = (accounts) => {
      const currentSessionAddr = getAddress();
      if (
        accounts.length === 0 ||
        (currentSessionAddr && accounts[0].toLowerCase() !== currentSessionAddr.toLowerCase())
      ) {
        console.warn("Cambio account rilevato. Logout forzato.");
        logout();
        window.location.href = "/login";
      }
    };

    const handleChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

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

export const useWallet = () => useContext(WalletContext);
