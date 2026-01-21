import React, { useState, useEffect } from "react";
import { 
  XCircleIcon, 
  UserIcon, 
  ShieldCheckIcon, 
  ShieldExclamationIcon,
  QuestionMarkCircleIcon 
} from "@heroicons/react/24/outline";
import { AuthAPI, FF, FF_BASE } from "../../lib/api"; 
import { formatError } from "../../lib/formatters"; 

const formatShortAddress = (addr) => {
  if (!addr) return "...";
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
};

export default function ResellerModal({ isOpen, onClose }) {
  const targetReseller = import.meta.env.VITE_RESELLER_ADDR;

  const [currentStatus, setCurrentStatus] = useState(null); 
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchStatus = async () => {
    if (!targetReseller) return;
    try {
      const res = await AuthAPI.checkReseller(targetReseller);
      setCurrentStatus(res.isAuthorized);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMsg("");
      setCurrentStatus(null); 
      fetchStatus();
    }
  }, [isOpen, targetReseller]);

  useEffect(() => {
    if (!isOpen || !targetReseller) return;
    const intervalId = setInterval(() => {
      AuthAPI.checkReseller(targetReseller)
        .then(res => setCurrentStatus(res.isAuthorized))
        .catch(console.error);
    }, 3000);
    return () => clearInterval(intervalId);
  }, [isOpen, targetReseller]);

  const handleToggleStatus = async () => {
    if (!targetReseller || currentStatus === null) return;
    
    setBusy(true);
    setMsg(" Attendere...");

    try {
      const roleUrl = FF_BASE.producer;
      const newState = !currentStatus; 

      await FF.watchNft.invoke.setReseller(roleUrl, {
        who: targetReseller,
        enabled: newState
      });

      setMsg(`Operazione riuscita!`);
      setCurrentStatus(newState); 
      
    } catch (err) {
      // 2. FIX: Usiamo il formatError con context FACTORY (Gestione Reseller è parte della Factory logic)
      setMsg(`❌ ${formatError(err, "FACTORY")}`);
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const isLoading = currentStatus === null;     
  const isAuthorized = currentStatus === true;  

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#2a0e0e] text-[#FDFBF7] rounded-3xl p-6 shadow-2xl w-full max-w-md border border-[#5e0a0a] relative animate-in zoom-in duration-200">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white transition">
          <XCircleIcon className="h-8 w-8" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="p-4 bg-[#D4AF37]/10 rounded-full mb-4">
            <UserIcon className="h-10 w-10 text-[#D4AF37]" />
          </div>
          <h2 className="text-2xl font-serif font-bold mb-2">Gestione Reseller</h2>
          
          <div className="flex flex-col items-center justify-center w-full mb-8">
            {targetReseller ? (
                <div className="bg-black/40 border border-[#D4AF37]/30 px-6 py-3 rounded-full font-mono text-lg text-[#D4AF37] tracking-widest shadow-inner flex items-center gap-2">
                    {formatShortAddress(targetReseller)}
                </div>
            ) : (
                <div className="text-red-500 font-bold border border-red-500 p-2 rounded">
                    ERRORE: .env mancante
                </div>
            )}
             <div className="text-[10px] text-white/30 mt-2 uppercase tracking-widest">
                Indirizzo Ufficiale
            </div>
          </div>

          <div className="w-full space-y-6">
            
            {targetReseller && (
              <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                isLoading 
                  ? "bg-gray-500/10 border-gray-500/20 opacity-70"
                  : isAuthorized 
                    ? "bg-green-500/10 border-green-500/20" 
                    : "bg-red-500/10 border-red-500/20"
              }`}>
                <div className="flex items-center gap-3">
                  
                  {isLoading ? (
                    <QuestionMarkCircleIcon className="h-6 w-6 text-gray-400 animate-pulse" />
                  ) : isAuthorized ? (
                    <ShieldCheckIcon className="h-6 w-6 text-green-500" />
                  ) : (
                    <ShieldExclamationIcon className="h-6 w-6 text-red-500" />
                  )}

                  <div className="text-left">
                    <div className="text-xs font-bold uppercase tracking-tighter opacity-50">Stato Reseller</div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      {isLoading 
                        ? "VERIFICA IN CORSO..." 
                        : (isAuthorized ? "AUTORIZZATO" : "NON AUTORIZZATO")
                      }
                      
                      {!isLoading && isAuthorized && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {targetReseller && (
              <button
                onClick={handleToggleStatus}
                disabled={busy || isLoading} 
                className={`w-full py-4 font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-95 uppercase text-xs tracking-widest ${
                  isLoading 
                    ? "bg-gray-800 text-gray-500 cursor-wait"
                    : isAuthorized 
                      ? "bg-red-900 hover:bg-red-800 text-red-100 border border-red-500/30" 
                      : "bg-[#D4AF37] hover:bg-[#c49f27] text-[#4A0404]"
                } disabled:opacity-50`}
              >
                {busy 
                  ? "Elaborazione..." 
                  : isLoading 
                    ? "Attendere..." 
                    : (isAuthorized ? "REVOCA AUTORIZZAZIONE" : "AUTORIZZA")
                }
              </button>
            )}
          </div>

          {msg && (
            <div className={`mt-6 p-3 rounded-lg text-sm font-bold w-full border ${
              "bg-red-900/30 text-red-200 border-red-500/30"
            }`}>
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}