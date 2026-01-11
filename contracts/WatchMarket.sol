// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./security/EmergencyStop.sol";
import "./security/PullPayments.sol";

// Interfaccia minima per leggere direttamente dal contratto NFT
interface IWatchNFT is IERC721 {
    function certified(uint256 tokenId) external view returns (bool);
    function reseller(address who) external view returns (bool);
    function factory() external view returns (address);
}

// Marketplace sicuro: gestisce la compravendita di orologi
// Eredita PullPayments  
contract WatchMarket is Ownable, ReentrancyGuard, EmergencyStop, PullPayments {
    using SafeERC20 for IERC20;
    using Address for address payable;

    // prima vendita e rivendita
    enum SaleType {
        PRIMARY,    // Producer -> Reseller
        SECONDARY   // Reseller -> Consumer
    }

    struct Listing {
        address seller;
        uint256 price;
        SaleType saleType;
    }

    IWatchNFT public immutable watch;

    // ID orologio -> dettagli vendita
    mapping(uint256 => Listing) public listings;

    // EVENTI
    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price, SaleType saleType);
    event Canceled(uint256 indexed tokenId, address indexed seller);
    event Purchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, SaleType saleType);
    event CreditsWithdrawn(address indexed payee, uint256 amount);


    // collega il market al token di pagamento e alla collezione NFT
    constructor(IERC20 paymentToken_, address watchNftAddress_) 
        Ownable(msg.sender) 
        PullPayments(paymentToken_) 
    {
        require(watchNftAddress_ != address(0), "Invalid NFT address");
        watch = IWatchNFT(watchNftAddress_);
    }

    // --- Gestione Emergenza ---

    // Abilita/disabilita il mercato in caso di bug/attacchi
    function setEmergencyStop(bool status) external onlyOwner {
        if (status) {
            _pause(); // Blocca: listPrimary, listSecondary, buy, cancelListing, withdraw
        } else {
            _unpause(); // Riapre tutte le funzionalità
        }
    }

    // --- Listing Functions ---

    // Mercato primario: solo il Producer (factory) può listare 
    function listPrimary(uint256 tokenId, uint256 price) external nonReentrant whenNotPaused {
        require(price > 0, "Price must be > 0");
        require(watch.ownerOf(tokenId) == msg.sender, "Not owner");
        require(msg.sender == watch.factory(), "Solo il Producer può listare");

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            saleType: SaleType.PRIMARY
        });

        emit Listed(tokenId, msg.sender, price, SaleType.PRIMARY);
    }

    // Mercato secondario: solo i Reseller possono listare 
    function listSecondary(uint256 tokenId, uint256 price) external nonReentrant whenNotPaused {
        require(price > 0, "Price must be > 0");
        require(watch.ownerOf(tokenId) == msg.sender, "Not owner");
        // Verifica che sia un Reseller autorizzato
        require(watch.reseller(msg.sender), "Solo i Reseller autorizzati possono listare");

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            saleType: SaleType.SECONDARY
        });

        emit Listed(tokenId, msg.sender, price, SaleType.SECONDARY);
    }

    // Rimuove un orologio dal mercato
    function cancelListing(uint256 tokenId) external nonReentrant whenNotPaused {
        Listing memory l = listings[tokenId];
        require(l.seller == msg.sender, "Not seller");
        
        delete listings[tokenId];
        emit Canceled(tokenId, msg.sender);
    }

    // --- Funzioni di Acquisto ---

    function buy(uint256 tokenId) external nonReentrant whenNotPaused {
        Listing memory l = listings[tokenId];
        
        // 1. Controlli
        require(l.seller != address(0), "Item non listato");
        require(l.price > 0, "Prezzo non definito");
        require(msg.sender != l.seller, "Il venditore non può comprare i suoi item");

        // 2. Aggiornamento stato
        delete listings[tokenId]; // rimuove listings per evitare acquisti doppi
        
        // Accumula credio per il venditore, non invia subito soldi -> PullPayment
        _accrueCredit(l.seller, l.price); 

        // 3. Interazioni esterne
        // Preleva i soldi dal compratore verso il contratto market
        paymentToken.safeTransferFrom(msg.sender, address(this), l.price);
        
        //Sposta NFT dal venditore al compratore
        watch.safeTransferFrom(l.seller, msg.sender, tokenId);

        emit Purchased(tokenId, msg.sender, l.seller, l.price, l.saleType);
    }


    // --- Withdrawal (PullPayments) ---

    // permette ai venditori di prelevare LUX guadagnati dalle vendite
    function withdraw() external nonReentrant whenNotPaused returns (uint256 amount) {
        amount = _withdrawCredit(msg.sender);
        emit CreditsWithdrawn(msg.sender, amount);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }
}