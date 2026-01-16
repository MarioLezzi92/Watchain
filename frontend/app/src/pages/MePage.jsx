import React, { useState, useEffect, useCallback, useRef } from "react";
import AppShell from "../app/AppShell";
import { useWallet } from "../context/WalletContext";
import { useSystem } from "../context/SystemContext";
import { formatError, formatLux } from "../lib/formatters"; 
import { apiPost, apiGet } from "../lib/api"; 

// Components
import WatchCard from "../components/domain/WatchCard";
import WatchDetailsModal from "../components/domain/WatchDetailsModal";
import SecurityModal from "../components/domain/SecurityModal";
import ResellerModal from "../components/domain/ResellerModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import SuccessModal from "../components/ui/SuccessModal";
import ErrorModal from "../components/ui/ErrorModal";

// Icons
import {
  PlusIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ShieldCheckIcon, 
  UsersIcon,
} from "@heroicons/react/24/outline";

// Services
import {
  mintWatch,
  listPrimary,
  listSecondary,
  certify,
  cancelListing,
  getActiveListings as getListings, 
  withdrawCredits,
  getApprovalStatus,
  approveMarket,
} from "../services/marketService";

export default function MePage() {
  // 1. DATI GLOBALI 
  const { address, role, balance, pendingBalance, refreshWallet, loading: walletLoading } = useWallet();
  const { marketPaused, factoryPaused, refreshTrigger, forceRefresh } = useSystem();
  
  // 2. STATO LOCALE
  const [inventory, setInventory] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [busy, setBusy] = useState(false);

  // Stato Modali
  const [selected, setSelected] = useState(null);
  const [modals, setModals] = useState({ 
    detail: false, 
    security: false, 
    reseller: false,
    confirm: null, 
    success: null, 
    error: null    
  });

  // --- LOGICA INVENTARIO  ---
  const refreshInventory = useCallback(async (silent = true) => {
    if (!address) return;
    if (!silent) setLoadingInventory(true);
    
    try {
      const activeListings = await getListings().catch(() => []);
      const myItems = await apiGet("/inventory");

      const listingsArr = Array.isArray(activeListings) ? activeListings : [];
      const myItemsArr = Array.isArray(myItems) ? myItems : [];

      const normalized = myItemsArr.map((item) => {
        const marketListing = listingsArr.find((l) => String(l.tokenId) === String(item.tokenId));
        const rawPrice = marketListing ? marketListing.price : (item.price || "0");
        const isListed = !!marketListing;

        return {
          ...item,
          tokenId: String(item.tokenId),
          owner: String(item.owner || ""),
          seller: String(item.seller || ""),
          certified: Boolean(item.certified),
          priceLux: isListed ? formatLux(rawPrice) : null,
          saleType: item.saleType,
          isMineSeller: (item.seller || "").toLowerCase() === address.toLowerCase(),
          isMineOwner: (item.owner || "").toLowerCase() === address.toLowerCase(),
        };
      });
      
      setInventory(normalized);
    } catch (e) {
      console.error("Inventory error:", e);
    } finally {
      if (!silent) setLoadingInventory(false);
    }
  }, [address]);

  // --- EFFETTI ---
  useEffect(() => {
    refreshInventory(false);
    refreshWallet(); 
  }, [refreshInventory, refreshWallet]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      refreshInventory(true);
      refreshWallet();
    }
  }, [refreshTrigger, refreshInventory, refreshWallet]);


  // --- HELPERS MODALI ---
  const closeModals = () => setModals(p => ({ ...p, detail: false, confirm: null, success: null, error: null }));
  const openConfirm = (title, message, onConfirm) => setModals(p => ({ ...p, confirm: { title, message, onConfirm } }));
  const openSuccess = (msg) => setModals(p => ({ ...p, success: msg, detail: false, confirm: null }));
  const openError = (msg) => setModals(p => ({ ...p, error: msg, confirm: null }));
  
  const ensureMarketApprovalThen = async (actionFn) => {
    const res = await getApprovalStatus();

    if (res?.isApproved) {
      return await actionFn();
    }

    return new Promise((resolve, reject) => {
      openConfirm(
        "Autorizzazione richiesta",
        "Autorizzi il Market a gestire i tuoi NFT per le operazioni di vendita?",
        async () => {
          try {
            await approveMarket();
            const out = await actionFn();
            resolve(out);
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  };

  const handleError = (e) => {
      const msg = formatError(e);
      
      if (msg.includes("paused") || msg.includes("emergency")) {
        openError("Sistema in PAUSA. Operazione bloccata.");
        return;
      }

      if (msg.includes("Only Reseller") || msg.includes("caller is not the reseller")) {
        openError("Operazione riservata a Reseller autorizzati. Contattare il Producer.");
        return;
      }
      openError(msg);
    };

  // --- AZIONI ---
  const performAction = async (actionFn, successMsg) => {
    setBusy(true);
    try {
      await actionFn();
      openSuccess(successMsg);
      refreshInventory(true);
      await refreshWallet(); 
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const handleMint = () => {
    if (factoryPaused) {
      openError("Produzione ferma: La Factory è in Pausa di Emergenza.");
      return;
    }
    performAction(mintWatch, "Orologio creato con successo!");
  };
  

  const handleList = async (item, priceLux) => {
    const runListingLogic = async () => {
      await performAction(async () => {
          if (item.priceLux) await cancelListing(item.tokenId);
            
          if (role === "producer") {
            await listPrimary(item.tokenId, priceLux);
          } else {
            await listSecondary(item.tokenId, priceLux);
          }
      }, "Listato con successo!");
    };
    ensureMarketApprovalThen(runListingLogic);
  };


  const handleCertify = (item) => performAction(() => certify(item.tokenId), `Orologio #${item.tokenId} certificato!`);
  const handleCancel = (item) => performAction(() => cancelListing(item.tokenId), "Listing rimosso.");
  const handleWithdraw = () => performAction(withdrawCredits, "Crediti prelevati con successo!");

  const handleToggleSystem = async (endpoint, currentStatus) => {
    try {
      setBusy(true);
      await apiPost(endpoint, { status: !currentStatus });
      forceRefresh();
      closeModals();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };


  const formattedCredits = formatLux(pendingBalance); 
  const canWithdraw = pendingBalance !== "0" && pendingBalance !== "";

  return (
    <AppShell title="Watchain">
      
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-3xl bg-[#4A0404] text-[#FDFBF7] p-8 shadow-xl sticky top-28 border border-[#5e0a0a]">
            <div className="text-3xl font-serif font-bold tracking-wide mb-6">Il tuo Profilo</div>
            
            <div className="space-y-4 text-sm mb-8">
               <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="text-red-200/80 text-xs uppercase tracking-wider font-bold mb-1">Ruolo</div>
                  <div className="text-white font-mono text-lg font-bold capitalize">{role || "Guest"}</div>
               </div>
               <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="text-red-200/80 text-xs uppercase tracking-wider font-bold mb-1">Indirizzo</div>
                  <div className="font-mono text-zinc-300 break-all text-xs">{address}</div>
               </div>
               <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="text-red-200/80 text-xs uppercase tracking-wider font-bold mb-1 flex justify-between">
                      <span>Saldo</span>
                      <button onClick={refreshWallet} disabled={walletLoading}>
                         <ArrowPathIcon className={`h-4 w-4 text-white/50 hover:text-white ${walletLoading ? 'animate-spin' : ''}`}/>
                      </button>
                  </div>
                  <div className="text-[#D4AF37] text-2xl font-bold">{balance} LUX</div>
               </div>

               {canWithdraw && (
               <div className="bg-[#1A472A]/40 p-4 rounded-xl border border-[#D4AF37]/50 animate-pulse mt-4">
                  <div className="text-[#D4AF37] text-xs uppercase tracking-wider font-bold mb-1 flex items-center gap-1">
                    <BanknotesIcon className="h-4 w-4" /> Vendite da Incassare
                  </div>
                  {/* FIX: Ora visualizza il valore formattato correttamente */}
                  <div className="text-white text-xl font-bold mb-3">
                     {formattedCredits} LUX 
                  </div>
                  <button
                    onClick={() => openConfirm("Incasso Crediti", `Prelevare ${formattedCredits} LUX?`, handleWithdraw)}
                    disabled={busy}
                    className="w-full py-2 bg-[#D4AF37] hover:bg-[#c49f27] text-[#4A0404] font-bold rounded-lg text-xs uppercase tracking-wide shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Preleva Ora
                  </button>
               </div>
               )}
            </div>

            {role === "producer" && (
                <div className="border-t border-white/10 pt-6 space-y-3">
                    <div className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 opacity-80">
                        <WrenchScrewdriverIcon className="h-4 w-4"/> Admin Tools
                    </div>
                    
                    <button 
                        onClick={() => setModals(p => ({...p, reseller: true}))} 
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-[#4A0404] border border-[#D4AF37]/30 hover:border-[#D4AF37] hover:bg-[#5e0a0a] transition-all group shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                        
                        <span className="text-sm font-bold flex items-center gap-2">
                          <UsersIcon className="h-5 w-5 text-red-200"/> Gestisci Reseller</span>
                    </button>
                    
                    <button onClick={() => setModals(p => ({...p, security: true}))} className="w-full flex items-center justify-between p-3 rounded-xl bg-[#5e0a0a] hover:bg-[#700c0c] transition border border-white/5 group">
                        <span className="text-sm font-bold flex items-center gap-2"><ShieldCheckIcon className="h-5 w-5 text-red-200"/> Sicurezza & Emergenza</span>
                    </button>
                </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
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
               {role === "producer" && (
                   <button 
                     onClick={() => openConfirm("Nuovo Orologio", "Vuoi coniare un nuovo orologio?", handleMint)}
                     disabled={busy || factoryPaused}
                     title="Conia Nuovo Orologio"
                     className="flex items-center gap-2 px-5 py-2.5 bg-[#4A0404] border border-[#D4AF37]/30 text-[#D4AF37] font-bold rounded-xl shadow-lg hover:bg-[#5e0a0a] hover:border-[#D4AF37] disabled:opacity-50 transition"
                   >
                      <PlusIcon className="h-5 w-5"/> Mint
                   </button>
               )}
               <button onClick={() => refreshInventory(false)} disabled={loadingInventory} className="p-2.5 bg-[#4A0404] border border-[#D4AF37]/30 rounded-xl text-[#D4AF37] hover:bg-[#5e0a0a] hover:border-[#D4AF37] transition shadow-lg disabled:opacity-50">
                  <ArrowPathIcon title="Aggiorna Inventario" className={`h-5 w-5 ${loadingInventory ? 'animate-spin' : ''}`}/>
               </button>
            </div>
          </div>

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
                    onOpen={(i) => { setSelected(i); setModals(p => ({...p, detail: true})); }} 
                    variant="inventory" 
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- MODALI --- */}
      <WatchDetailsModal 
        open={modals.detail} 
        onClose={() => setModals(p => ({...p, detail: false}))} 
        item={selected} 
        role={role} 
        busy={busy}
        onList={(item, p) => openConfirm("Metti in Vendita", `Prezzo: ${p} LUX. Confermi?`, () => handleList(item, p))}
        onCancel={(item) => openConfirm("Ritira Orologio", "Vuoi annullare la vendita?", () => handleCancel(item))}
        onCertify={(item) => openConfirm("Certificazione", "Emettere certificato di autenticità?", () => handleCertify(item))}
      />
      
      <SecurityModal isOpen={modals.security} onClose={() => setModals(p => ({...p, security: false}))} marketPaused={marketPaused} factoryPaused={factoryPaused} busy={busy} onToggleMarket={() => openConfirm("Sicurezza Market", `Cambiare stato Market?`, () => handleToggleSystem("/market/emergency", marketPaused))} onToggleFactory={() => openConfirm("Sicurezza Factory", `Cambiare stato Factory?`, () => handleToggleSystem("/factory/emergency", factoryPaused))} />
      <ResellerModal isOpen={modals.reseller} onClose={() => setModals(p => ({...p, reseller: false}))} />
      <ConfirmModal isOpen={!!modals.confirm} title={modals.confirm?.title} message={modals.confirm?.message} onConfirm={modals.confirm?.onConfirm} onClose={closeModals} busy={busy} />
      <SuccessModal isOpen={!!modals.success} message={modals.success} onClose={closeModals} />
      <ErrorModal isOpen={!!modals.error} message={modals.error} onClose={closeModals} />
    </AppShell>
  );
}