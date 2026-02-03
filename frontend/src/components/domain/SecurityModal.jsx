import React, { useState, useEffect } from "react";
import { XCircleIcon } from "@heroicons/react/24/outline";

/**
 * Modale di Sicurezza (Admin Panel).
 * Permette al Producer di attivare il "Circuit Breaker" (Pausable) 
 * su Market e Factory in caso di emergenza.
 */
export default function SecurityModal({ isOpen, onClose, marketPaused, factoryPaused, onToggleMarket, onToggleFactory, busy }) {
  const [target, setTarget] = useState(null); 

  useEffect(() => {
    if (!busy) setTarget(null);
  }, [busy]);

  if (!isOpen) return null;

  const handleToggleMarket = () => {
    setTarget('market');
    onToggleMarket();
  };

  const handleToggleFactory = () => {
    setTarget('factory');
    onToggleFactory();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#2a0e0e] text-[#FDFBF7] rounded-3xl p-6 shadow-2xl w-full max-w-2xl border border-[#5e0a0a] ring-1 ring-white/5 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-900/30 rounded-lg text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <div className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest">Admin Override</div>
              <div className="text-2xl font-serif font-bold">Protocolli di Sicurezza</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition">
            <XCircleIcon className="h-8 w-8" />
          </button>
        </div>

        {/* Controlli Pausable */}
        <div className="grid md:grid-cols-2 gap-6">
          <SecurityCard 
            title="Produzione & Certificazioni"
            description="Controlla Minting e Certificazioni."
            isPaused={factoryPaused}
            loading={busy && target === 'factory'}
            disabled={busy}
            onToggle={handleToggleFactory}
          />
          <SecurityCard 
            title="Marketplace"
            description="Controlla Vendite e Acquisti"
            isPaused={marketPaused}
            loading={busy && target === 'market'}
            disabled={busy}
            onToggle={handleToggleMarket}
          />
        </div>
      </div>
    </div>
  );
}

// Sub-componente Card
function SecurityCard({ title, description, isPaused, loading, disabled, onToggle }) {
  const statusColor = isPaused ? "text-red-500" : "text-green-500";
  const statusText = isPaused ? "SISTEMA BLOCCATO" : "OPERATIVO";
  const bgStatus = isPaused ? "bg-red-500/10 border-red-500/20" : "bg-green-500/10 border-green-500/20";

  return (
    <div className={`p-4 rounded-2xl border ${bgStatus} flex flex-col justify-between gap-4 transition-all bg-black/20`}>
      <div>
        <h4 className="font-bold text-lg text-[#FDFBF7]">{title}</h4>
        <p className="text-xs text-white/50 mb-2">{description}</p>
        <div className={`text-xs font-bold tracking-wider flex items-center gap-2 ${statusColor}`}>
          <span className={`w-2 h-2 rounded-full ${isPaused ? "bg-red-500 animate-pulse" : "bg-green-500"}`}></span>
          {statusText}
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled} 
        className={`relative w-full py-3 rounded-xl font-bold text-sm shadow-inner border border-white/5 transition-colors ${
          !isPaused 
            ? "bg-[#1A472A] text-green-100 hover:bg-[#143620]" 
            : "bg-red-900 text-red-100 hover:bg-red-800"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? "Elaborazione..." : (isPaused ? "RIATTIVA SISTEMA" : "BLOCCA SISTEMA")}
      </button>
    </div>
  );
}