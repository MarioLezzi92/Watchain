import React, { useMemo, useState, useEffect } from "react";
import AppShell from "../app/AppShell";
import { getBalance } from "../services/walletService";
import { apiGet, apiPost } from "../lib/api";
import WatchCard from "../components/domain/WatchCard";
import WatchDetailsModal from "../components/domain/WatchDetailsModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import SuccessModal from "../components/ui/SuccessModal";
import {
  PlusIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  BanknotesIcon,
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
  const [balanceLux, setBalanceLux] = useState("-");

  const [pendingCredits, setPendingCredits] = useState("0");

  const [inventory, setInventory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    onClose: null,
  });
  const [successModal, setSuccessModal] = useState({ isOpen: false, message: "" });

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

  const refreshInventory = async (silent = true) => {
    if (!silent) setLoadingInventory(true);
    try {
      const [myItems, activeListings] = await Promise.all([apiGet("/inventory"), getListings()]);
      const myItemsArr = Array.isArray(myItems) ? myItems : [];
      const listingsArr = Array.isArray(activeListings) ? activeListings : [];

      const normalized = myItemsArr.map((item) => {
        const marketListing = listingsArr.find((l) => String(l.tokenId) === String(item.tokenId));
        const rawPrice = marketListing ? String(marketListing.price) : String(item.price || "0");
        const isListed = !!marketListing || rawPrice !== "0";
        const priceLux = formatLuxFromWei(rawPrice);

        return {
          tokenId: String(item.tokenId),
          owner: String(item.owner || ""),
          seller: String(item.seller || ""),
          certified: Boolean(item.certified),
          priceWei: rawPrice,
          priceLux: isListed ? priceLux : null,
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

  // --- NUOVA LOGICA SOCKET ---
  useEffect(() => {
    refreshBalance(true);
    refreshInventory(true);

    const socket = io("http://localhost:3001");

    socket.on("market-update", (data) => {
      console.log("⚡ EVENTO PER ME-PAGE:", data);
      refreshBalance(true);
      refreshInventory(true);
    });

    return () => socket.disconnect();
  }, []);


  const handleManualBalance = () => refreshBalance(false);
  const handleManualInventory = () => refreshInventory(false);
  
  const openDetails = (item) => {
    setSelected(item);
    setOpen(true);
  };

  const ensureMarketApproval = async () => {
    try {
      const { isApproved } = await apiGet("/market/approval-status");
      if (isApproved) return true;

      return await new Promise((resolve) => {
        const finish = (val) => {
          setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null, onClose: null });
          resolve(val);
        };

        setConfirmModal({
          isOpen: true,
          title: "Autorizzazione Necessaria",
          message: "Per mettere in vendita i tuoi orologi, devi autorizzare il Marketplace a gestire i tuoi NFT. Questa operazione va fatta solo una volta. Vuoi procedere?",
          onConfirm: async () => {
            try {
              setBusy(true);
              await apiPost("/market/approve-market");
              setBusy(false);
              finish(true);
            } catch (err) {
              setBusy(false);
              alert("Errore approvazione: " + (err?.response?.data?.error || err.message));
              finish(false);
            }
          },
          onClose: () => {
            setBusy(false);
            finish(false);
          },
        });
      });
    } catch (e) {
      console.error("Errore controllo approvazione:", e);
      setBusy(false);
      return false;
    }
  };

  // --- AZIONI ---
  const performMint = async () => {
    setBusy(true);
    try {
      await mintWatch();
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      setSuccessModal({ isOpen: true, message: "Orologio creato con successo!" });
    } catch (e) {
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      alert("Errore Mint: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const performCertify = async (item) => {
    setBusy(true);
    try {
      await certify(item.tokenId);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      setSuccessModal({ isOpen: true, message: `Orologio #${item.tokenId} certificato!` });
      setOpen(false);
    } catch (e) {
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      alert("Errore Certificazione: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const performList = async (item, price) => {
    try {
      const approved = await ensureMarketApproval();
      if (!approved) {
        setBusy(false);
        return;
      }

      setBusy(true);
      if (item.priceLux) {
        await cancelListing(item.tokenId);
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (role === "producer") {
        await listPrimary(item.tokenId, price);
      } else {
        await listSecondary(item.tokenId, price);
      }

      setConfirmModal((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
      setSuccessModal({ isOpen: true, message: "Listato con successo!" });
      setOpen(false);
    } catch (e) {
      setConfirmModal((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
      alert("Errore Listing: " + (e?.response?.data?.error || e.message));
    } finally {
      setBusy(false);
    }
  };

  const performCancel = async (item) => {
    setBusy(true);
    try {
      await cancelListing(item.tokenId);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      setSuccessModal({ isOpen: true, message: "Listing cancellato." });
      setOpen(false);
    } catch (e) {
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      alert("Errore: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const performWithdraw = async () => {
    setBusy(true);
    try {
      await withdrawCredits();
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      setSuccessModal({ isOpen: true, message: "Crediti prelevati con successo!" });
    } catch (e) {
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      alert("Errore Prelievo: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // --- HANDLERS ---
  const handleMintClick = () => {
    setConfirmModal({
      isOpen: true,
      title: "Atelier Produzione",
      message: "Vuoi creare (Mint) un nuovo Orologio grezzo?",
      onConfirm: performMint,
      onClose: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
    });
  };

  const handleCertifyClick = (item) => {
    setConfirmModal({
      isOpen: true,
      title: "Certificazione",
      message: `Vuoi emettere il Certificato di Autenticità per l'orologio #${item.tokenId}?`,
      onConfirm: () => performCertify(item),
      onClose: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
    });
  };

  const handleListClick = (item, price) => {
    if (!price || Number(price) <= 0) return alert("Inserisci un prezzo valido");
    const marketName = role === "producer" ? "Mercato Primario" : "Mercato Secondario";
    setConfirmModal({
      isOpen: true,
      title: "Pubblicazione",
      message: `Vuoi mettere in vendita l'orologio #${item.tokenId} sul ${marketName} a ${price} LUX?`,
      onConfirm: () => performList(item, price),
      onClose: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
    });
  };

  const handleCancelClick = (item) => {
    setConfirmModal({
      isOpen: true,
      title: "Ritiro Orologio",
      message: `Ritirare l'orologio #${item.tokenId} dalla vendita?`,
      onConfirm: () => performCancel(item),
      onClose: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
    });
  };

  const handleWithdrawClick = () => {
    setConfirmModal({
      isOpen: true,
      title: "Incasso Crediti",
      message: `Vuoi trasferire ${pendingCredits} LUX dal Marketplace al tuo Wallet?`,
      onConfirm: performWithdraw,
      onClose: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
    });
  };

  return (
    <AppShell title="WatchDApp" address={address} balanceLux={balanceLux}>
      <div className="space-y-12">
        {role === "producer" && (
          <div className="relative bg-[#4A0404] text-[#FDFBF7] rounded-3xl p-8 shadow-xl overflow-hidden border border-[#5e0a0a]">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2 text-[#D4AF37]">
                  <WrenchScrewdriverIcon className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Producer Mode</span>
                </div>
                <h2 className="text-3xl font-serif font-bold">Atelier di Produzione</h2>
                <p className="text-red-100/70 mt-1">Conia nuovi orologi da immettere nel mercato.</p>
              </div>
              <button
                onClick={handleMintClick}
                disabled={busy}
                className="px-6 py-3 bg-[#D4AF37] hover:bg-[#c49f27] text-[#4A0404] font-bold rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                {busy ? "Working..." : <><PlusIcon className="h-5 w-5" /> Mint New Watch</>}
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-12 items-start">
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-3xl bg-[#4A0404] text-[#FDFBF7] p-8 shadow-xl sticky top-28 border border-[#5e0a0a]">
              <div className="text-3xl font-serif font-bold tracking-wide mb-6">Il tuo Profilo</div>
              <div className="space-y-4 text-sm">
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="text-red-200/80 text-xs uppercase tracking-wider font-bold mb-1">Ruolo</div>
                  <div className="text-white font-mono text-lg font-bold capitalize">{role}</div>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="text-red-200/80 text-xs uppercase tracking-wider font-bold mb-1">Indirizzo</div>
                  <div className="font-mono text-zinc-300 break-all text-xs">{address}</div>
                </div>
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="text-red-200/80 text-xs uppercase tracking-wider font-bold mb-1">Saldo Wallet</div>
                  <div className="text-[#D4AF37] text-2xl font-bold">{balanceLux} LUX</div>
                </div>

                {pendingCredits !== "0" && (
                  <div className="bg-[#1A472A]/40 p-4 rounded-xl border border-[#D4AF37]/50 animate-pulse">
                    <div className="text-[#D4AF37] text-xs uppercase tracking-wider font-bold mb-1 flex items-center gap-1">
                      <BanknotesIcon className="h-4 w-4" /> Vendite da Incassare
                    </div>
                    <div className="text-white text-xl font-bold mb-3">{pendingCredits} LUX</div>
                    <button
                      onClick={handleWithdrawClick}
                      disabled={busy}
                      className="w-full py-2 bg-[#D4AF37] hover:bg-[#c49f27] text-[#4A0404] font-bold rounded-lg text-xs uppercase tracking-wide shadow-md"
                    >
                      Preleva Ora
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleManualBalance}
                  disabled={loadingBalance}
                  className="flex-1 flex justify-center items-center gap-2 text-xs px-4 py-3 rounded-xl border-2 border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#4A0404] transition font-bold uppercase tracking-wide disabled:opacity-50 shadow-lg shadow-black/20"
                >
                  {loadingBalance && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  {loadingBalance ? "Aggiornamento..." : "Aggiorna Saldo"}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-end justify-between gap-3 border-b border-[#4A0404]/10 pb-4">
              <div>
                <div className="text-[#4A0404] text-3xl font-serif font-bold">
                  {role === "producer" ? "Vault Produzione" : "La tua Collezione"}
                </div>
                <div className="text-[#4A0404]/60 text-sm mt-1">
                  {role === "producer" ? "Gestisci gli orologi coniati." : "I tuoi orologi."}
                </div>
              </div>
              <button
                onClick={handleManualInventory}
                disabled={loadingInventory}
                className="flex items-center gap-2 text-sm px-5 py-2.5 bg-white text-[#4A0404] font-bold rounded-xl shadow-md hover:shadow-xl hover:bg-[#4A0404] hover:text-white transition-all duration-300 disabled:opacity-50 border border-[#4A0404]/5"
              >
                {loadingInventory && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                {loadingInventory ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {inventory.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-[#4A0404]/20 bg-[#FDFBF7] p-12 text-center text-[#4A0404]/50 font-serif italic text-lg">
                Nessun orologio trovato.
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {inventory.map((it) => (
                  <WatchCard key={it.tokenId} item={it} onOpen={openDetails} variant="inventory" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <WatchDetailsModal
        open={open}
        onClose={() => setOpen(false)}
        item={selected}
        role={role}
        onList={handleListClick}
        onCancel={handleCancelClick}
        onCertify={handleCertifyClick}
        busy={busy}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={confirmModal.onClose || (() => setConfirmModal((prev) => ({ ...prev, isOpen: false, onConfirm: null, onClose: null })))}
        busy={busy}
      />

      <SuccessModal
        isOpen={successModal.isOpen}
        message={successModal.message}
        onClose={() => setSuccessModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </AppShell>
  );
}