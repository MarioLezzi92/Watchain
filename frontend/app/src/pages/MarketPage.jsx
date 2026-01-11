import React, { useState, useEffect } from "react";
import AppShell from "../app/AppShell";
import { getBalance } from "../services/walletService";
import { getListings, buy, cancelListing } from "../services/marketService"; 
import WatchCard from "../components/domain/WatchCard";
import WatchDetailsModal from "../components/domain/WatchDetailsModal";
import ConfirmModal from "../components/ui/ConfirmModal"; 
import SuccessModal from "../components/ui/SuccessModal"; 
import ErrorModal from "../components/ui/ErrorModal";
import { io } from "socket.io-client"; 

export default function MarketPage() {
  const role = String(localStorage.getItem("role") || "").toLowerCase();
  const address = localStorage.getItem("address") || "";
  const [balanceLux, setBalanceLux] = useState("-");

  const [listings, setListings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  
  const [loading, setLoading] = useState(false);
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null });
  const [successModal, setSuccessModal] = useState({ isOpen: false, message: "" });
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: "" });

  const marketTitle = (role === '' || role === 'consumer') ? "SECONDARY" : "PRIMARY";

  const refreshBalance = async () => {
    if (!address) {
      setBalanceLux("-");
      return;
    }
    try {
      const b = await getBalance();
      setBalanceLux(String(b?.lux ?? "-"));
    } catch {}
  };

  const refreshListings = async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      const list = await getListings();
      const arr = Array.isArray(list) ? list : [];
      
      const filtered = arr.filter(item => {
        const sType = String(item.saleType || "").toUpperCase();
        try { 
            if (BigInt(item.price || "0") <= 0n) return false; 
        } catch { return false; }

        if (role === '' || role === 'consumer') {
          return sType === 'SECONDARY';
        }
        return sType === 'PRIMARY';
      });
      
      const normalized = filtered.map(item => {
        let priceLux = "0";
        try { 
          priceLux = (BigInt(item.price) / 10n ** 18n).toString(); 
        } catch {
          priceLux = "0";
        }

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

  // --- LOGICA REAL-TIME ---
  useEffect(() => {
    // 1. Caricamento Iniziale
    refreshBalance();
    refreshListings(true);

    // 2. Connessione Socket
    const socket = io("http://localhost:3001");

    // 3. Ascolto Eventi
    socket.on("market-update", (data) => {
      console.log("⚡ EVENTO SOCKET RICEVUTO:", data);
      
      if (data.eventType === "Listed") {
        // Se qualcuno vende, ricarica per avere i dati aggiornati
        refreshListings(true);
      } 
      else if (data.eventType === "Purchased" || data.eventType === "Canceled") {
        // Se venduto/cancellato, lo toglie subito dalla lista visiva
        setListings(prev => prev.filter(item => item.tokenId !== data.tokenId));
      }
    });

    // 4. Pulizia alla chiusura
    return () => {
      socket.disconnect();
    };
  }, []);

  const handleManualRefresh = () => { refreshListings(false); };

  const performBuy = async (item) => {
    if (!address) {
      window.location.href = "/login";
      return;
    }

    setBusy(true);
    try {
      await buy(item.tokenId);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      setOpen(false); 
      setSuccessModal({ isOpen: true, message: "Acquisto completato con successo!" });
    } catch (e) {
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      let errorMsg = e?.response?.data?.error || e.message || "Errore sconosciuto";
      if (errorMsg.includes("transfer amount exceeds balance")) {
         errorMsg = "Saldo LUX insufficiente.";
      }
      setErrorModal({ isOpen: true, message: errorMsg });
    } finally {
      setBusy(false);
    }
  };

  const handleBuyClick = (item) => {
    if (!address) {
        window.location.href = "/login";
        return;
    }
    setConfirmModal({
      isOpen: true,
      title: "Conferma Acquisto",
      message: `Vuoi acquistare l'orologio #${item.tokenId} per ${item.priceLux} LUX?`,
      onConfirm: () => performBuy(item)
    });
  };

  const performCancel = async (item) => {
    setBusy(true);
    try {
      await cancelListing(item.tokenId); 
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      setOpen(false); 
      setSuccessModal({ 
        isOpen: true, 
        message: `L'orologio #${item.tokenId} è stato rimosso dal mercato.` 
      });
    } catch (e) {
      console.error("Errore cancellazione:", e);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      setErrorModal({ 
        isOpen: true, 
        message: "Non è stato possibile rimuovere l'orologio. Riprova." 
      });
    } finally {
      setBusy(false);
    }
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
    <AppShell title="Watchain" address={address} balanceLux={balanceLux}>
      <div className="space-y-8">
        <div className="flex items-end justify-between border-b border-[#4A0404]/10 pb-4">
           <div>
             <h1 className="text-[#4A0404] text-4xl font-serif font-bold">Market {marketTitle}</h1>
             <p className="text-[#4A0404]/60 mt-1">
               {role === 'reseller' ? "Acquista dal Producer." : "Esplora gli orologi in vendita."}
             </p>
           </div>
           <button onClick={handleManualRefresh} disabled={loading} className="px-4 py-2 bg-white border rounded shadow hover:bg-gray-50 text-sm font-bold text-[#4A0404]">
             {loading ? "Refreshing..." : "Refresh Market"}
           </button>
        </div>

        {listings.length === 0 ? (
          <div className="text-center py-10 text-gray-500 italic"> Nessun orologio in vendita. </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((item) => (
               <WatchCard key={item.tokenId} item={item} onOpen={openDetails} variant="market" />
            ))}
          </div>
        )}
      </div>

      <WatchDetailsModal open={open} onClose={() => setOpen(false)} item={selected} role={role} onBuy={handleBuyClick} onCancel={handleCancelClick} busy={busy} />
      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onClose={() => setConfirmModal(p => ({ ...p, isOpen: false }))} busy={busy} />
      <SuccessModal isOpen={successModal.isOpen} message={successModal.message} onClose={() => setSuccessModal(p => ({ ...p, isOpen: false }))} />
      <ErrorModal isOpen={errorModal.isOpen} message={errorModal.message} onClose={() => setErrorModal(p => ({ ...p, isOpen: false }))} />
    </AppShell>
  );
}