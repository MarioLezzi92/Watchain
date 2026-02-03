import React, { useState, useEffect, useCallback } from "react";
import AppShell from "../app/AppShell";
import WatchCard from "../components/domain/WatchCard";
import WatchDetailsModal from "../components/domain/WatchDetailsModal";
import ConfirmModal from "../components/ui/ConfirmModal"; 
import SuccessModal from "../components/ui/SuccessModal"; 
import ErrorModal from "../components/ui/ErrorModal";
import { ArrowPathIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline"; 
import { useSystem } from "../context/SystemContext";
import { useWallet } from "../context/WalletContext";
import { parseLux, formatError, formatLux } from "../lib/formatters"; 
import { FF, FF_BASE } from "../lib/api";

const getRoleBaseUrl = (role) => {
  if (role === 'producer') return FF_BASE.producer;
  if (role === 'reseller') return FF_BASE.reseller;
  return FF_BASE.consumer;
};

const safeBigInt = (val) => { 
  try { return val != null ? BigInt(val) : 0n; } catch { return 0n; } 
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export default function MarketPage() {
  const { address, role, refreshWallet } = useWallet();
  const [viewMode, setViewMode] = useState('PRIMARY'); 
  const [balanceLux, setBalanceLux] = useState("-");
  const [listings, setListings] = useState([]);
  const [selected, setSelected] = useState(null);
  
  // Stati UI (Loading, Busy, Modali)
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null });
  const [successModal, setSuccessModal] = useState({ isOpen: false, message: "" });
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: "" });

  const { refreshTrigger } = useSystem();

  /**
   * RICOSTRUZIONE STATO MERCATO (Event Sourcing Pattern)
   * Invece di interrogare singolarmente ogni token (lento), scarichiamo il log degli eventi
   * e ricostruiamo localmente quali orologi sono attualmente "listed".
   */
  const refreshListings = useCallback(async (silent = true) => {
    if (!silent) setLoading(true);

    try {
      if (!role) {
        setListings([]);
        return;
      }
      const roleUrl = getRoleBaseUrl(role);

      // 1. Fetch Eventi (Blockchain Log)
      const evRaw = await FF.subscriptions.eventsByName(FF_BASE.producer, "watchain_webhook", { limit: 500 });
      let events = Array.isArray(evRaw) ? evRaw : (evRaw.items || evRaw.results || []);
      
      // Elaboriamo dal più recente al più vecchio
      events = events.reverse(); 

      // Helpers per parsing sicuro
      const getEventName = (e) => String(e?.blockchainEvent?.name || "").toLowerCase();
      const getOut = (e) => e?.blockchainEvent?.output || {};
      const getTokenId = (e) => {
        const out = getOut(e);
        return out?.tokenId != null ? String(out.tokenId) : null;
      };
      const getSaleType = (e) => {
        const out = getOut(e);
        return out?.saleType != null ? Number(String(out.saleType)) : null;
      };

      // 2. Replay degli eventi per determinare lo stato attuale
      const active = new Map();

      for (const e of events) {
        const name = getEventName(e);
        const tokenId = getTokenId(e);
        if (!tokenId) continue;

        if (name === "listed") {
          // Se listato, lo aggiungiamo alla mappa con il suo tipo (Primario/Secondario)
          active.set(tokenId, getSaleType(e));
        } else if (name === "canceled" || name === "purchased") {
          // Se venduto o cancellato, lo rimuoviamo
          active.delete(tokenId);
        }
      }
      
      // 3. Filtro per Mercato Primario (0) o Secondario (1)
      const targetType = viewMode === 'PRIMARY' ? 0 : 1;
      const tokenIds = Array.from(active.entries())
        .filter(([_, st]) => st === targetType) 
        .map(([tokenId]) => tokenId);

      // 4. Data Enrichment (Batch Request)
      // Recuperiamo dettagli (prezzo, venditore, certificazione) solo per i token attivi
      const results = [];
      const CHUNK = 30; // Batching per non sovraccaricare il nodo

      for (let i = 0; i < tokenIds.length; i += CHUNK) {
        const slice = tokenIds.slice(i, i + CHUNK);
        const batch = await Promise.all(
          slice.map(async (tokenId) => {
            const [listingRes, certRes] = await Promise.all([
              FF.watchMarket.query.listings(roleUrl, { "": String(tokenId) }),
              FF.watchNft.query.certified(roleUrl, { tokenId: String(tokenId) })
            ]);

            const listing = listingRes.output || listingRes;
            const isCertified = certRes.output === true || String(certRes.output) === "true";

            if (!listing?.seller || String(listing.seller).toLowerCase() === ZERO_ADDR) return null;

            return {
              tokenId: String(tokenId),
              seller: String(listing.seller).toLowerCase(),
              price: listing.price,
              priceLux: formatLux(listing.price),
              saleType: active.get(String(tokenId)) ?? null,
              certified: isCertified, 
            };
          })
        );
        for (const x of batch) if (x) results.push(x);
      }

      // Ordinamento per ID
      results.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
      setListings(results);

    } catch (e) {
      console.error("refreshListings error:", e);
      setListings([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [role, viewMode]);

  // Recupero Saldo LUX
  const refreshBalance = useCallback(async () => {
    if (!address || !role) return;
    try {
      const roleUrl = getRoleBaseUrl(role);
      const res = await FF.luxuryCoin.query.balanceOf(roleUrl, { account: address });      
      setBalanceLux(formatLux(res?.output || "0"));
    } catch (error) {
      console.error("ERROR BALANCE: ", error);
    }
  }, [address, role]);

  // Effetti collaterali per cambio stato
  useEffect(() => {
    if (role === 'consumer') setViewMode('SECONDARY');
    else setViewMode('PRIMARY');
  }, [role]);

  useEffect(() => {
    refreshBalance();
    refreshListings(true); 
  }, [viewMode, address, role, refreshListings, refreshBalance]);

  // Aggiornamento Real-Time (Socket.io Trigger)
  useEffect(() => {
    if (refreshTrigger > 0) {
      refreshListings(true);
      refreshBalance();
    }
  }, [refreshTrigger, refreshListings, refreshBalance]);


  // --- AZIONI UTENTE ---

  const handleCancelClick = (item) => {
    setConfirmModal({
      isOpen: true,
      title: "Ritira Orologio",
      message: `Vuoi annullare la vendita dell'orologio #${item.tokenId}?`, 
      onConfirm: async () => {
        setBusy(true);
        try {
          const roleBaseUrl = getRoleBaseUrl(role);
          // Invio transazione sicura tramite Backend Proxy
          await FF.watchMarket.invoke.cancelListing(roleBaseUrl, { tokenId: item.tokenId }, { key: address });
          
          // UI Update Ottimistico
          setListings(current => current.filter(x => x.tokenId !== item.tokenId));
          setSelected(null);
          setSuccessModal({ isOpen: true, message: "Listing rimosso." });
          refreshBalance();
          refreshWallet();
        } catch (e) {
          setErrorModal({ isOpen: true, message: formatError(e, "MARKET") });
        } finally {
          setBusy(false);
          setConfirmModal(p => ({ ...p, isOpen: false }));
        }
      }
    });
  };

  /**
   * LOGICA DI ACQUISTO (ERC-20 Approval Pattern)
   * 1. Check Allowance: Verifichiamo se il Market è autorizzato a spendere i nostri LUX.
   * 2. Se NO -> Invoke Approve (Transazione 1) -> Wait -> Invoke Buy (Transazione 2).
   * 3. Se SI -> Invoke Buy (Transazione unica).
   */
  const handleBuyClick = async (item) => {
    try {
      const roleUrl = getRoleBaseUrl(role);
      const marketAddr = await FF.directory.resolveApi(FF.apis.watchMarket);
      const priceWei = item.price; 

      // 1. Controllo Allowance
      const allowanceRes = await FF.luxuryCoin.query.allowance(roleUrl, {
        owner: address,
        spender: marketAddr
      });
      
      const currentAllowance = safeBigInt(allowanceRes?.output || "0");
      const requiredPrice = safeBigInt(priceWei || "0");

      const executeBuy = async () => {
        setBusy(true);
        try {
           await FF.watchMarket.invoke.buy(roleUrl, { tokenId: item.tokenId }, { key: address });
           setSuccessModal({ isOpen: true, message: `Acquisto orologio #${item.tokenId} completato!` });
           setListings(current => current.filter(x => x.tokenId !== item.tokenId));
           setSelected(null);
           refreshListings(true);
           refreshBalance();
           refreshWallet();
        } catch(e) {
           setErrorModal({ isOpen: true, message: formatError(e, "MARKET") });
        } finally {
           setBusy(false);
           setConfirmModal(p => ({ ...p, isOpen: false }));
        }
      };

      // CASO A: Allowance Sufficiente -> Acquisto diretto
      if (currentAllowance >= requiredPrice) {
          setConfirmModal({
            isOpen: true, 
            title: "Conferma Acquisto",
            message: `Acquistare orologio #${item.tokenId} per ${item.priceLux} LUX?`,
            onConfirm: executeBuy 
          });
          return;
      }

      // CASO B: Allowance Insufficiente -> Approve + Buy
      setConfirmModal({
        isOpen: true,
        title: "Autorizza e Acquista",
        message: `È necessaria l'approvazione per spendere ${item.priceLux} LUX. Procedere?`,
        onConfirm: async () => {
          setBusy(true); 
          try {
            // STEP 1: APPROVE
            await FF.luxuryCoin.invoke.approve(roleUrl, {
              spender: marketAddr,
              value: priceWei 
            }, { key: address }); 
            
            // Piccola attesa per propagazione
            await new Promise(r => setTimeout(r, 1000));

            // STEP 2: BUY
            await FF.watchMarket.invoke.buy(roleUrl, { tokenId: item.tokenId }, { key: address });
            
            setSuccessModal({ isOpen: true, message: `Acquisto orologio #${item.tokenId} completato!` });
            setListings(current => current.filter(x => x.tokenId !== item.tokenId));
            setSelected(null);
            refreshListings(true);
            refreshBalance();
            refreshWallet();
          } catch (e) { 
            console.error(e);
            setErrorModal({ isOpen: true, message: formatError(e) }); 
          } finally {
            setBusy(false);
            setConfirmModal(p => ({ ...p, isOpen: false }));
          }
        }
      });

    } catch (e) {
        console.error(e);
        setErrorModal({ isOpen: true, message: "Errore durante la preparazione dell'acquisto." });
    }
  };

  return (
    <AppShell title="Watchain" address={address} balanceLux={balanceLux}>
      <div className="space-y-8">
        <div className="flex justify-between items-end border-b border-[#4A0404]/10 pb-4">
           <div>
             <h1 className="text-[#4A0404] text-4xl font-serif font-bold">Market</h1>
             
             {/* Filtri Mercato */}
             <div className="flex w-fit gap-2 mt-4 bg-[#4A0404]/5 p-1 rounded-lg">
                {role !== 'consumer' && (
                  <button onClick={() => setViewMode('PRIMARY')} 
                    className={`px-4 py-1 text-xs font-bold rounded-md transition ${viewMode === 'PRIMARY' ? 'bg-[#4A0404] text-[#D4AF37]' : 'text-[#4A0404]/40'}`}>
                    PRIMARY
                  </button>
                )}
                {role !== 'producer' && (
                  <button onClick={() => setViewMode('SECONDARY')} 
                    className={`px-4 py-1 text-xs font-bold rounded-md transition ${viewMode === 'SECONDARY' ? 'bg-[#4A0404] text-[#D4AF37]' : 'text-[#4A0404]/40'}`}>
                    SECONDARY
                  </button>
                )}
             </div>
           </div>
           
           <button 
             onClick={() => refreshListings(false)} 
             className="p-2.5 bg-[#4A0404] border border-[#D4AF37]/30 rounded-xl text-[#D4AF37]"
           >
             <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}/>
           </button>
        </div>

        {listings.length === 0 ? (
          <div className="w-full text-left py-12 text-gray-400 italic flex items-start gap-2">
            <ExclamationCircleIcon className="h-6 w-6 text-gray-300" />
            <span>Nessun orologio disponibile in questa sezione al momento.</span>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {listings.map(item => <WatchCard key={item.tokenId} item={item} onOpen={setSelected} variant="market" />)}
          </div>
        )}
      </div>

      <WatchDetailsModal 
        open={!!selected} 
        onClose={() => setSelected(null)} 
        item={selected} 
        role={role} 
        onBuy={handleBuyClick} 
        onCancel={handleCancelClick} 
        busy={busy} 
      />

      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onClose={() => setConfirmModal(p=>({...p, isOpen:false}))} busy={busy} />
      <SuccessModal isOpen={successModal.isOpen} message={successModal.message} onClose={() => setSuccessModal({isOpen:false})} />
      <ErrorModal isOpen={errorModal.isOpen} message={errorModal.message} onClose={() => setErrorModal({isOpen:false})} />
    </AppShell>
  );
}