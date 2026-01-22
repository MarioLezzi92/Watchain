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
import "./WatchNFT.sol"; 

contract WatchMarket is Ownable, ReentrancyGuard, EmergencyStop, PullPayments {
    using SafeERC20 for IERC20;
    using Address for address payable;

    enum SaleType { PRIMARY, SECONDARY }

    struct Listing {
        address seller;
        uint256 price;
        SaleType saleType;
    }

    
    WatchNFT public immutable watch; 

    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price, SaleType saleType);
    event Canceled(uint256 indexed tokenId, address indexed seller);
    event Purchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, SaleType saleType);
    event CreditsWithdrawn(address indexed payee, uint256 amount);

    constructor(IERC20 paymentToken_, address watchNftAddress_)
        Ownable(msg.sender)
        PullPayments(paymentToken_)
    {
        require(address(paymentToken_) != address(0), "Invalid payment token");
        require(watchNftAddress_ != address(0), "Invalid NFT address");
        watch = WatchNFT(watchNftAddress_); // Casting al contratto concreto
    }


    // --- Helpers ---
    function _requireMarketApproved(address owner, uint256 tokenId) internal view {
        bool ok = (watch.getApproved(tokenId) == address(this)) ||
                  (watch.isApprovedForAll(owner, address(this)));
        require(ok, "Market not approved for NFT");
    }

    function _isConsumer(address who) internal view returns (bool) {
        if (who == watch.factory()) return false;
        
        // LOGICA CORRETTA (Fix del buco di sicurezza):
        // Se 'knownReseller' è true, significa che è (o è stato) un business.
        // Quindi NON è un consumatore, anche se attualmente disabilitato.
        if (watch.knownReseller(who)) return false; 
        
        return true;
    }

    // --- GESTIONE EMERGENZA (AGGIUNTA MANCANTE) ---
    // Questa funzione espone le funzioni internal di EmergencyStop.sol
    function setEmergencyStop(bool status) external onlyOwner {
        if (status) {
            _pause(); 
        } else {
            _unpause(); 
        }
    }

    // --- Listing Functions ---

    function listPrimary(uint256 tokenId, uint256 price) external nonReentrant whenNotPaused {
        require(price > 0, "Price > 0");
        require(watch.ownerOf(tokenId) == msg.sender, "Not owner");
        require(msg.sender == watch.factory(), "Only Producer can list primary");
        
        _requireMarketApproved(msg.sender, tokenId);
        
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            saleType: SaleType.PRIMARY
        });
        emit Listed(tokenId, msg.sender, price, SaleType.PRIMARY);
    }

    function listSecondary(uint256 tokenId, uint256 price) external nonReentrant whenNotPaused {
        require(price > 0, "Price > 0");
        require(watch.ownerOf(tokenId) == msg.sender, "Not owner");

        // CHECK: Solo Reseller ATTIVI possono listare
        // Se è disabilitato, reseller[msg.sender] è false e questo fallisce.
        require(watch.reseller(msg.sender), "Only Active Reseller can list");

        require(watch.certified(tokenId), "Only certified watches");
        _requireMarketApproved(msg.sender, tokenId);

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            saleType: SaleType.SECONDARY
        });
        emit Listed(tokenId, msg.sender, price, SaleType.SECONDARY);
    }

    function cancelListing(uint256 tokenId) external nonReentrant whenNotPaused {
        Listing memory l = listings[tokenId];
        require(l.seller == msg.sender, "Not seller");
        delete listings[tokenId];
        emit Canceled(tokenId, msg.sender);
    }

    // --- Funzioni di Acquisto ---

    function buy(uint256 tokenId) external nonReentrant whenNotPaused {
        Listing memory l = listings[tokenId];
        
        require(l.seller != address(0), "Item not listed");
        require(msg.sender != l.seller, "Seller cannot buy own item");
        require(watch.ownerOf(tokenId) == l.seller, "Seller not owner anymore");
        _requireMarketApproved(l.seller, tokenId);

        if (l.saleType == SaleType.PRIMARY) {
            // Primary: Consenti acquisto se è un Business Conosciuto (Active o Disabled)
            require(watch.knownReseller(msg.sender), "Only resellers can buy primary");
            require(l.seller == watch.factory(), "Primary seller must be producer");
        } else {
            // Secondary: Solo Consumer (knownReseller deve essere FALSE)
            require(watch.certified(tokenId), "Watch not certified");
            require(_isConsumer(msg.sender), "Only consumer can buy secondary");
        }

        delete listings[tokenId];
        paymentToken.safeTransferFrom(msg.sender, address(this), l.price);
        _accrueCredit(l.seller, l.price);
        watch.safeTransferFrom(l.seller, msg.sender, tokenId);

        emit Purchased(tokenId, msg.sender, l.seller, l.price, l.saleType);
    }

    // --- Withdrawal ---
    function withdraw() external nonReentrant returns (uint256 amount) {
        amount = _withdrawCredit(msg.sender);
        emit CreditsWithdrawn(msg.sender, amount);
    }
}