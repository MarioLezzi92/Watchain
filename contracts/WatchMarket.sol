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

interface IWatchNFT is IERC721 {
    function certified(uint256 tokenId) external view returns (bool);
    function reseller(address who) external view returns (bool);
    function factory() external view returns (address);
}

/// @title WatchMarket
/// @notice Marketplace with:
/// - Access Restriction
/// - CEI + ReentrancyGuard
/// - Emergency Stop
/// - Pull-over-Push (withdrawal pattern)
/// - Secure Ether handling (reject ETH + emergency recover)
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
        bool exists;
    }

    IWatchNFT public immutable watch;

    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price, SaleType saleType);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller, SaleType saleType);
    event Purchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, SaleType saleType);

    event CreditsWithdrawn(address indexed seller, uint256 amount);

    constructor(address coin_, address watch_) Ownable(msg.sender) PullPayments(IERC20(coin_)) {
        require(coin_ != address(0), "coin=0");
        require(watch_ != address(0), "watch=0");
        watch = IWatchNFT(watch_);
    }

    // ------------------------
    // Listings
    // ------------------------

    function listPrimary(uint256 tokenId, uint256 price) external whenNotPaused {
        require(price > 0, "price=0");
        require(watch.ownerOf(tokenId) == msg.sender, "not owner");
        require(msg.sender == watch.factory(), "only producer");
        require(!listings[tokenId].exists, "already listed");

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            saleType: SaleType.PRIMARY,
            exists: true
        });

        emit Listed(tokenId, msg.sender, price, SaleType.PRIMARY);
    }

    function listSecondary(uint256 tokenId, uint256 price) external whenNotPaused {
        require(price > 0, "price=0");
        require(watch.ownerOf(tokenId) == msg.sender, "not owner");
        require(watch.certified(tokenId), "not certified");
        require(watch.reseller(msg.sender), "buyer not reseller");
        require(!listings[tokenId].exists, "already listed");

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            saleType: SaleType.SECONDARY,
            exists: true
        });

        emit Listed(tokenId, msg.sender, price, SaleType.SECONDARY);
    }

    function cancelListing(uint256 tokenId) external whenNotPaused {
        Listing memory l = listings[tokenId];
        require(l.exists, "not listed");
        require(l.seller == msg.sender, "not seller");

        delete listings[tokenId];
        emit ListingCancelled(tokenId, msg.sender, l.saleType);
    }

    // ------------------------
    // Buy
    // ------------------------

    function buy(uint256 tokenId) external nonReentrant whenNotPaused {
        Listing memory l = listings[tokenId];
        require(l.exists, "not listed");
        require(msg.sender != l.seller, "self buy");

        // Access restriction by sale type
        if (l.saleType == SaleType.PRIMARY) {
            require(watch.reseller(msg.sender), "buyer not reseller");
        } else {
            // SECONDARY: buyer can be anyone (typically consumer), but seller must be reseller
            require(watch.reseller(l.seller), "seller not reseller");
        }

        // Effects
        delete listings[tokenId];

        // Interactions (CEI): move funds to credits, transfer NFT
        // NOTE: PullPayments avoids push-payments DoS
        paymentToken.safeTransferFrom(msg.sender, address(this), l.price);
        _credit(l.seller, l.price);

        // Transfer NFT
        watch.safeTransferFrom(l.seller, msg.sender, tokenId);

        emit Purchased(tokenId, msg.sender, l.seller, l.price, l.saleType);
    }

    // ------------------------
    // Withdraw (PullPayments)
    // ------------------------

    function withdraw() external nonReentrant whenNotPaused returns (uint256 amount) {
        amount = _withdrawCredit(msg.sender);
        emit CreditsWithdrawn(msg.sender, amount);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    // ------------------------
    // Secure Ether handling
    // ------------------------
    receive() external payable {
        revert("no ETH");
    }

    fallback() external payable {
        revert("no ETH");
    }

    /// @notice Recover ETH that could be forced into this contract (e.g. selfdestruct).
    function recoverETH(address payable to, uint256 amount) external onlyOwner whenPaused {
        require(to != address(0), "to=0");
        to.sendValue(amount);
    }

    /// @notice Recover arbitrary ERC20 sent by mistake (NOT the payment token).
    function recoverERC20(address token, address to, uint256 amount) external onlyOwner whenPaused {
        require(token != address(paymentToken), "no recover paymentToken");
        require(to != address(0), "to=0");
        IERC20(token).safeTransfer(to, amount);
    }
}
