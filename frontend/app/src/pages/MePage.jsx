import React, { useMemo, useState, useEffect } from "react";
import AppShell from "../app/AppShell";
import { getBalance } from "../services/walletService";
import { apiGet, apiPost } from "../lib/api";

// --- COMPONENTS ---
import WatchCard from "../components/domain/WatchCard";
import WatchDetailsModal from "../components/domain/WatchDetailsModal";
import SecurityModal from "../components/domain/SecurityModal"; // Assicurati di aver creato questo file
import ResellerModal from "../components/domain/ResellerModal"; // Assicurati di aver creato questo file

// --- UI COMPONENTS ---
import ConfirmModal from "../components/ui/ConfirmModal";
import SuccessModal from "../components/ui/SuccessModal";
import ErrorModal from "../components/ui/ErrorModal"; // Importiamo quello che hai caricato

// --- ICONS ---
import {
  PlusIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ShieldCheckIcon, 
  UsersIcon,
} from "@heroicons/react/24/outline";

import { io } from "socket.io-client";
import {
  mintWatch,
  listPrimary,
  listSecondary,
  certify,
  cancelListing,
  getListings,
  getCredits,
  withdrawCredits,
} from "../services/marketService";

// --- HELPERS ---
function formatLuxFromWei(weiStr) {
  try {
    return (BigInt(String(weiStr || "0")) / 10n ** 18n).toString();
  } catch {
    return "0";
  }
}

function lc(x) {
  return String(x || "").toLowerCase();
}

export default function MePage() {
  const role = useMemo(() => String(localStorage.getItem("role") || "").toLowerCase(), []);
  const address = useMemo(() => String(localStorage.getItem("address") || ""), []);
  
  // --- STATO DATI ---
  const [balanceLux, setBalanceLux] = useState("-");
  const [pendingCredits, setPendingCredits] = useState("0");
  const [inventory, setInventory] = useState([]);
  const [selected, setSelected] = useState(null);
  
  // --- STATO MODALI UI ---
  const [openDetail, setOpenDetail] = useState(false);
  const [openSecurity, setOpenSecurity] = useState(false);
  const [openReseller, setOpenReseller] = useState(false);
  
  // --- STATO SISTEMA & CARICAMENTO ---
  const [busy, setBusy] = useState(false);
  const [marketPaused, setMarketPaused] = useState(false);
  const [factoryPaused, setFactoryPaused] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // --- STATO FEEDBACK ---
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null });
  const [successModal, setSuccessModal] = useState({ isOpen: false, message: "" });
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: "", message: "" });

  // --- REFRESH LOGIC ---
  const refreshAll = () => {
    refreshBalance(true);
    refreshInventory(true);
    refreshSecurityStatus();
  };

  const refreshBalance = async (silent = true) => {
    if (!silent) setLoadingBalance(true);
    try {
      const b = await getBalance();
      setBalanceLux(String(b?.lux ?? "-"));
      const c = await getCredits();
      setPendingCredits(c?.creditsWei || "0");
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoadingBalance(false);
    }
  };

  const refreshSecurityStatus = async () => {
    try {
      const [m, f] = await Promise.all([
        apiGet("/market/status").catch(() => ({ paused: false })),
        apiGet("/factory/status").catch(() => ({ paused: false }))
      ]);
      setMarketPaused(!!m?.paused);
      setFactoryPaused(!!f?.paused);
    } catch (e) {
      console.warn("Security check failed", e);
    }
  };

  const refreshInventory = async (silent = true) => {
    if (!silent) setLoadingInventory(true);
    try {
      const [myItems, activeListings] = await Promise.all([apiGet("/inventory"), getListings()]);
      const listingsArr = Array.isArray(activeListings) ? activeListings : [];
      const myItemsArr = Array.isArray(myItems) ? myItems : [];

      const normalized = myItemsArr.map((item) => {
        const marketListing = listingsArr.find((l) => String(l.tokenId) === String(item.tokenId));
        const rawPrice = marketListing ? String(marketListing.price) : String(item.price || "0");
        const isListed = !!marketListing || rawPrice !== "0";
        return {
          tokenId: String(item.tokenId),
          owner: String(item.owner || ""),
          seller: String(item.seller || ""),
          certified: Boolean(item.certified),
          priceWei: rawPrice,
          priceLux: isListed ? formatLuxFromWei(rawPrice) : null,
          saleType: item.saleType,
          isMineSeller: lc(item.seller) === lc(address),
          isMineOwner: lc(item.owner) === lc(address),
        };
      });
      setInventory(normalized);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoadingInventory(false);
    }
  };

  // --- INIT & SOCKET ---
  useEffect(() => {
    refreshAll();
    const socket = io("http://localhost:3001");
    socket.on("market-update", (data) => {
      console.log("⚡ EVENTO:", data);
      refreshAll();
    });
    return () => socket.disconnect();
  }, []);

  // --- ERROR HANDLER ---
  const handleError = (e, title = "Errore") => {
    const msg = e.message || String(e);
    const isPaused = msg.toLowerCase().includes("paused") || msg.toLowerCase().includes("emergency");
    setErrorModal({
      isOpen: true,
      title: isPaused ? "Operazione Sospesa" : title,
      message: isPaused 
        ? "Impossibile procedere: il sistema è attualmente in stato di EMERGENZA (Paused)." 
        : msg
    });
  };

  const ensureMarketApproval = async () => {
    try {
      const { isApproved } = await apiGet("/market/approval-status");
      if (isApproved) return true;

      return await new Promise((resolve) => {
        setConfirmModal({
          isOpen: true,
          title: "Autorizzazione Necessaria",
          message: "Devi autorizzare il Marketplace a gestire i tuoi NFT. Procedere?",
          onConfirm: async () => {
            try {
              setBusy(true);
              await apiPost("/market/approve-market");
              resolve(true);
            } catch (err) {
              handleError(err, "Errore Approvazione");
              resolve(false);
            } finally {
              setBusy(false);
              setConfirmModal((prev) => ({ ...prev, isOpen: false }));
            }
          },
          onClose: () => {
            resolve(false);
            setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          },
        });
      });
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // --- AZIONI CORE ---
  
  const performMint = async () => {
    setBusy(true);
    try {
      await mintWatch();
      setSuccessModal({ isOpen: true, message: "Orologio creato con successo!" });
      setConfirmModal((p) => ({ ...p, isOpen: false }));
    } catch (e) {
      setConfirmModal((p) => ({ ...p, isOpen: false }));
      handleError(e, "Errore Mint");
    } finally {
      setBusy(false);
    }
  };

  const performList = async (item, price) => {
    try {
      if (!(await ensureMarketApproval())) return;
      setBusy(true);
      
      if (item.priceLux) {
        await cancelListing(item.tokenId);
        await new Promise(r => setTimeout(r, 1000));
      }

      if (role === "producer") await listPrimary(item.tokenId, price);
      else await listSecondary(item.tokenId, price);

      setSuccessModal({ isOpen: true, message: "Listato con successo!" });
      setOpenDetail(false);
      setConfirmModal((p) => ({ ...p, isOpen: false }));
    } catch (e) {
      setConfirmModal((p) => ({ ...p, isOpen: false }));
      handleError(e, "Errore Listing");
    } finally {
      setBusy(false);
    }
  };

  const performCertify = async (item) => {
    setBusy(true);
    try {
      await certify(item.tokenId);
      setSuccessModal({ isOpen: true, message: `Orologio #${item.tokenId} certificato!` });
      setOpenDetail(false);
      setConfirmModal((p) => ({ ...p, isOpen: false }));
    } catch (e) {
      setConfirmModal((p) => ({ ...p, isOpen: false }));
      const msg = e.message || "";
      if (msg.toLowerCase().includes("only reseller")) {
        setErrorModal({
          isOpen: true,
          title: "Non Autorizzato",
          message: "Il tuo indirizzo non è abilitato come Reseller."
        });
      } else {
        handleError(e, "Errore Certificazione");
      }
    } finally {
      setBusy(false);
    }
  };

  const performCancel = async (item) => {
    setBusy(true);
    try {
      await cancelListing(item.tokenId);
      setSuccessModal({ isOpen: true, message: "Listing rimosso." });
      setOpenDetail(false);
      setConfirmModal((p) => ({ ...p, isOpen: false }));
    } catch (e) {
      setConfirmModal((p) => ({ ...p, isOpen: false }));
      handleError(e, "Errore Cancellazione");
    } finally {
      setBusy(false);
    }
  };

  const performWithdraw = async () => {
    setBusy(true);
    try {
      await withdrawCredits();
      setSuccessModal({ isOpen: true, message: "Crediti prelevati!" });
      setConfirmModal((p) => ({ ...p, isOpen: false }));
    } catch (e) {
      setConfirmModal((p) => ({ ...p, isOpen: false }));
      handleError(e, "Errore Prelievo");
    } finally {
      setBusy(false);
    }
  };

  // --- ACTIONS PER SECURITY MODAL ---
  const handleToggleMarket = async () => {
    const action = marketPaused ? "RIATTIVARE" : "BLOCCARE";
    setConfirmModal({
      isOpen: true,
      title: "Sicurezza Market",
      message: `Confermi di ${action} il Marketplace?`,
      onConfirm: async () => {
        try {
          setBusy(true);
          await apiPost("/market/emergency", { status: !marketPaused });
          await refreshSecurityStatus();
          setConfirmModal((p) => ({ ...p, isOpen: false }));
        } catch (e) {
          handleError(e);
        } finally {
          setBusy(false);
        }
      },
      onClose: () => setConfirmModal((p) => ({ ...p, isOpen: false }))
    });
  };

  const handleToggleFactory = async () => {
    const action = factoryPaused ? "RIATTIVARE" : "BLOCCARE";
    setConfirmModal({
      isOpen: true,
      title: "Sicurezza Factory",
      message: `Confermi di ${action} la Produzione?`,
      onConfirm: async () => {
        try {
          setBusy(true);
          await apiPost("/factory/emergency", { status: !factoryPaused });
          await refreshSecurityStatus();
          setConfirmModal((p) => ({ ...p, isOpen: false }));
        } catch (e) {
          handleError(e);
        } finally {
          setBusy(false);
        }
      },
      onClose: () => setConfirmModal((p) => ({ ...p, isOpen: false }))
    });
  };

  return (
    <AppShell title="WatchDApp" address={address} balanceLux={balanceLux}>
      
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        
        {/* --- COLONNA SINISTRA: Profilo & Strumenti --- */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-3xl bg-[#4A0404] text-[#FDFBF7] p-8 shadow-xl sticky top-28 border border-[#5e0a0a]">
            <div className="text-3xl font-serif font-bold tracking-wide mb-6">Il tuo Profilo</div>
            
            {/* Info Wallet */}
            <div className="space-y-4 text-sm mb-8">
               <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="text-red-200/80 text-xs uppercase tracking-wider font-bold mb-1">Ruolo</div>
                  <div className="text-white font-mono text-lg font-bold capitalize">{role}</div>
               </div>
               <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="text-red-200/80 text-xs uppercase tracking-wider font-bold mb-1">Indirizzo</div>
                  <div className="font-mono text-zinc-300 break-all text-xs">{address}</div>
               </div>
               <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="text-red-200/80 text-xs uppercase tracking-wider font-bold mb-1">Saldo</div>
                  <div className="text-[#D4AF37] text-2xl font-bold flex justify-between items-center">
                    {balanceLux} LUX
                    <button onClick={() => refreshBalance(false)} disabled={loadingBalance}>
                        <ArrowPathIcon className={`h-5 w-5 text-white/50 hover:text-white ${loadingBalance ? 'animate-spin' : ''}`}/>
                    </button>
                  </div>
               </div>

               {/* Box Prelievo Crediti */}
               {pendingCredits !== "0" && (
                  <div className="bg-[#1A472A]/40 p-4 rounded-xl border border-[#D4AF37]/50 animate-pulse mt-4">
                    <div className="text-[#D4AF37] text-xs uppercase tracking-wider font-bold mb-1 flex items-center gap-1">
                      <BanknotesIcon className="h-4 w-4" /> Vendite da Incassare
                    </div>
                    <div className="text-white text-xl font-bold mb-3">{pendingCredits} LUX</div>
                    <button
                      onClick={() => setConfirmModal({
                        isOpen:true, title:"Incasso Crediti", message:`Prelevare ${pendingCredits} LUX?`,
                        onConfirm: performWithdraw, onClose: () => setConfirmModal({isOpen:false})
                      })}
                      disabled={busy}
                      className="w-full py-2 bg-[#D4AF37] hover:bg-[#c49f27] text-[#4A0404] font-bold rounded-lg text-xs uppercase tracking-wide shadow-md"
                    >
                      Preleva Ora
                    </button>
                  </div>
               )}
            </div>

            {/* STRUMENTI AMMINISTRATIVI (Solo Producer) */}
            {role === "producer" && (
                <div className="border-t border-white/10 pt-6 space-y-3">
                    <div className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                        <WrenchScrewdriverIcon className="h-4 w-4"/> Admin Tools
                    </div>
                    
                    <button 
                        onClick={() => setOpenReseller(true)} 
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-[#5e0a0a] hover:bg-[#700c0c] transition border border-white/5 group"
                    >
                        <span className="text-sm font-bold flex items-center gap-2">
                            <UsersIcon className="h-5 w-5 text-red-200"/> Gestisci Reseller
                        </span>
                        <ArrowPathIcon className="h-4 w-4 text-white/30 opacity-0 group-hover:opacity-100 -rotate-90 transition"/>
                    </button>
                    
                    <button 
                        onClick={() => setOpenSecurity(true)} 
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-[#5e0a0a] hover:bg-[#700c0c] transition border border-white/5 group"
                    >
                        <span className="text-sm font-bold flex items-center gap-2">
                            <ShieldCheckIcon className="h-5 w-5 text-red-200"/> Sicurezza & Emergenza
                        </span>
                        <ArrowPathIcon className="h-4 w-4 text-white/30 opacity-0 group-hover:opacity-100 -rotate-90 transition"/>
                    </button>
                </div>
            )}
          </div>
        </div>

        {/* --- COLONNA DESTRA: Inventario --- */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Header Vault + Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#4A0404]/10 pb-4">
            <div>
              <div className="text-[#4A0404] text-3xl font-serif font-bold">
                {role === "producer" ? "Vault Produzione" : "La tua Collezione"}
              </div>
              <div className="text-[#4A0404]/60 text-sm mt-1">
                {role === "producer" ? "Gestisci e conia nuovi orologi." : "Visualizza i tuoi acquisti."}
              </div>
            </div>
            
            <div className="flex gap-3">
               {/* Tasto MINT (Solo Producer) */}
               {role === "producer" && (
                   <button 
                     onClick={() => setConfirmModal({
                        isOpen:true, title:"Nuovo Orologio", message:"Vuoi coniare un nuovo orologio?", 
                        onConfirm: performMint, onClose: () => setConfirmModal({isOpen:false})
                     })}
                     disabled={busy || factoryPaused}
                     className="flex items-center gap-2 px-5 py-2.5 bg-[#4A0404] text-[#FDFBF7] font-bold rounded-xl shadow-lg hover:bg-[#5e0a0a] disabled:opacity-50 transition"
                   >
                      <PlusIcon className="h-5 w-5"/> Mint
                   </button>
               )}
               
               {/* Tasto REFRESH */}
               <button 
                 onClick={() => refreshInventory(false)} 
                 disabled={loadingInventory} 
                 className="p-2.5 bg-white border border-[#4A0404]/10 rounded-xl text-[#4A0404] hover:bg-gray-50 transition shadow-sm"
               >
                  <ArrowPathIcon className={`h-5 w-5 ${loadingInventory ? 'animate-spin' : ''}`}/>
               </button>
            </div>
          </div>

          {/* Griglia Orologi */}
          {inventory.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[#4A0404]/20 bg-[#FDFBF7] p-12 text-center text-[#4A0404]/50 font-serif italic">
              {loadingInventory ? "Caricamento..." : "Nessun orologio trovato."}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {inventory.map((it) => (
                <WatchCard 
                    key={it.tokenId} 
                    item={it} 
                    onOpen={(i) => { setSelected(i); setOpenDetail(true); }} 
                    variant="inventory" 
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- MODALI --- */}
      
      {/* 1. Dettaglio Orologio */}
      <WatchDetailsModal 
        open={openDetail} 
        onClose={() => setOpenDetail(false)} 
        item={selected} 
        role={role} 
        onList={(item, p) => setConfirmModal({
            isOpen:true, title:"Metti in Vendita", message:`Prezzo: ${p} LUX. Confermi?`,
            onConfirm: () => performList(item, p), onClose: () => setConfirmModal({isOpen:false})
        })}
        onCancel={(item) => setConfirmModal({
            isOpen:true, title:"Ritira Orologio", message:"Vuoi annullare la vendita?",
            onConfirm: () => performCancel(item), onClose: () => setConfirmModal({isOpen:false})
        })}
        onCertify={(item) => setConfirmModal({
            isOpen:true, title:"Certificazione", message:"Emettere certificato di autenticità?",
            onConfirm: () => performCertify(item), onClose: () => setConfirmModal({isOpen:false})
        })}
        busy={busy}
      />
      
      {/* 2. Modali Admin (Nuovi) */}
      <SecurityModal 
         isOpen={openSecurity} 
         onClose={() => setOpenSecurity(false)} 
         marketPaused={marketPaused} 
         factoryPaused={factoryPaused} 
         onToggleMarket={handleToggleMarket} 
         onToggleFactory={handleToggleFactory} 
         busy={busy} 
      />
      
      <ResellerModal 
         isOpen={openReseller} 
         onClose={() => setOpenReseller(false)} 
         onDone={() => { refreshAll(); /* opzionale: chiudi modale */ }} 
      />

      {/* 3. Feedback Modals */}
      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
        onClose={confirmModal.onClose || (() => setConfirmModal(p => ({...p, isOpen:false})))} 
        busy={busy} 
      />
      
      <SuccessModal 
        isOpen={successModal.isOpen} 
        message={successModal.message} 
        onClose={() => setSuccessModal({isOpen:false})} 
      />
      
      <ErrorModal 
        isOpen={errorModal.isOpen} 
        title={errorModal.title} 
        message={errorModal.message} 
        onClose={() => setErrorModal({isOpen:false})} 
      />

    </AppShell>
  );
}