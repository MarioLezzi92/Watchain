import React, { createContext, useContext, useState, useEffect } from "react";
import { io } from "socket.io-client";
import { apiGet } from "../lib/api";

// Creiamo il contesto
const SystemContext = createContext();

export function SystemProvider({ children }) {
  // --- STATO GLOBALE ---
  const [socket, setSocket] = useState(null);
  const [marketPaused, setMarketPaused] = useState(false);
  const [factoryPaused, setFactoryPaused] = useState(false);
  
  // Questo contatore serve a notificare le pagine che c'è stato un aggiornamento
  // (es. un oggetto è stato venduto), così loro possono ricaricare le liste.
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
    // Carichiamo lo stato appena si apre il sito
    checkStatus();

    // Connettiamo il Socket una volta sola
    // Nota: Adegua l'URL se il tuo backend non è su localhost:3001
    const s = io("http://localhost:3001"); 
    setSocket(s);

    s.on("connect", () => {
      console.log("🟢 Socket Global Connected:", s.id);
    });

    // Ascoltiamo QUALSIASI aggiornamento dal mercato
    s.on("market-update", (data) => {
      console.log("⚡ Global Update Received:", data);
      
      // 1. Incrementiamo il trigger -> Le pagine (Market/Me) ricaricheranno i dati
      setRefreshTrigger(prev => prev + 1);

      // 2. Se l'evento suggerisce un cambio di stato (es. "SystemPaused"), ricarichiamo lo stato
      // (Aggiungi questo controllo se il tuo backend emette eventi specifici per la pausa)
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

// Hook per usare il contesto facilmente
export const useSystem = () => useContext(SystemContext);