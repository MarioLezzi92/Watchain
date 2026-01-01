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

// Interfaccia minima per interagire con WatchNFT
interface IWatchNFT is IERC721 {
    function certified(uint256 tokenId) external view returns (bool);
    function reseller(address who) external view returns (bool);
    function factory() external view returns (address);
}

/// @title WatchMarket
/// @notice Marketplace sicuro con pattern Checks-Effects-Interactions
contract WatchMarket is Ownable, ReentrancyGuard, EmergencyStop, PullPayments {
    using SafeERC20 for IERC20;
    using Address for address payable;

    enum SaleType {
        PRIMARY,    // Producer -> Reseller
        SECONDARY   // Reseller -> Consumer
    }

    struct Listing {
        address seller;
        uint256 price;
        SaleType saleType;
    }

    // Questa variabile memorizza l'indirizzo del contratto NFT.
    IWatchNFT public immutable watch;
    // -------------------------------------

    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price, SaleType saleType);
    event Canceled(uint256 indexed tokenId, address indexed seller);
    event Purchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, SaleType saleType);
    event CreditsWithdrawn(address indexed payee, uint256 amount);

    constructor(IERC20 paymentToken_, address watchNftAddress_) 
        Ownable(msg.sender) 
        PullPayments(paymentToken_) 
    {
        require(watchNftAddress_ != address(0), "Invalid NFT address");
        watch = IWatchNFT(watchNftAddress_);
    }

    // ------------------------
    // Listing Functions
    // ------------------------

    function listPrimary(uint256 tokenId, uint256 price) external nonReentrant whenNotPaused {
        require(price > 0, "Price must be > 0");
        // Verifica che chi chiama sia il proprietario dell'NFT
        require(watch.ownerOf(tokenId) == msg.sender, "Not owner");
        // Verifica che sia il Producer (Factory)
        require(msg.sender == watch.factory(), "Only Producer can list Primary");

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            saleType: SaleType.PRIMARY
        });

        emit Listed(tokenId, msg.sender, price, SaleType.PRIMARY);
    }

    function listSecondary(uint256 tokenId, uint256 price) external nonReentrant whenNotPaused {
        require(price > 0, "Price must be > 0");
        require(watch.ownerOf(tokenId) == msg.sender, "Not owner");
        // Verifica che sia un Reseller autorizzato
        require(watch.reseller(msg.sender), "Only Reseller can list Secondary");

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

    // ------------------------
    // Buy Function (SECURE)
    // ------------------------

    function buy(uint256 tokenId) external nonReentrant whenNotPaused {
        Listing memory l = listings[tokenId];
        
        // 1. CHECKS
        require(l.seller != address(0), "Item not listed");
        require(l.price > 0, "Price not set");
        require(msg.sender != l.seller, "Seller cannot buy own item");

        // 2. EFFECTS (Cruciale: aggiorniamo lo stato PRIMA di muovere fondi)
        delete listings[tokenId]; 

        // Sistema PullPayments: Accreditiamo i fondi al venditore (non glieli inviamo direttamente)
        _accrueCredit(l.seller, l.price);

        // 3. INTERACTIONS
        // Preleviamo i soldi dal compratore verso il contratto Market
        paymentToken.safeTransferFrom(msg.sender, address(this), l.price);

        // Trasferiamo l'NFT dal venditore al compratore
        // Nota: Il venditore deve aver approvato il Market per questo token
        watch.safeTransferFrom(l.seller, msg.sender, tokenId);

        emit Purchased(tokenId, msg.sender, l.seller, l.price, l.saleType);
    }

    // ------------------------
    // Withdrawal (PullPayments)
    // ------------------------

    function withdraw() external nonReentrant whenNotPaused returns (uint256 amount) {
        amount = _withdrawCredit(msg.sender);
        emit CreditsWithdrawn(msg.sender, amount);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    // ------------------------
    // Emergency Recover
    // ------------------------
    
    // Recupera ETH inviati per errore (non dovrebbe averne, usa ERC20)
    function recoverETH(address payable to, uint256 amount) external onlyOwner whenPaused {
        require(to != address(0), "Invalid address");
        to.sendValue(amount);
    }

    // Recupera token ERC20 inviati per errore (diversi dal token di pagamento)
    function recoverERC20(address token, address to, uint256 amount) external onlyOwner whenPaused {
        require(token != address(paymentToken), "Cannot recover payment token");
        IERC20(token).safeTransfer(to, amount);
    }
}