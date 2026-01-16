import React, { createContext, useContext, useState, useEffect } from "react";
import { io } from "socket.io-client";
// 1. IMPORTIAMO SERVER_URL DA API.JS (Single Source of Truth)
import { apiGet, SERVER_URL } from "../lib/api"; 

/**
 * * Gestisce :
 * 1. STATO GLOBALE: Se il mercato o la fabbrica sono in "Pausa Emergenza".
 * 2. REAL-TIME: La connessione Socket.io che ascolta la Blockchain.
 */

// Crea il contesto
const SystemContext = createContext();

export function SystemProvider({ children }) {
  // --- STATO GLOBALE ---
  const [socket, setSocket] = useState(null);
  const [marketPaused, setMarketPaused] = useState(false);
  const [factoryPaused, setFactoryPaused] = useState(false);
  
  // Questo contatore serve a notificare le pagine che c'è stato un aggiornamento
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // --- 1. CONTROLLO INIZIALE STATO (API) ---
  const checkStatus = async () => {
    try {
      const [m, f] = await Promise.all([
        apiGet("/market/status").catch(() => ({ paused: false })),
        apiGet("/factory/status").catch(() => ({ paused: false }))
      ]);
      setMarketPaused(!!m?.paused);
      setFactoryPaused(!!f?.paused);
    } catch (e) {
      console.warn("System status check failed", e);
    }
  };

  // --- 2. GESTIONE SOCKET (UNICA) ---
  useEffect(() => {
    // Carica lo stato appena si apre il sito
    checkStatus();

    const s = io(SERVER_URL); 
    setSocket(s);

    s.on("connect", () => {
      console.log("🟢 Socket Global Connected:", s.id);
    });

    // Ascolta QUALSIASI aggiornamento dal mercato
    s.on("market-update", (data) => {
      console.log("⚡ Global Update Received:", data);
      
      // 1. Incrementa il trigger -> Le pagine (Market/Me) ricaricheranno i dati
      setRefreshTrigger(prev => prev + 1);

      // 2. Se l'evento suggerisce un cambio di stato (es. "SystemPaused"), ricarica lo stato
      if (data.eventType === "EmergencyStateChanged") {
        checkStatus();
      }
    });

    // Cleanup quando si chiude il sito
    return () => {
      s.disconnect();
    };
  }, []);

  // Funzione esposta per forzare un aggiornamento manuale (es. dopo che l'admin clicca un bottone)
  const forceRefresh = () => {
    checkStatus();
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <SystemContext.Provider value={{
      socket,
      marketPaused,
      factoryPaused,
      refreshTrigger, // Le pagine useranno questo nelle dipendenze del useEffect
      forceRefresh    // Da chiamare dopo azioni amministrative
    }}>
      {children}
    </SystemContext.Provider>
  );
}

export const useSystem = () => useContext(SystemContext);