// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

import "./security/EmergencyStop.sol";
import "./security/PullPayments.sol";
import "./WatchNFT.sol";

contract WatchMarket is Ownable, ReentrancyGuard, EmergencyStop, PullPayments, ERC721Holder {
    using SafeERC20 for IERC20;

    enum SaleType {
        PRIMARY,
        SECONDARY
    }

    // Tight Variable Packing (1 slot):
    // - address seller: 20 bytes
    // - uint88 price: 11 bytes
    // - SaleType saleType (uint8): 1 byte
    // Totale: 32 bytes (1 storage slot)
    struct Listing {
        address seller;
        uint88 price;
        SaleType saleType;
    }

    WatchNFT public immutable watch;
    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price, SaleType saleType);
    event Canceled(uint256 indexed tokenId, address indexed seller);
    event Purchased(
        uint256 indexed tokenId,
        address indexed buyer,
        address indexed seller,
        uint256 price,
        SaleType saleType
    );
    event PriceUpdated(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice);

    constructor(IERC20 paymentToken_, address watchNftAddress_)
        Ownable(msg.sender)
        PullPayments(paymentToken_)
    {
        require(address(paymentToken_) != address(0), "Invalid payment token");
        require(watchNftAddress_ != address(0), "Invalid NFT address");
        watch = WatchNFT(watchNftAddress_);
    }

    // --- Helpers ---
    function _requireMarketApproved(address owner, uint256 tokenId) internal view {
        bool ok = (watch.getApproved(tokenId) == address(this)) ||
            (watch.isApprovedForAll(owner, address(this)));
        require(ok, "Market not approved for NFT");
    }

    function _isConsumer(address who) internal view returns (bool) {
        if (who == watch.factory()) return false;
        if (watch.knownReseller(who)) return false; // ex/attuale reseller => non consumer
        return true;
    }

    function _toPrice(uint256 price) internal pure returns (uint88) {
        require(price > 0, "Price > 0");
        require(price <= type(uint88).max, "Price too large");
        return uint88(price);
    }

    // --- Emergency Stop ---
    function setEmergencyStop(bool status) external onlyOwner {
        if (status) _pause();
        else _unpause();
    }

    // --- Listing (ESCROW) ---
    function listPrimary(uint256 tokenId, uint256 price) external nonReentrant whenNotPaused {
        uint88 p = _toPrice(price);
        require(listings[tokenId].seller == address(0), "Already listed");

        require(watch.ownerOf(tokenId) == msg.sender, "Not owner");
        require(msg.sender == watch.factory(), "Only Producer can list primary");

        _requireMarketApproved(msg.sender, tokenId);

        // ESCROW: l'NFT viene depositato nel Market
        watch.safeTransferFrom(msg.sender, address(this), tokenId);

        listings[tokenId] = Listing({ seller: msg.sender, price: p, saleType: SaleType.PRIMARY });
        emit Listed(tokenId, msg.sender, price, SaleType.PRIMARY);
    }

    function listSecondary(uint256 tokenId, uint256 price) external nonReentrant whenNotPaused {
        uint88 p = _toPrice(price);
        require(listings[tokenId].seller == address(0), "Already listed");

        require(watch.ownerOf(tokenId) == msg.sender, "Not owner");
        require(watch.reseller(msg.sender), "Only Active Reseller can list");
        require(watch.certified(tokenId), "Only certified watches");

        _requireMarketApproved(msg.sender, tokenId);

        // ESCROW: l'NFT viene depositato nel Market
        watch.safeTransferFrom(msg.sender, address(this), tokenId);

        listings[tokenId] = Listing({ seller: msg.sender, price: p, saleType: SaleType.SECONDARY });
        emit Listed(tokenId, msg.sender, price, SaleType.SECONDARY);
    }

    // Con escrow è importante poter recuperare l'NFT anche durante emergenza:
    // quindi NON blocchiamo questa funzione con whenNotPaused.
    function cancelListing(uint256 tokenId) external nonReentrant {
        Listing memory l = listings[tokenId];
        require(l.seller == msg.sender, "Not seller");

        delete listings[tokenId];

        // restituisce l'NFT al seller
        watch.safeTransferFrom(address(this), msg.sender, tokenId);

        emit Canceled(tokenId, msg.sender);
    }

    function updateListingPrice(uint256 tokenId, uint256 newPrice) external nonReentrant whenNotPaused {
        uint88 p = _toPrice(newPrice);

        Listing storage l = listings[tokenId];
        require(l.seller != address(0), "Item not listed");
        require(l.seller == msg.sender, "Not seller");

        // Freeze: se è SECONDARY e il reseller è disabilitato, non può modificare prezzo
        if (l.saleType == SaleType.SECONDARY) {
            require(watch.reseller(msg.sender), "Seller disabled");
        }

        uint256 old = uint256(l.price);
        l.price = p;

        emit PriceUpdated(tokenId, old, newPrice);
    }

    // --- Buy ---
    function buy(uint256 tokenId) external nonReentrant whenNotPaused {
        Listing memory l = listings[tokenId];

        require(l.seller != address(0), "Item not listed");
        require(msg.sender != l.seller, "Seller cannot buy own item");
        require(watch.ownerOf(tokenId) == address(this), "Not in escrow");

        if (l.saleType == SaleType.PRIMARY) {
            require(watch.knownReseller(msg.sender), "Only resellers can buy primary");
            require(l.seller == watch.factory(), "Primary seller must be producer");
        } else {
            require(watch.reseller(l.seller), "Seller disabled");
            require(watch.certified(tokenId), "Watch not certified");
            require(_isConsumer(msg.sender), "Only consumer can buy secondary");
        }

        delete listings[tokenId];

        uint256 price = uint256(l.price);
        paymentToken.safeTransferFrom(msg.sender, address(this), price);
        _accrueCredit(l.seller, price);

        watch.safeTransferFrom(address(this), msg.sender, tokenId);

        emit Purchased(tokenId, msg.sender, l.seller, price, l.saleType);
    }

    // --- Withdrawal ---
    function withdraw() external nonReentrant returns (uint256 amount) {
        return _withdrawCredit(msg.sender);
    }
}
