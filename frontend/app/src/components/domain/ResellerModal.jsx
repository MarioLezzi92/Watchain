import React, { useState, useEffect } from "react";
import { XCircleIcon, UserIcon, ShieldCheckIcon, ShieldExclamationIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { setReseller, getResellerStatus, getBackendConfig } from "../../services/marketService"; 
import { shortAddr } from "../../lib/formatters"; 
// REINTEGRATO: Import del modale di conferma
import ConfirmModal from "../ui/ConfirmModal"; 

export default function ResellerModal({ isOpen, onClose, onDone }) {
  const [resellersOptions, setResellersOptions] = useState([]);
  const [who, setWho] = useState("");
  
  const [currentStatus, setCurrentStatus] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null });

  // 1. CARICAMENTO CONFIG DAL BACKEND (Via Auth)
  useEffect(() => {
    if(!isOpen) return;
    
    setResellersOptions([]);
    setWho("");
    setCurrentStatus(null);
    setMsg("");

    const init = async () => {
      try {
        const conf = await getBackendConfig();
        const addr = conf?.resellerAddress;

        if (addr) {
            setResellersOptions([{ name: "Reseller Attivo", address: addr }]);
            setWho(addr);
        }
      } catch (e) {
        console.error("Errore caricamento config:", e);
      }
    };

    init();
  }, [isOpen]);

  // 2. Controllo Stato Automatico
  useEffect(() => {
    if (!who) {
      setCurrentStatus(null);
      return;
    }

    const check = async () => {
      setChecking(true);
      setCurrentStatus(null);
      try {
        const res = await getResellerStatus(who);
        if (res && typeof res.isReseller === 'boolean') {
            setCurrentStatus(res.isReseller);
        } else {
            setCurrentStatus("unknown");
        }
      } catch (e) {
        setCurrentStatus("unknown");
      } finally {
        setChecking(false);
      }
    };

    check();
  }, [who]);

  const handleAction = (e, forcedState = null) => {
    e.preventDefault();
    if (!who) return;

    const newState = forcedState !== null ? forcedState : !currentStatus;
    const actionText = newState ? "abilitare" : "disabilitare";

    setConfirmModal({
      isOpen: true,
      title: "Gestione Reseller",
      message: `Confermi di voler ${actionText} il Reseller ${shortAddr(who)}?`,
      onConfirm: async () => {
        setMsg("");
        try {
          setBusy(true);
          await setReseller(who, newState);
          
          setMsg(newState 
            ? "Reseller abilitato con successo." 
            : "Reseller disabilitato con successo."
          );
          
          setCurrentStatus(newState);
          if (onDone) onDone();
        } catch (err) {
          setMsg(`❌ ${err.message}`);
        } finally {
          setBusy(false);
          setConfirmModal(p => ({ ...p, isOpen: false }));
        }
      }
    });
  };

  if (!isOpen) return null;

  const isUnknown = currentStatus === "unknown";
  const isActive = currentStatus === true;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-[#4A0404] text-[#FDFBF7] rounded-3xl p-8 shadow-2xl w-full max-w-md border border-[#5e0a0a] relative flex flex-col items-center text-center">
          
          <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
              <XCircleIcon className="h-6 w-6" />
          </button>

          <h2 className="text-2xl font-serif font-bold mb-6">Gestione Reseller</h2>

          <div className="w-full space-y-6">
              <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-[#D4AF37]" />
                  </div>
                  <select
                      value={who}
                      onChange={(e) => setWho(e.target.value)}
                      className="w-full pl-10 pr-4 py-4 rounded-xl bg-black/20 border border-white/10 text-zinc-100 text-sm outline-none focus:border-[#D4AF37] transition-all appearance-none cursor-pointer hover:bg-black/30"
                  >
                      {resellersOptions.map((r, i) => (
                        <option key={i} value={r.address} className="text-black bg-white">
                          {r.address}
                        </option>
                      ))}
                  </select>
              </div>

              {who && (
                <div className="animate-in slide-in-from-bottom-2 fade-in duration-300">
                  <div className="flex flex-col items-center justify-center py-4">
                    {checking ? (
                      <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mb-2"></div>
                    ) : isActive ? (
                      <ShieldCheckIcon className="h-12 w-12 text-green-500 mb-2" />
                    ) : (
                      <ShieldExclamationIcon className="h-12 w-12 text-white/20 mb-2" />
                    )}
                    
                    <div className="text-xs uppercase tracking-widest font-bold text-white/50">
                      {checking ? "Verifica stato..." 
                       : isActive ? "Attualmente: ATTIVO" 
                       : "Attualmente: INATTIVO"}
                    </div>
                  </div>

                  {!checking && !isUnknown && (
                      <button
                          onClick={(e) => handleAction(e)}
                          disabled={busy}
                          className={`w-full py-4 font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-95 uppercase text-xs tracking-widest flex items-center justify-center gap-2 
                            ${isActive 
                              ? "bg-red-700 hover:bg-red-600 text-white shadow-red-900/50" 
                              : "bg-[#D4AF37] hover:bg-[#c49f27] text-[#4A0404] shadow-[#D4AF37]/50"
                            }`}
                      >
                          {busy ? "Elaborazione..." : (isActive ? "Revoca Permessi (Disabilita)" : "Concedi Permessi (Abilita)")}
                      </button>
                  )}
                </div>
              )}
          </div>

          {msg && (
            <div className={`mt-6 p-3 rounded-lg text-sm font-bold w-full animate-pulse ${msg.includes("✅") ? "bg-green-900/30 text-green-200 border border-green-500/30" : "bg-red-900/30 text-red-200 border border-red-500/30"}`}>
              {msg}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
        onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))} 
        busy={busy} 
      />
    </>
  );
}