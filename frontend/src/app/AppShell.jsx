import React from "react"; 
import { useNavigate, useLocation } from "react-router-dom";
import { 
  UserCircleIcon, 
  ArrowRightOnRectangleIcon, 
  ArrowLeftOnRectangleIcon,  
  ShoppingBagIcon, 
  WalletIcon 
} from "@heroicons/react/24/outline";

import { logout } from "../lib/auth";
import { AuthAPI } from "../lib/api"; 
import { useSystem } from "../context/SystemContext"; 
import { useWallet } from "../context/WalletContext"; 
import { shortAddr } from "../lib/formatters";        

/**
 * Componente Alert di Sistema (Circuit Breaker UI).
 * Visualizza un banner rosso persistente se i contratti sono in pausa (Emergency Stop).
 * Questo feedback visivo è cruciale per informare l'utente che le operazioni potrebbero fallire.
 */
function SystemAlert({ marketPaused, factoryPaused }) {
  if (!marketPaused && !factoryPaused) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-3 shadow-xl flex items-center justify-center gap-3 animate-in slide-in-from-top duration-300 sticky top-20 z-30">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 animate-pulse">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <span className="font-bold tracking-wide uppercase text-sm animate-pulse">
        ATTENZIONE: 
        {marketPaused && factoryPaused ? " MANUTENZIONE TOTALE IN CORSO. SISTEMA BLOCCATO." : 
         marketPaused ? " IL MERCATO È TEMPORANEAMENTE SOSPESO." : 
         " PRODUZIONE E CERTIFICAZIONI SOSPESE."}
      </span>
    </div>
  );
}

export default function AppShell({ title = "Watchain", children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Stato Globale
  const { marketPaused, factoryPaused } = useSystem();
  const { address, balance } = useWallet();
  
  // Logout Sicuro: Invalida sessione server (cookie) e pulisce storage locale
  const handleLogout = async () => {
    try {
      await AuthAPI.logout(); 
    } catch (e) {
      console.warn("Logout lato server fallito, procedo comunque con cleanup locale.");
    } finally {
      logout();
      navigate("/login");
    }
  };
  
  const isMarket = location.pathname === "/market";

  return (
    <div className="min-h-screen w-full bg-[#f2e9d0] text-zinc-900 font-sans flex flex-col">
      
      {/* HEADER STICKY */}
      <header className="sticky top-0 z-40 w-full shadow-lg bg-[#4A0404] text-[#f2e9d0] border-b border-[#D4AF37]/30">
        <div className="w-full max-w-[95%] mx-auto px-6 h-20 flex items-center justify-between relative">
          
          {/* Left: Navigation Buttons */}
          <div className="flex-1 flex justify-start">
            {!isMarket && (
              <button
                onClick={() => navigate("/market")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 border bg-white/5 text-[#f2e9d0] border-white/10 hover:bg-[#D4AF37] hover:text-[#4A0404]"
                title="Vai al Mercato"
              >
                <ShoppingBagIcon className="h-5 w-5" />
                <span className="hidden md:inline text-sm uppercase tracking-wide">Market</span>
              </button>
            )}
          </div>

          {/* Center: Brand Logo */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
            <button 
              onClick={() => navigate("/market")}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <img src="/logo.svg" alt="Logo" className="h-10 w-auto object-contain drop-shadow-md" />
              <span className="font-serif font-extrabold text-2xl tracking-widest text-[#f2e9d0] hidden sm:block">
                {title}
              </span>
            </button>
          </div>

          {/* Right: User Info & Actions */}
          <div className="flex-1 flex justify-end items-center gap-3 md:gap-5">
              {address ? (
                <>
                  {/* Info Wallet (Saldo & Address) */}
                  <div className="hidden md:flex flex-col items-end text-xs leading-tight opacity-90">
                     <div className="flex items-center gap-1.5 text-[#D4AF37] font-bold">
                       <WalletIcon className="h-3.5 w-3.5"/>
                       <span>{balance || "0"} LUX</span>
                     </div>
                     <div className="flex items-center gap-1 font-mono text-[#f2e9d0]/70 mt-0.5">
                       <span className="bg-black/20 px-1 rounded">{shortAddr(address)}</span>
                     </div>
                  </div>

                  <div className="hidden md:block h-8 w-px bg-white/20"></div>

                  {/* Tasto Profilo */}
                  <button
                   onClick={() => navigate("/me")}
                   className={`p-2.5 rounded-full transition-all duration-300 border shadow-inner ${
                     location.pathname === "/me"
                       ? "bg-[#D4AF37] text-[#4A0404] border-[#D4AF37]"
                       : "bg-white/10 text-[#f2e9d0] border-white/10 hover:bg-[#D4AF37] hover:text-[#4A0404]"
                   }`}
                   title="Area Personale"
                 >
                   <UserCircleIcon className="h-6 w-6" />
                 </button>

                  {/* Tasto Logout */}
                  <button
                    onClick={handleLogout}
                    className="p-2.5 rounded-full bg-red-900/30 text-red-200 hover:bg-red-600 hover:text-white transition-all duration-300 border border-transparent hover:border-white/20 shadow-inner"
                    title="Disconnetti"
                  >
                    <ArrowRightOnRectangleIcon className="h-6 w-6" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate("/login")}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#D4AF37] hover:bg-[#c49f27] text-[#4A0404] font-bold rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300"
                >
                  <span>Login</span>
                  <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                </button>
              )}
          </div>
        </div>
      </header>

      {/* Banner Emergenza (Visibile solo se attivo) */}
      <SystemAlert marketPaused={marketPaused} factoryPaused={factoryPaused} />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    
      {/* Footer */}
      <footer className="bg-[#4A0404] text-[#f2e9d0] border-t border-[#D4AF37]/30 mt-auto">
        <div className="w-full max-w-[95%] mx-auto px-6 sm:px-8 lg:px-12 py-12">
          {/* ... footer content ... */}
          <div className="pt-8 border-t border-[#D4AF37]/20 flex flex-col md:flex-row justify-between items-center text-xs text-[#f2e9d0]/40">
            <p>&copy; {new Date().getFullYear()} {title}.</p>
            <p className="mt-2 md:mt-0 font-mono text-[#D4AF37]/60">Powered by Ethereum Blockchain & Hyperledger FireFly</p>
          </div>
        </div>
      </footer>
    </div>
  );
}