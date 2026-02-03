import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAddress, getRole, logout, AUTH_EVENT } from "../lib/auth";
import { FF, FF_BASE } from "../lib/api";

const WalletContext = createContext();

// Helper per gestire conversioni sicure BigInt
const safeBigInt = (val) => {
  try { return val != null ? BigInt(val) : 0n; } catch { return 0n; }
};

export function WalletProvider({ children }) {
  // Stato Identità
  const [address, setAddress] = useState(null);
  const [role, setRole] = useState(null);

  // Stato Permessi Granulari (Role Flags)
  const [isReseller, setIsReseller] = useState(false);
  const [isActiveReseller, setIsActiveReseller] = useState(false);

  // Stato Economico
  const [balance, setBalance] = useState("0");
  const [pendingBalance, setPendingBalance] = useState("0"); // Crediti escrow da ritirare
  const [inventory, setInventory] = useState([]); // (Legacy, ora gestito in MePage)
  const [loading, setLoading] = useState(true);

  /**
   * SINCRONIZZAZIONE WALLET (Hydration)
   * Recupera lo stato attuale dell'utente dalla Blockchain.
   * Viene chiamato al caricamento e ad ogni segnale di refresh.
   */
  const refreshWallet = useCallback(async () => {
    const storedAddress = getAddress();
    const storedRole = getRole();

    // Check Sessione Locale
    if (!storedAddress || storedAddress === "undefined" || !storedRole) {
      setAddress(null);
      setRole(null);
      setIsReseller(false);
      setIsActiveReseller(false);
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
      // 1. DATI ECONOMICI (Balance & Credits)
      // Usiamo Promise.allSettled per resilienza: se un nodo fallisce, l'altro dato arriva comunque.
      const [balRes, credRes] = await Promise.allSettled([
        FF.luxuryCoin.query.balanceOf(roleUrl, { account: storedAddress }),
        FF.watchMarket.query.creditsOf(roleUrl, { payee: storedAddress }),
      ]);

      if (balRes.status === "fulfilled") {
        // Conversione Wei -> Lux per UI
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

      // 2. VERIFICA RUOLI ON-CHAIN (Producer Node = Source of Truth)
      const readNode = FF_BASE.producer;

      const [factoryRes, resellerRes, activeResellerRes] = await Promise.allSettled([
        FF.watchNft.query.factory(readNode),
        FF.watchNft.query.reseller(readNode, { "": storedAddress }),
        FF.watchNft.query.activeReseller(readNode, { "": storedAddress }),
      ]);

      const factoryAddr = factoryRes.status === "fulfilled"
          ? String(factoryRes.value.output || factoryRes.value || "").toLowerCase()
          : "";

      const myAddr = String(storedAddress).toLowerCase();
      const amIProducer = !!factoryAddr && myAddr === factoryAddr;

      const permReseller = resellerRes.status === "fulfilled"
          ? resellerRes.value.output === true || String(resellerRes.value.output) === "true"
          : false;

      const activeReseller = activeResellerRes.status === "fulfilled"
          ? activeResellerRes.value.output === true || String(activeResellerRes.value.output) === "true"
          : false;

      // Aggiornamento Flag
      setIsReseller(!amIProducer && permReseller);
      setIsActiveReseller(!amIProducer && activeReseller);

    } catch (error) {
      console.error("Critical Wallet Sync Error:", error);
      // Fallback sicuro in caso di errore rete
      setIsReseller(false);
      setIsActiveReseller(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial Mount Sync
  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  // Listener cambio sessione (Login/Logout da altri tab o componenti)
  useEffect(() => {
    const onAuthChange = async () => {
      setLoading(true);
      await refreshWallet();
      
      // Controllo consistenza: se storage vuoto ma siamo su pagina protetta -> redirect login
      const noSession = !getAddress() || !getRole();
      if (noSession && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    };

    window.addEventListener(AUTH_EVENT, onAuthChange);
    return () => window.removeEventListener(AUTH_EVENT, onAuthChange);
  }, [refreshWallet]);

  /**
   * SECURITY: ACCOUNT CHANGE DETECTION
   * Se l'utente cambia account su MetaMask mentre è loggato con un altro address,
   * eseguiamo un logout forzato per prevenire inconsistenze o firme non valide.
   */
  useEffect(() => {
    if (!window.ethereum) return;

    // A. Controllo preventivo all'avvio
    window.ethereum.request({ method: "eth_accounts" })
      .then((accounts) => {
        const storedAddr = getAddress();
        if (storedAddr && (accounts.length === 0 || accounts[0].toLowerCase() !== storedAddr.toLowerCase())) {
          console.warn("[Security] Session mismatch detected on load. Logging out.");
          logout();
          setAddress(null);
          if (window.location.pathname !== "/login") window.location.href = "/login";
        }
      })
      .catch(console.error);

    // B. Listener Eventi MetaMask
    const handleAccountsChanged = (accounts) => {
      const currentSessionAddr = getAddress();
      if (accounts.length === 0 || (currentSessionAddr && accounts[0].toLowerCase() !== currentSessionAddr.toLowerCase())) {
        console.warn("[Security] Wallet changed. Forcing logout.");
        logout();
        window.location.href = "/login";
      }
    };

    const handleChainChanged = () => window.location.reload(); // Best practice EVM: reload on chain change

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
        isReseller,
        isActiveReseller,
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