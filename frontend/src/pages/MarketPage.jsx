import React, { useState, useEffect } from "react";
import AppShell from "../app/AppShell";
import WatchCard from "../components/domain/WatchCard";
import WatchDetailsModal from "../components/domain/WatchDetailsModal";
import ConfirmModal from "../components/ui/ConfirmModal"; 
import SuccessModal from "../components/ui/SuccessModal"; 
import ErrorModal from "../components/ui/ErrorModal";
import { ArrowPathIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline"; 
import { useSystem } from "../context/SystemContext";
import { useWallet } from "../context/WalletContext";
import { formatError, formatLux } from "../lib/formatters"; 

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

const MAX_APPROVAL = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
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

  useEffect(() => {
    if (role === 'consumer') setViewMode('SECONDARY');
    else setViewMode('PRIMARY');
  }, [role]);

  useEffect(() => {
    refreshBalance();
    refreshListings(true); 
  }, [viewMode, address]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      refreshListings(true);
      refreshBalance();
    }
  }, [refreshTrigger]);


  const refreshBalance = async () => {
    if (!address || !role) return;
    try {
      const roleUrl = getRoleBaseUrl(role);
      const res = await FF.luxuryCoin.query.balanceOf(roleUrl, { account: address });       
      setBalanceLux(formatLux(res?.output || "0"));
    } catch (error) {
      console.error("ERROR BALANCE: ", error);
    }
  };

  const refreshListings = async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      const roleUrl = getRoleBaseUrl(role);
      
      const nextIdRes = await FF.watchNft.query.nextId(roleUrl);
      const total = Number(nextIdRes.output);

      let active = [];
      
      for (let i = 1; i <= total; i++) {
        const res = await FF.watchMarket.query.listings(roleUrl, { "": String(i) });
        const item = res.output || res; 

        if (!item) continue;

        const seller = String(item.seller || "").toLowerCase();
        
        if (seller && seller !== ZERO_ADDR) {
          active.push({ ...item, tokenId: i, seller });
        }
      }

      const filtered = active.filter(item => {
        const saleTypeStr = String(item.saleType); 
        const isPrimary = saleTypeStr === "0";
        return viewMode === 'PRIMARY' ? isPrimary : !isPrimary;
      });

      const normalized = filtered.map(item => ({
          ...item,
          priceLux: formatLux(item.price)
      }));
      
      setListings(normalized);
    } catch (e) {
      console.error("Listing Error:", e);
      if (!silent) setErrorModal({ isOpen: true, message: formatError(e) });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // --- AZIONI ---

  const handleCancelClick = (item) => {
    setConfirmModal({
      isOpen: true,
      title: "Ritira Orologio",
      message: `Vuoi annullare la vendita dell'orologio #${item.tokenId}?`, 
      onConfirm: async () => {
        setBusy(true);
        try {
          const roleBaseUrl = getRoleBaseUrl(role);
          await FF.watchMarket.invoke.cancelListing(roleBaseUrl, { tokenId: item.tokenId });

          setSelected(null);
          setSuccessModal({ isOpen: true, message: "Listing rimosso." });
          refreshListings(false);
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

  const ensureLuxApprovalThen = async (priceWei, actionFn) => {
    try {
      const roleUrl = getRoleBaseUrl(role);
      const marketAddr = import.meta.env.VITE_WATCHMARKET_ADDRESS;

      // 1. Controlliamo l'Allowance attuale
      const allowanceRes = await FF.luxuryCoin.query.allowance(roleUrl, {
        owner: address,
        spender: marketAddr
      });
      
      const val = allowanceRes?.output || allowanceRes?.allowance || "0";
      const currentAllowance = safeBigInt(val);
      const requiredPrice = safeBigInt(priceWei || "0");

      // Se l'allowance è sufficiente (es. è già infinita), procediamo subito
      if (currentAllowance >= requiredPrice) return await actionFn();

      // Altrimenti chiediamo l'approvazione (UNA TANTUM)
      setConfirmModal({
        isOpen: true,
        title: "Autorizzazione LUX",
        message: "Per procedere, devi autorizzare il Market a gestire i tuoi LUX. Questa operazione va fatta una volta sola.",
        onConfirm: async () => {
          setBusy(true);
          try {
            // FIX: Usiamo MAX_APPROVAL e il parametro 'value'
            await FF.luxuryCoin.invoke.approve(roleUrl, {
              spender: marketAddr,
              value: MAX_APPROVAL 
            });

            setConfirmModal(p => ({ ...p, isOpen: false }));
            
            // Pausa per dare tempo alla blockchain di registrare l'approvazione
            setTimeout(async () => await actionFn(), 2000);
          } catch (e) { 
            console.error(e);
            setErrorModal({ isOpen: true, message: formatError(e) }); 
          } finally { 
            setBusy(false); 
          }
        }
      });
    } catch (e) { 
        console.error(e);
        setErrorModal({ isOpen: true, message: "Errore controllo autorizzazioni LUX." }); 
    }
  };

  const performBuy = async (item) => {
      setBusy(true);
      try {
        const roleBaseUrl = getRoleBaseUrl(role); 
        await FF.watchMarket.invoke.buy(roleBaseUrl, { tokenId: item.tokenId });
        
        setSuccessModal({ isOpen: true, message: `Acquisto orologio #${item.tokenId} completato!` });
        
        setSelected(null); 
        setConfirmModal(p => ({ ...p, isOpen: false })); 
        
        refreshListings(false); 
        refreshBalance();       
        refreshWallet();        

      } catch (e) {
        setErrorModal({ isOpen: true, message: formatError(e, "MARKET") });
      } finally { 
        setBusy(false); 
      }
    };

  const handleBuyClick = (item) => {
    if (!address) { window.location.href = "/login"; return; }
    if (viewMode === 'PRIMARY' && role !== 'reseller') {
        return setErrorModal({ isOpen: true, message: "Accesso negato: Solo i rivenditori possono acquistare qui." });
    }
    if (viewMode === 'SECONDARY' && role !== 'consumer') {
        return setErrorModal({ isOpen: true, message: "Accesso negato: Solo i clienti privati possono acquistare qui." });
    }

    ensureLuxApprovalThen(item.price, () => {
      setConfirmModal({
        isOpen: true, 
        title: "Conferma Acquisto",
        message: `Acquistare orologio #${item.tokenId} per ${item.priceLux} LUX?`,
        onConfirm: () => performBuy(item)
      });
    });
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