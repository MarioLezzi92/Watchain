import React, { useState, useEffect } from "react";
import AppShell from "../app/AppShell";
import { getBalance } from "../services/walletService";
import { getActiveListings, buyItem, cancelListing } from "../services/marketService"; 
import WatchCard from "../components/domain/WatchCard";
import WatchDetailsModal from "../components/domain/WatchDetailsModal";
import ConfirmModal from "../components/ui/ConfirmModal"; 
import SuccessModal from "../components/ui/SuccessModal"; 
import ErrorModal from "../components/ui/ErrorModal";
import { ArrowPathIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline"; // Aggiunta icona per empty state
import { useSystem } from "../context/SystemContext";
import { apiGet, apiPost } from "../lib/api";
import { useWallet } from "../context/WalletContext";
import { formatError } from "../lib/formatters";


const safeBigInt = (val) => { try { return BigInt(val); } catch { return 0n; } };

export default function MarketPage() {
  const { address, role } = useWallet();
  const [viewMode, setViewMode] = useState('PRIMARY'); 
  const [balanceLux, setBalanceLux] = useState("-");
  const [listings, setListings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null });
  const [successModal, setSuccessModal] = useState({ isOpen: false, message: "" });
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: "" });

  const refreshBalance = async () => {
    if (!address) return;
    try { const b = await getBalance(); setBalanceLux(String(b?.lux ?? "-")); } catch {}
  };

  const refreshListings = async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      const allListings = await getActiveListings();
      const filtered = allListings.filter(item => {
        const sType = String(item.saleType).toUpperCase();
        return viewMode === 'PRIMARY' ? sType === 'PRIMARY' : (sType === 'SECONDARY' && item.certified === true);
      });
      const normalized = filtered.map(item => ({
          ...item,
          priceLux: (safeBigInt(item.price) / 10n**18n).toString()
      }));
      setListings(normalized);
    } catch (e) {
      if (!silent) setErrorModal({ isOpen: true, message: formatError(e) });
    } finally {
      if (!silent) setLoading(false);
    }
  };

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

  // --- AZIONI ---

  const handleCancelClick = (item) => {
    setConfirmModal({
      isOpen: true,
      title: "Ritira Orologio",
      message: "Vuoi annullare la vendita?", 
      onConfirm: async () => {
        setBusy(true);
        try {
          await cancelListing(item.tokenId);
          setSelected(null);
          setSuccessModal({ isOpen: true, message: "Listing rimosso." });
        } catch (e) {
          setErrorModal({ isOpen: true, message: formatError(e) });
        } finally {
          setBusy(false);
          setConfirmModal(p => ({ ...p, isOpen: false }));
        }
      }
    });
  };

  const ensureLuxApprovalThen = async (priceWei, actionFn) => {
    try {
      const res = await apiGet("/market/allowance");
      if (safeBigInt(res?.allowance) >= safeBigInt(priceWei)) return await actionFn();

      setConfirmModal({
        isOpen: true,
        title: "Autorizzazione LUX",
        message: "Devi autorizzare il mercato a prelevare i tuoi LUX per procedere.",
        onConfirm: async () => {
          setBusy(true);
          try {
            await apiPost("/market/approve-lux");
            setConfirmModal(p => ({ ...p, isOpen: false }));
            await actionFn();
          } catch (e) { setErrorModal({ isOpen: true, message: formatError(e) }); }
          finally { setBusy(false); }
        }
      });
    } catch (e) { setErrorModal({ isOpen: true, message: "Errore autorizzazioni." }); }
  };

  const performBuy = async (item) => {
    setBusy(true);
    try {
      await buyItem(role, address, item.tokenId);
      setSelected(null);
      setConfirmModal(p => ({ ...p, isOpen: false }));
      setSuccessModal({ isOpen: true, message: "Acquisto completato!" });
    } catch (e) {
      setErrorModal({ isOpen: true, message: formatError(e) });
    } finally { setBusy(false); }
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
          // FIX: Allineamento a sinistra (text-left) e struttura più pulita per evitare che sembri tutto centrato
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