import React, { createContext, useContext, useState, useEffect, use } from "react";
import { io } from "socket.io-client"; 
import { FF_BASE, FF } from "../lib/api.js";



// Crea il contesto
const SystemContext = createContext();

export function SystemProvider({ children }) {
  // --- STATO GLOBALE ---
  const [marketPaused, setMarketPaused] = useState(false);
  const [factoryPaused, setFactoryPaused] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [socket, setSocket] = useState(null);
  

  // --- 1. CONTROLLO INIZIALE STATO ---
  const checkStatus = async () => {
    try {
      const baseUrl = FF_BASE.producer;
      const [m, f] = await Promise.all([
        FF.watchMarket.query.paused(baseUrl), 
        FF.watchNft.query.paused(baseUrl)
      ]);
      
      const isMarketPaused = (m?.output === true || m?.output === "true");
      const isFactoryPaused = (f?.output === true || f?.output === "true");

      setMarketPaused(isMarketPaused);
      setFactoryPaused(isFactoryPaused);
      
    } catch (error) {
      console.warn("System status check failed:", error);
    }
  };

  // --- 2. GESTIONE SOCKET (UNICA) ---
  useEffect(() => {
    const socketInstance = io("http://localhost:3001", { 
      withCredentials: true 
    });

    setSocket(socketInstance); // Salviamo l'istanza nel state

    socketInstance.on("connect", () => {
      console.log("Socket.io connesso ✅");
    });

    socketInstance.on("refresh", () => {
      setRefreshTrigger(prev => prev + 1);
    });

    // 2. Cleanup alla disconnessione del componente  
    return () => {
      if (socketInstance) {
        socketInstance.disconnect(); 
      }
    };
  }, []);

  useEffect(() => {
    checkStatus();
  }, [refreshTrigger]);  

  // Funzione esposta per forzare un aggiornamento manuale (es. dopo che l'admin clicca un bottone)
  const forceRefresh = () => {
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