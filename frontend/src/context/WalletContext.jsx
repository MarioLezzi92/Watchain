import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAddress, getRole, logout } from "../lib/auth"; 
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

    if (!storedAddress || storedAddress === "undefined") {
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
      const [balRes, credRes, nextIdRes] = await Promise.allSettled([
        FF.luxuryCoin.query.balanceOf(roleUrl, { account: storedAddress }),
        FF.watchMarket.query.creditsOf(roleUrl, { payee: storedAddress }),
        FF.watchNft.query.nextId(roleUrl)
      ]);

      if (balRes.status === "fulfilled") {
        const lux = (safeBigInt(balRes.value.output) / 10n**18n).toString();
        setBalance(lux);
      } else {
        setBalance("0");
      }

      if (credRes.status === "fulfilled") {
        setPendingBalance(String(credRes.value.output || "0"));
      } else {
        setPendingBalance("0");
      }

      if (nextIdRes.status === "fulfilled") {
        const totalNFTs = Number(nextIdRes.value.output);
        let myWatches = [];
        const ownerPromises = [];
        for (let i = 1; i <= totalNFTs; i++) {
          ownerPromises.push(FF.watchNft.query.ownerOf(roleUrl, { tokenId: String(i) }));
        }

        const owners = await Promise.allSettled(ownerPromises);
        owners.forEach((res, index) => {
          if (res.status === "fulfilled") {
            const ownerAddr = String(res.value.output).toLowerCase();
            if (ownerAddr === storedAddress.toLowerCase()) {
              myWatches.push({ 
                tokenId: index + 1, 
                owner: ownerAddr 
              });
            }
          }
        });
        setInventory(myWatches);
      } else {
        setInventory([]);
      }

    } catch (error) {
      console.error("Critical Wallet Sync Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- 2. SECURITY: AUTO-LOGOUT SU CAMBIO ACCOUNT (NUOVO) ---
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        const currentSessionAddr = getAddress();
        
        // Se non ci sono account o l'account attivo è diverso da quello in sessione
        if (accounts.length === 0 || (currentSessionAddr && accounts[0].toLowerCase() !== currentSessionAddr.toLowerCase())) {
          console.warn("⚠️ Cambio account rilevato. Logout forzato.");
          logout(); // Pulisce localStorage
          window.location.href = "/login"; // Ti rispedisce al login
        }
      };

      const handleChainChanged = () => {
        window.location.reload(); 
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, []);

  // Sync iniziale
  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  return (
    <WalletContext.Provider value={{
      address,
      role,
      balance,
      pendingBalance,
      inventory,
      loading,
      refreshWallet 
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);