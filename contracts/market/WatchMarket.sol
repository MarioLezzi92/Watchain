// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IWatchNFT is IERC721 {
    function certified(uint256 tokenId) external view returns (bool);
    function reseller(address who) external view returns (bool);
    function factory() external view returns (address);
}

contract WatchMarket is ReentrancyGuard {
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

    IERC20 public immutable coin;
    IWatchNFT public immutable watch;

    mapping(uint256 => Listing) public listings;

    event Listed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        SaleType saleType
    );

    event Purchased(
        uint256 indexed tokenId,
        address indexed buyer,
        address indexed seller,
        uint256 price,
        SaleType saleType
    );

    constructor(address coin_, address watch_) {
        coin = IERC20(coin_);
        watch = IWatchNFT(watch_);
    }

    function listPrimary(uint256 tokenId, uint256 price) external {
        require(price > 0, "price=0");
        require(msg.sender == watch.factory(), "not factory");
        require(watch.ownerOf(tokenId) == msg.sender, "not owner");

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            saleType: SaleType.PRIMARY,
            exists: true
        });

        emit Listed(tokenId, msg.sender, price, SaleType.PRIMARY);
    }

    function listSecondary(uint256 tokenId, uint256 price) external {
        require(price > 0, "price=0");
        require(watch.reseller(msg.sender), "not reseller");
        require(watch.ownerOf(tokenId) == msg.sender, "not owner");
        require(watch.certified(tokenId), "not certified");

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            saleType: SaleType.SECONDARY,
            exists: true
        });

        emit Listed(tokenId, msg.sender, price, SaleType.SECONDARY);
    }

    function buy(uint256 tokenId) external nonReentrant {
        Listing memory l = listings[tokenId];
        require(l.exists, "not listed");

        if (l.saleType == SaleType.PRIMARY) {
            require(watch.reseller(msg.sender), "buyer not reseller");
        }

        delete listings[tokenId];

        require(
            coin.transferFrom(msg.sender, l.seller, l.price),
            "coin transfer failed"
        );

        watch.transferFrom(l.seller, msg.sender, tokenId);

        emit Purchased(tokenId, msg.sender, l.seller, l.price, l.saleType);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }
}
