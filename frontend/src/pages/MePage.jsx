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

  // --- LOGICA INVENTARIO (AGGIORNATA PER ESCROW) ---
  const refreshInventory = useCallback(async (silent = true) => {
    if (!address) return;
    if (!silent) setLoadingInventory(true);

    try {
      const roleUrl = getRoleBaseUrl(role);
      const myAddr = address.toLowerCase();

      // A. OROLOGI NEL WALLET (Non in vendita)
      const rawBal = await FF.tokens.balances(FF_BASE.producer, {
        pool: "watchnft",
        key: address,
      });
      const rows = Array.isArray(rawBal) ? rawBal : (rawBal.items || rawBal.results || []);
      
      const walletIds = rows
        .filter(r => {
            const key = String(r.key ?? r.account ?? r.owner ?? r.holder ?? "").toLowerCase();
            const amt = Number(r.amount ?? r.balance ?? 0);
            return key === myAddr && amt > 0;
        })
        .map(r => String(r.tokenIndex ?? r.tokenId ?? ""));

      const evRaw = await FF.subscriptions.eventsByName(FF_BASE.producer, "watchain_webhook", { limit: 500 });
      let events = Array.isArray(evRaw) ? evRaw : (evRaw.items || evRaw.results || []);
      events = events.reverse(); // Ordine cronologico per ricostruire stato

      const escrowIds = new Set();
      
      for (const e of events) {
        const name = String(e?.blockchainEvent?.name || "").toLowerCase();
        const out = e?.blockchainEvent?.output || {};
        const tokenId = String(out.tokenId || "");
        
        if (!tokenId) continue;

        if (name === "listed") {
            const seller = String(out.seller || "").toLowerCase();
            if (seller === myAddr) {
                escrowIds.add(tokenId);
            }
        } else if (name === "canceled" || name === "purchased") {
            // Se venduto o cancellato, non è più in escrow a mio nome
            escrowIds.delete(tokenId);
        }
      }

      const allIds = Array.from(new Set([...walletIds, ...escrowIds]));

      const myWatches = [];

      for (const tokenId of allIds) {
        if (!tokenId) continue;

        // Fetch dati on-chain
        const [listingRes, certRes] = await Promise.all([
          FF.watchMarket.query.listings(roleUrl, { "": tokenId }),
          FF.watchNft.query.certified(roleUrl, { tokenId }),
        ]);

        const listing = listingRes.output || listingRes;
        const isCertified = certRes.output === true || String(certRes.output).toLowerCase() === "true";

        let sellerAddr = null;
        let priceLux = null;

        // Verifica se è effettivamente listato
        if (listing?.seller && String(listing.seller) !== ZERO_ADDR) {
          sellerAddr = String(listing.seller).toLowerCase();
          priceLux = formatLux(listing.price);
        }

        const isMineInWallet = walletIds.includes(tokenId);
        const isMineInEscrow = sellerAddr === myAddr;

        if (isMineInWallet || isMineInEscrow) {
            myWatches.push({
              tokenId,
              owner: isMineInEscrow ? sellerAddr : myAddr, // UI trick: mostra me come owner
              seller: sellerAddr,
              price: sellerAddr ? listing.price : null,
              priceLux,
              certified: isCertified,
              isMineOwner: true,
              isMineSeller: isMineInEscrow,
            });
        }
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
  const handleError = (e, context = "GENERAL") => openError(formatError(e, context));

  // --- APPROVAL LOGIC ---
  const ensureMarketApprovalThen = async (actionFn) => {
    const roleUrl = getRoleBaseUrl(role);
    const marketAddr = await FF.directory.resolveApi(FF.apis.watchMarket);
    
    try {
      const res = await FF.watchNft.query.isApprovedForAll(roleUrl, {
        owner: address,
        operator: marketAddr
      });
      
      const isApproved = (res.output === true || String(res.output) === "true");
      
      if (isApproved) return await actionFn();

      openConfirm(
        "Autorizzazione NFT",
        "Per mettere in vendita l'orologio, devi autorizzare il Market a gestire i tuoi NFT. Confermi?",
        async () => {
          setBusy(true);
          try {
            await FF.watchNft.invoke.setApprovalForAll(roleUrl, {
              operator: marketAddr,
              approved: true
            }, { confirm: true, key : address }); 

            await new Promise(r => setTimeout(r, 1000));
            closeModals(); // Chiudi modale conferma
            await actionFn(); // Procedi con l'azione
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


  const handleMint = async () => {
      setBusy(true);
      try {
        const roleUrl = getRoleBaseUrl(role);
        await FF.watchNft.invoke.manufacture(roleUrl,{}, { key: address }); 
        openSuccess("Orologio coniato con successo!");
        refreshInventory(true);
      } catch (e) {
        handleError(e, "FACTORY");
      } finally {
        setBusy(false);
      }
  };

  const handleList = async (item, priceLuxInput) => {
    const roleUrl = getRoleBaseUrl(role);
    const priceInWei = parseLux(priceLuxInput);

    const runListingLogic = async () => {
      setBusy(true);
      try {          
          const method = (role === "producer") ? "listPrimary" : "listSecondary";
          
          await FF.watchMarket.invoke[method](roleUrl, {
            tokenId: item.tokenId,
            price: priceInWei 
          }, { key: address }); 
          
          openSuccess(`Orologio #${item.tokenId} messo in vendita per ${priceLuxInput} LUX!`);
          refreshWallet();
          refreshInventory(true);
          
      } catch (e) {
          handleError(e, "MARKET");
      } finally {
          setBusy(false);
      }
    };
    
    // Serve approvazione solo se NON è già nel market (ma handleList è per non-listati)
    ensureMarketApprovalThen(runListingLogic);
  };

  // Aggiornamento Prezzo 
  const handleUpdatePrice = async (item, newPriceLux) => {
      setBusy(true);
      try {
          const roleUrl = getRoleBaseUrl(role);
          const newPriceWei = parseLux(newPriceLux);

          await FF.watchMarket.invoke.updateListingPrice(roleUrl, {
              tokenId: item.tokenId,
              newPrice: newPriceWei
          }, { key: address });

          openSuccess(`Prezzo aggiornato a ${newPriceLux} LUX!`);
          refreshInventory(true);
      } catch (e) {
          handleError(e, "MARKET");
      } finally {
          setBusy(false);
      }
  };

  const handleCertify = async (item) => {
      setBusy(true);
      try {
        const roleUrl = getRoleBaseUrl(role);
        await FF.watchNft.invoke.certify(roleUrl, { tokenId: item.tokenId }, { key : address });
        openSuccess(`Certificato emesso per orologio #${item.tokenId}!`);
        refreshInventory(true);
      } catch (e) {
        handleError(e, "FACTORY");
      } finally {
        setBusy(false);
      }
  };
   
  const handleCancel = async (item) => {
    setBusy(true);
    try {
      const roleUrl = getRoleBaseUrl(role);
      await FF.watchMarket.invoke.cancelListing(roleUrl, { tokenId: item.tokenId }, { key: address });
      openSuccess("L'orologio è stato ritirato dal mercato.");
      refreshInventory(true);
    } catch (e) {
      handleError(e, "MARKET");
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
      setBusy(true);
      try {
        const roleUrl = getRoleBaseUrl(role);
        await FF.watchMarket.invoke.withdraw(roleUrl, {}, { key: address});
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
      await targetApi.invoke.setEmergencyStop(roleUrl, { status: !currentStatus }, { key: address }); 
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
        
        {/* SIDEBAR PROFILO */}
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
                    <button onClick={() => setModals(p => ({...p, reseller: true}))} className="w-full flex items-center justify-between p-3 rounded-xl bg-[#4A0404] border border-[#D4AF37]/30 hover:border-[#D4AF37] hover:bg-[#5e0a0a] transition-all group">
                        <span className="text-sm font-bold flex items-center gap-2"><UsersIcon className="h-5 w-5 text-red-200"/> Gestisci Reseller</span>
                    </button>
                    <button onClick={() => setModals(p => ({...p, security: true}))} className="w-full flex items-center justify-between p-3 rounded-xl bg-[#5e0a0a] hover:bg-[#700c0c] transition border border-white/5 group">
                        <span className="text-sm font-bold flex items-center gap-2"><ShieldCheckIcon className="h-5 w-5 text-red-200"/> Sicurezza & Emergenza</span>
                    </button>
                </div>
            )}
          </div>
        </div>

        {/* GRIGLIA INVENTARIO */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#4A0404]/10 pb-4">
            <div>
              <div className="text-[#4A0404] text-3xl font-serif font-bold">
                {role === "producer" ? "Vault Produzione" : "La tua Collezione"}
              </div>
              <div className="text-[#4A0404]/60 text-sm mt-1">
                {role === "producer" ? "Gestisci e conia nuovi orologi." : "Visualizza i tuoi acquisti e le vendite in corso."}
              </div>
            </div>
            
            <div className="flex gap-3">
               {role === "producer" && (
                   <button 
                     onClick={() => openConfirm("Nuovo Orologio", "Vuoi coniare un nuovo orologio?", handleMint)}
                     disabled={busy}
                     className="flex items-center gap-2 px-5 py-2.5 bg-[#4A0404] border border-[#D4AF37]/30 text-[#D4AF37] font-bold rounded-xl shadow-lg hover:bg-[#5e0a0a] hover:border-[#D4AF37] disabled:opacity-50 transition"
                   >
                      <PlusIcon className="h-5 w-5"/> Mint
                   </button>
               )}
               <button onClick={() => refreshInventory(false)} disabled={loadingInventory} className="p-2.5 bg-[#4A0404] border border-[#D4AF37]/30 rounded-xl text-[#D4AF37] hover:bg-[#5e0a0a] hover:border-[#D4AF37] transition shadow-lg disabled:opacity-50">
                  <ArrowPathIcon className={`h-5 w-5 ${loadingInventory ? 'animate-spin' : ''}`}/>
               </button>
            </div>
          </div>

          {inventory.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[#4A0404]/20 bg-[#FDFBF7] p-12 text-center text-[#4A0404]/50 font-serif italic">
              {loadingInventory ? "Ricerca in blockchain..." : "Nessun orologio trovato."}
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
        // Funzioni collegate:
        onList={(item, p) => openConfirm("Metti in Vendita", `Prezzo: ${p} LUX. Confermi?`, () => handleList(item, p))}
        onUpdatePrice={(item, p) => openConfirm("Modifica Prezzo", `Nuovo prezzo: ${p} LUX. Confermi?`, () => handleUpdatePrice(item, p))}
        onCancel={(item) => openConfirm("Ritira Orologio", "Vuoi annullare la vendita e ritirare l'orologio dal Mercato?", () => handleCancel(item))}
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