// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../tokens/LuxuryCoin.sol";
import "../nfts/WatchNFT.sol";

contract WatchMarket is Ownable, ReentrancyGuard {
    LuxuryCoin public immutable coin;
    WatchNFT public immutable watch;

    struct Listing {
        address seller;
        uint256 price;
        bool requireCertified;
        bool exists;
    }

    mapping(uint256 => Listing) public listings; // tokenId -> listing

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price, bool requireCertified);
    event Unlisted(uint256 indexed tokenId, address indexed seller);
    event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);

    constructor(address coin_, address watch_) Ownable(msg.sender) {
        coin = LuxuryCoin(coin_);
        watch = WatchNFT(watch_);
    }

    function list(uint256 tokenId, uint256 price, bool requireCertified) external {
        require(price > 0, "price=0");
        require(watch.ownerOf(tokenId) == msg.sender, "not owner");

        // Se è vendita "retail" (venditore -> cliente), imponi certificazione
        if (requireCertified) {
            require(watch.certified(tokenId), "not certified");
        }

        // mercato deve poter trasferire l’NFT al momento del buy
        require(
            watch.getApproved(tokenId) == address(this) || watch.isApprovedForAll(msg.sender, address(this)),
            "approve market first"
        );

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            requireCertified: requireCertified,
            exists: true
        });

        emit Listed(tokenId, msg.sender, price, requireCertified);
    }

    function cancel(uint256 tokenId) external {
        Listing memory l = listings[tokenId];
        require(l.exists, "not listed");
        require(l.seller == msg.sender, "not seller");
        delete listings[tokenId];
        emit Unlisted(tokenId, msg.sender);
    }

    function buy(uint256 tokenId) external nonReentrant {
        Listing memory l = listings[tokenId];
        require(l.exists, "not listed");
        require(msg.sender != l.seller, "cannot buy your own");
        require(watch.ownerOf(tokenId) == l.seller, "seller not owner");

        if (l.requireCertified) {
            require(watch.certified(tokenId), "not certified");
        }

        delete listings[tokenId];

        require(coin.transferFrom(msg.sender, l.seller, l.price), "pay fail");
        watch.transferFrom(l.seller, msg.sender, tokenId);

        emit Sold(tokenId, l.seller, msg.sender, l.price);
    }

}
