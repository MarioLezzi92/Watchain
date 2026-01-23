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

// Helper per BigInt
const safeBigInt = (val) => { 
  try { 
    return val != null ? BigInt(val) : 0n; 
  } catch { 
    return 0n; 
  } 
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export default function MarketPage() {
  
  const { address, role, refreshWallet } = useWallet();
  const [viewMode, setViewMode] = useState('PRIMARY'); 
  const [balanceLux, setBalanceLux] = useState("-");
  const [listings, setListings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null });
  const [successModal, setSuccessModal] = useState({ isOpen: false, message: "" });
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: "" });

  const { refreshTrigger } = useSystem();



  const refreshListings = useCallback(async (silent = true) => {
    if (!silent) setLoading(true);

    try {
      if (!role) {
        setListings([]);
        return;
      }

      const roleUrl = getRoleBaseUrl(role);

      // 1) Recupero Eventi
      const evRaw = await FF.subscriptions.eventsByName(
        FF_BASE.producer,
        "watchain_webhook",
        { limit: 500 }
      );

      let events = Array.isArray(evRaw)
        ? evRaw
        : (evRaw.items || evRaw.results || []);

      events = events.reverse(); 

      const getEventName = (e) =>
        String(e?.blockchainEvent?.name || e?.name || e?.event?.name || "").toLowerCase();

      const getOut = (e) =>
        e?.blockchainEvent?.output || e?.data?.output || e?.output || null;

      const getTokenId = (e) => {
        const out = getOut(e);
        if (out?.tokenId != null) return String(out.tokenId);
        if (out?.["0"] != null) return String(out["0"]);
        return null;
      };

      const getSaleType = (e) => {
        const out = getOut(e);
        if (out?.saleType != null) return Number(String(out.saleType)); 
        if (out?.["3"] != null) return Number(String(out["3"]));
        return null;
      };

      const active = new Map();

      for (const e of events) {
        const name = getEventName(e);
        const tokenId = getTokenId(e);
        if (!tokenId) continue;

        if (name === "listed") {
          active.set(tokenId, getSaleType(e));
        } else if (name === "canceled" || name === "purchased") {
          active.delete(tokenId);
        }
      }
      
      const targetType = viewMode === 'PRIMARY' ? 0 : 1;
      const tokenIds = Array.from(active.entries())
        .filter(([_, st]) => st === targetType) 
        .map(([tokenId]) => tokenId);

      const results = [];
      const CHUNK = 30;

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

            if (!listing?.seller) return null;
            const seller = String(listing.seller).toLowerCase();
            if (seller === ZERO_ADDR) return null;

            return {
              tokenId: String(tokenId),
              seller,
              price: listing.price,
              priceLux: formatLux(listing.price),
              saleType: active.get(String(tokenId)) ?? null,
              certified: isCertified, 
            };
          })
        );
        for (const x of batch) if (x) results.push(x);
      }

      results.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));

      setListings(results);
    } catch (e) {
      console.error("refreshListings error:", e);
      setListings([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [role, viewMode]);

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

  useEffect(() => {
    if (role === 'consumer') setViewMode('SECONDARY');
    else setViewMode('PRIMARY');
  }, [role]);

  useEffect(() => {
    refreshBalance();
    refreshListings(true); 
  }, [viewMode, address, role, refreshListings]);


  useEffect(() => {
    if (refreshTrigger > 0) {
      refreshListings(true);
      refreshBalance();
    }
  }, [refreshTrigger, refreshListings, refreshBalance]);


  const handleCancelClick = (item) => {
    setConfirmModal({
      isOpen: true,
      title: "Ritira Orologio",
      message: `Vuoi annullare la vendita dell'orologio #${item.tokenId}?`, 
      onConfirm: async () => {
        setBusy(true);
        try {
          const roleBaseUrl = getRoleBaseUrl(role);
          await FF.watchMarket.invoke.cancelListing(roleBaseUrl, { tokenId: item.tokenId }, { key: address });
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

  const performBuy = async (item) => {
    setBusy(true);
    try {
      const roleBaseUrl = getRoleBaseUrl(role); 
      
      await FF.watchMarket.invoke.buy(roleBaseUrl, { tokenId: item.tokenId }, { key: address }); 
      
      setSuccessModal({ isOpen: true, message: `Acquisto orologio #${item.tokenId} completato!` });
      

      setListings(current => current.filter(x => x.tokenId !== item.tokenId));

      if (balanceLux !== "-" && item.priceLux) {
          try {
              // Nota: serve importare parseLux da formatters.js
              const oldBal = BigInt(parseLux(balanceLux)); 
              const price = BigInt(item.price); // item.price è in Wei
              const newBal = oldBal - price;
              setBalanceLux(formatLux(newBal.toString())); 
          } catch(e) { /* ignore calc errors */ }
      }
      setSelected(null); 
      setConfirmModal(p => ({ ...p, isOpen: false })); 
      refreshListings(true); 
      refreshBalance();       
      refreshWallet();        

    } catch (e) {
      setErrorModal({ isOpen: true, message: formatError(e, "MARKET") });
    } finally { 
      setBusy(false); 
    }
  };

  const handleBuyClick = async (item) => {
      try {
        const roleUrl = getRoleBaseUrl(role);
        const marketAddr = await FF.directory.resolveApi(FF.apis.watchMarket);
        const priceWei = item.price; 


        // 1. Controllo Silenzioso Allowance
        const allowanceRes = await FF.luxuryCoin.query.allowance(roleUrl, {
          owner: address,
          spender: marketAddr
        });
        
        const currentAllowance = safeBigInt(allowanceRes?.output || "0");
        const requiredPrice = safeBigInt(priceWei || "0");

        // CASO A: Ha già i permessi -> Compra diretto
        if (currentAllowance >= requiredPrice) {
            setConfirmModal({
              isOpen: true, 
              title: "Conferma Acquisto",
              message: `Acquistare orologio #${item.tokenId} per ${item.priceLux} LUX?`,
              onConfirm: () => performBuy(item) 
            });
            return;
        }

        // CASO B: Serve Approvazione -> Flusso "Chain" (Approve + Buy)
        setConfirmModal({
          isOpen: true,
          title: "Autorizza e Acquista",
          message: ` Autorizzi l'acquisto dell'orologio #${item.tokenId} per ${item.priceLux} LUX?`,
          onConfirm: async () => {
            setBusy(true); 
            try {
              // STEP 1: APPROVE
              // --- MODIFICA QUI SOTTO ---
              // Aggiunto { key: address } anche qui
              await FF.luxuryCoin.invoke.approve(roleUrl, {
                spender: marketAddr,
                value: priceWei 
              }, { key: address }); 
              // --------------------------

              await new Promise(r => setTimeout(r, 500));

              // STEP 2: BUY (Automatico)
              await performBuy(item); 
            } catch (e) { 
              console.error(e);
              setBusy(false);
              setConfirmModal(p => ({ ...p, isOpen: false }));
              setErrorModal({ isOpen: true, message: formatError(e) }); 
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