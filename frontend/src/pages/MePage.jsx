import React, { useState, useEffect, useCallback } from "react";
import AppShell from "../app/AppShell";
import { useWallet } from "../context/WalletContext";
import { useSystem } from "../context/SystemContext";
import { formatError, formatLux, parseLux } from "../lib/formatters"; 

import WatchCard from "../components/domain/WatchCard";
import WatchDetailsModal from "../components/domain/WatchDetailsModal";
import SecurityModal from "../components/domain/SecurityModal";
import ResellerModal from "../components/domain/ResellerModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import SuccessModal from "../components/ui/SuccessModal";
import ErrorModal from "../components/ui/ErrorModal";

import { FF } from "../lib/api"; 
import { FF_BASE } from "../lib/firefly"; 

// Icons
import {
  PlusIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ShieldCheckIcon, 
  UsersIcon,
} from "@heroicons/react/24/outline";

const getRoleBaseUrl = (role) => {
  if (role === 'producer') return FF_BASE.producer;
  if (role === 'reseller') return FF_BASE.reseller;
  return FF_BASE.consumer;
};

// COSTANTE FONDAMENTALE: L'indirizzo vuoto di Solidity
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

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
      const roleUrl = getRoleBaseUrl(role);
      const myAddr = address.toLowerCase();

      // UNICA fonte dati
      const raw = await FF.tokens.balances(FF_BASE.producer, {
        pool: "watchnft",
        key: address,
      });

      const rows = Array.isArray(raw) ? raw : (raw.items || raw.results || []);

      const ownedRows = rows.filter(r => {
        const key = String(r.key ?? r.account ?? r.owner ?? r.holder ?? "").toLowerCase();
        const amtRaw = r.amount ?? r.balance ?? r.value ?? 0;
        const amt = typeof amtRaw === "bigint" ? Number(amtRaw) : Number(String(amtRaw));
        return key === myAddr && Number.isFinite(amt) && amt > 0;
      });

      const myWatches = [];

      for (const r of ownedRows) {
        const tokenId = String(
          r.tokenIndex ?? r.tokenID ?? r.tokenId ?? r.token_id ?? ""
        );
        if (!tokenId) continue;

        const [listingRes, certRes] = await Promise.all([
          FF.watchMarket.query.listings(roleUrl, { "": tokenId }),
          FF.watchNft.query.certified(roleUrl, { tokenId }),
        ]);

        const listing = listingRes.output || listingRes;
        const isCertified =
          certRes.output === true || String(certRes.output).toLowerCase() === "true";

        let sellerAddr = null;
        let priceLux = null;

        if (listing?.seller && listing.seller !== ZERO_ADDR) {
          sellerAddr = listing.seller.toLowerCase();
          priceLux = formatLux(listing.price);
        }

        myWatches.push({
          tokenId,
          owner: myAddr,
          seller: sellerAddr,
          price: sellerAddr ? listing.price : null,
          priceLux,
          certified: isCertified,
          isMineOwner: true,
          isMineSeller: sellerAddr === myAddr,
        });
      }
      myWatches.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
      setInventory(myWatches);
    } catch (e) {
      console.error("Errore recupero inventario:", e);
      setInventory([]);
    } finally {
      if (!silent) setLoadingInventory(false);
    }
  }, [address, role]);





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
    const roleUrl = getRoleBaseUrl(role);
    const marketAddr = import.meta.env.VITE_WATCHMARKET_ADDRESS;
    if (!marketAddr) throw new Error("Missing VITE_WATCHMARKET_ADDRESS in frontend/.env");

    try {
      const res = await FF.watchNft.query.isApprovedForAll(roleUrl, {
        owner: address,
        operator: marketAddr
      });
      
      if (res.output === true) return await actionFn();

      openConfirm(
        "Autorizzazione NFT",
        "Per mettere in vendita l'orologio, devi autorizzare il Market a gestire i tuoi NFT. Confermi?",
        async () => {
          setBusy(true);
          try {
            await FF.watchNft.invoke.setApprovalForAll(roleUrl, {
              operator: marketAddr,
              approved: true
            });
            closeModals();
            setTimeout(async () => await actionFn(), 2000); 
          } catch (e) {
            handleError(e);
          } finally {
            setBusy(false);
          }
        }
      );
    } catch (e) {
      handleError(e);
    }
  };

  const handleError = (e, context = "GENERAL") => {
        const msg = formatError(e, context); // Passiamo il contesto al formatter
        openError(msg);
    };

  // --- AZIONI ---
  const performAction = async (actionFn, successMsg, context = "GENERAL") => { // Aggiungi param
      setBusy(true);
      try {
        await actionFn();
        openSuccess(successMsg);
        refreshWallet();
        refreshInventory(true); 
      } catch (e) {
        handleError(e, context); // Usa param qui
      } finally {
        setBusy(false);
      }
  };

  const handleMint = async () => {
      // Mint è un'azione di Produzione -> FACTORY
      setBusy(true);
      try {
        const roleUrl = getRoleBaseUrl(role);
        await FF.watchNft.invoke.manufacture(roleUrl, { to: address});
        openSuccess("Orologio coniato con successo!");
        refreshWallet();
        refreshInventory(true);
      } catch (e) {
        handleError(e, "FACTORY"); // <--- QUI
      } finally {
        setBusy(false);
      }
    };;
  

const handleList = async (item, priceLuxInput) => {
    const roleUrl = getRoleBaseUrl(role);
    const priceInWei = parseLux(priceLuxInput);

    const runListingLogic = async () => {
      setBusy(true);
      try {
          if (item.priceLux) {
            await FF.watchMarket.invoke.cancelListing(roleUrl, { tokenId: item.tokenId } );
          }
          const method = (role === "producer") ? "listPrimary" : "listSecondary";
          
          await FF.watchMarket.invoke[method](roleUrl, {
            tokenId: item.tokenId,
            price: priceInWei 
          }); 
          openSuccess("Orologio messo in vendita con successo!");
          closeModals();
          refreshWallet(); 
          
      } catch (e) {
          handleError(e, "MARKET");
      } finally {
          setBusy(false);
      }
    };
    ensureMarketApprovalThen(runListingLogic);
  };


  const handleCertify = async (item) => {
      if (role !== "reseller") return openError("Solo Reseller...");
      
      setBusy(true);
      try {
        const roleUrl = getRoleBaseUrl(role);
        await FF.watchNft.invoke.certify(roleUrl, { tokenId: item.tokenId });
        
        openSuccess(`Certificato emesso per orologio #${item.tokenId}!`);
        refreshInventory(true);
      } catch (e) {
        handleError(e, "FACTORY"); // <--- QUI
      } finally {
        setBusy(false);
      }
    };
    
  
   
  const handleCancel = async (item) => {
    await performAction(async () => {
      const roleUrl = getRoleBaseUrl(role);
    
      await FF.watchMarket.invoke.cancelListing(roleUrl, { 
        tokenId: item.tokenId 
      });
      
    }, "L'orologio è stato ritirato dal mercato e riportato nel tuo inventario.", "MARKET");
  };
  

  const handleWithdraw = async () => {
      setBusy(true);
      try {
        const roleUrl = getRoleBaseUrl(role);
        await FF.watchMarket.invoke.withdraw(roleUrl, {});
        openSuccess("LUX prelevati con successo!");
        refreshWallet();
      } catch (e) {
        handleError(e, "MARKET"); 
      } finally {
        setBusy(false);
      }
    };




  const handleToggleSystem = async (system, currentStatus) => {
    setBusy(true);
    try {
      const roleUrl = getRoleBaseUrl(role);
      const targetApi = (system === 'market') ? FF.watchMarket : FF.watchNft; 
      
      await targetApi.invoke.setEmergencyStop(roleUrl, {
        status: !currentStatus 
      }); 

      forceRefresh();
      openSuccess(`Sistema ${system === 'market' ? 'Mercato' : 'Factory'} aggiornato!`);
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
                     disabled={busy}
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
      
      <SecurityModal isOpen={modals.security} onClose={() => setModals(p => ({...p, security: false}))} marketPaused={marketPaused} factoryPaused={factoryPaused} busy={busy} onToggleMarket={() => handleToggleSystem("market", marketPaused)} onToggleFactory={() => handleToggleSystem("factory", factoryPaused)} />
      <ResellerModal isOpen={modals.reseller} onClose={() => setModals(p => ({...p, reseller: false}))} />
      <ConfirmModal isOpen={!!modals.confirm} title={modals.confirm?.title} message={modals.confirm?.message} onConfirm={modals.confirm?.onConfirm} onClose={closeModals} busy={busy} />
      <SuccessModal isOpen={!!modals.success} message={modals.success} onClose={closeModals} />
      <ErrorModal isOpen={!!modals.error} message={modals.error} onClose={closeModals} />
    </AppShell>
  );
}