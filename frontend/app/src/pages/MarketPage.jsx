import React, { useState, useEffect, useMemo } from "react";
import AppShell from "../app/AppShell";
import usePolling from "../hooks/usePolling";
import { getBalance } from "../services/walletService";
import { getListings, buy, cancelListing } from "../services/marketService"; // Importiamo cancelListing
import WatchCard from "../components/domain/WatchCard";
import WatchDetailsModal from "../components/domain/WatchDetailsModal";
import ConfirmModal from "../components/ui/ConfirmModal"; 
import SuccessModal from "../components/ui/SuccessModal"; 
import ErrorModal from "../components/ui/ErrorModal";
import { ArrowPathIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";

export default function MarketPage() {
  const role = useMemo(() => String(localStorage.getItem("role") || "").toLowerCase(), []);
  const address = useMemo(() => String(localStorage.getItem("address") || ""), []);
  const [balanceLux, setBalanceLux] = useState("-");

  const [listings, setListings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  
  const [loading, setLoading] = useState(false);
  
  // Stati Modali
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null });
  const [successModal, setSuccessModal] = useState({ isOpen: false, message: "" });
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: "" });

  const marketTitle = (role === 'consumer') ? "SECONDARY" : "PRIMARY";

  const refreshBalance = async () => {
    try {
      const b = await getBalance();
      setBalanceLux(String(b?.lux ?? "-"));
    } catch {}
  };

  // --- FUNZIONE AGGIORNATA CON I FILTRI CORRETTI ---
  const refreshListings = async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      const list = await getListings();
      const arr = Array.isArray(list) ? list : [];
      
      const filtered = arr.filter(item => {
        // Controllo base prezzo valido (deve essere > 0)
        try { if (BigInt(item.price || "0") <= 0n) return false; } catch { return false; }

        const sType = String(item.saleType || "").toUpperCase();
        
        // --- LOGICA DI VISUALIZZAZIONE ---

        // 1. CONSUMER: Vede solo il mercato SECONDARY (venduto da Reseller)
        if (role === 'consumer') {
          return sType === 'SECONDARY';
        }

        // 2. RESELLER: Vede solo il mercato PRIMARY (venduto da Producer)
        // I suoi orologi in vendita (Secondary) li vede nel suo Profilo (MePage).
        if (role === 'reseller') {
          return sType === 'PRIMARY';
        }

        // 3. PRODUCER: Vede il mercato PRIMARY (i suoi listing)
        if (role === 'producer') {
          return sType === 'PRIMARY';
        }

        return true; 
      });
      
      const normalized = filtered.map(item => {
        let priceLux = "0";
        try { priceLux = (BigInt(item.price) / 10n ** 18n).toString(); } catch {}

        return {
          tokenId: String(item.tokenId),
          seller: String(item.seller || ""),
          owner: String(item.owner || ""),
          certified: Boolean(item.certified),
          priceWei: item.price,
          priceLux: priceLux,
          saleType: item.saleType
        };
      });

      setListings(normalized);
    } catch (e) {
      console.error("Errore Mercato:", e);
      if (!silent) setErrorModal({ isOpen: true, message: "Impossibile aggiornare il mercato: " + e.message });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    refreshBalance();
    refreshListings(true);
  }, []);

  usePolling(refreshBalance, 10000, []);
  usePolling(() => refreshListings(true), 5000, []);

  const handleManualRefresh = () => { refreshListings(false); };

  // --- LOGICA ACQUISTO ---
  const performBuy = async (item) => {
    setBusy(true);
    try {
      await buy(item.tokenId);
      
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      setOpen(false); 
      
      setSuccessModal({ isOpen: true, message: "Acquisto completato con successo! Trovi l'orologio nel tuo Inventario." });
      
      setTimeout(() => {
          refreshListings(true);
          refreshBalance();
      }, 1000);

    } catch (e) {
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      console.error(e);

      let errorMsg = e?.response?.data?.error || e.message || "Errore sconosciuto";
      if (errorMsg.includes("transfer amount exceeds balance") || errorMsg.includes("500")) {
         errorMsg = "Fondi insufficienti per completare l'acquisto.";
      }
      setErrorModal({ isOpen: true, message: errorMsg });

    } finally {
      setBusy(false);
    }
  };

  // --- LOGICA CANCELLAZIONE (Aggiunta) ---
  const performCancel = async (item) => {
    setBusy(true);
    try {
      await cancelListing(item.tokenId);
      
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      setOpen(false);
      
      setSuccessModal({ isOpen: true, message: "Listing ritirato dal mercato con successo." });
      
      setTimeout(() => {
          refreshListings(true);
          refreshBalance();
      }, 1000);

    } catch (e) {
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      console.error(e);
      let errorMsg = e?.response?.data?.error || e.message || "Errore durante la cancellazione.";
      setErrorModal({ isOpen: true, message: errorMsg });
    } finally {
      setBusy(false);
    }
  };

  const handleBuyClick = (item) => {
    setConfirmModal({
      isOpen: true,
      title: "Conferma Acquisto",
      message: `Vuoi acquistare l'orologio #${item.tokenId} per ${item.priceLux} LUX?`,
      onConfirm: () => performBuy(item)
    });
  };

  const handleCancelClick = (item) => {
    setConfirmModal({
      isOpen: true,
      title: "Ritiro Orologio",
      message: `Sei sicuro di voler ritirare l'orologio #${item.tokenId} dalla vendita?`,
      onConfirm: () => performCancel(item)
    });
  };

  const openDetails = (item) => { setSelected(item); setOpen(true); };

  return (
    <AppShell title="WatchDApp" address={address} balanceLux={balanceLux}>
      <div className="space-y-8">
        
        {/* HEADER */}
        <div className="flex items-end justify-between border-b border-[#4A0404]/10 pb-4">
           <div>
             <h1 className="text-[#4A0404] text-4xl font-serif font-bold">Market {marketTitle}</h1>
             <p className="text-[#4A0404]/60 mt-1">
               {role === 'reseller' 
                 ? "Acquista orologi grezzi dal Producer." 
                 : "Esplora gli orologi in vendita."}
             </p>
           </div>
           
           <button 
             onClick={handleManualRefresh}
             disabled={loading}
             className="flex items-center gap-2 px-6 py-2.5 bg-white text-[#4A0404] font-bold rounded-xl shadow-md hover:shadow-xl hover:bg-[#4A0404] hover:text-white transition-all duration-300 disabled:opacity-50 border border-[#4A0404]/5"
           >
             {loading && <ArrowPathIcon className="h-5 w-5 animate-spin"/>}
             {loading ? "Refreshing..." : "Refresh Market"}
           </button>
        </div>

        {/* GRIGLIA */}
        {listings.length === 0 ? (
          <div className="py-20 text-center rounded-3xl bg-white/50 border-2 border-dashed border-[#4A0404]/10">
             <ShoppingCartIcon className="h-16 w-16 text-[#4A0404]/20 mx-auto mb-4"/>
             <p className="text-[#4A0404]/50 font-serif text-xl italic">
               {role === 'reseller' 
                 ? "Nessun orologio del Producer disponibile." 
                 : "Nessun orologio in vendita."}
             </p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((item) => (
               <WatchCard 
                 key={item.tokenId} 
                 item={item} 
                 onOpen={openDetails} 
                 variant="market" 
               />
            ))}
          </div>
        )}

      </div>

      <WatchDetailsModal
        open={open}
        onClose={() => setOpen(false)}
        item={selected}
        role={role}
        onBuy={handleBuyClick}
        onCancel={handleCancelClick}
        busy={busy}
      />

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        busy={busy}
      />

      <SuccessModal 
        isOpen={successModal.isOpen}
        message={successModal.message}
        onClose={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}
      />

      <ErrorModal 
        isOpen={errorModal.isOpen}
        message={errorModal.message}
        onClose={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
      />

    </AppShell>
  );
}