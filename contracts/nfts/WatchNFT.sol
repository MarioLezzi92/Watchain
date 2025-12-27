// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WatchNFT is ERC721, Ownable {
    uint256 public nextId;

    /// @dev produttore: fisso, non modificabile (meno endpoint + più sicurezza)
    address public immutable factory;

    /// @dev venditori autorizzati a certificare
    mapping(address => bool) public reseller;

    /// @dev stato certificazione del singolo orologio
    mapping(uint256 => bool) public certified;

    event ResellerSet(address indexed reseller, bool enabled);
    event Manufactured(uint256 indexed tokenId, address indexed to);
    event Certified(uint256 indexed tokenId, address indexed by);

    constructor(address factory_) ERC721("Watch", "WCH") Ownable(msg.sender) {
        require(factory_ != address(0), "factory=0");
        factory = factory_;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "not factory");
        _;
    }

    modifier onlyReseller() {
        require(reseller[msg.sender], "not reseller");
        _;
    }

    /// @notice abilita/disabilita un reseller (admin)
    function setReseller(address who, bool enabled) external onlyOwner {
        require(who != address(0), "reseller=0");
        reseller[who] = enabled;
        emit ResellerSet(who, enabled);
    }

    /// @notice PRODUCER: fabbrica (mint) un nuovo orologio
    function manufacture(address to) external onlyFactory returns (uint256 tokenId) {
        require(to != address(0), "to=0");
        tokenId = ++nextId;
        _safeMint(to, tokenId);
        emit Manufactured(tokenId, to);
    }

    /// @notice RESELLER: certifica un orologio (solo se lo possiede)
    function certify(uint256 tokenId) external onlyReseller {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(!certified[tokenId], "already certified");
        certified[tokenId] = true;
        emit Certified(tokenId, msg.sender);
    }
}
