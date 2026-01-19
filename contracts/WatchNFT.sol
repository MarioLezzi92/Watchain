// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./security/EmergencyStop.sol";

contract WatchNFT is ERC721, Ownable, EmergencyStop {
    uint256 public nextId;
    address public immutable factory;

    // Mapping per i ruoli
    mapping(address => bool) public reseller;
    
   
    mapping(address => bool) public knownReseller; 

    // FIX FIREFLY: Usiamo private + funzione manuale per evitare l'errore FF10304
    mapping(uint256 => bool) private _certified;

    event ResellerEnabled(address indexed who);
    event ResellerDisabled(address indexed who);
    event Manufactured(uint256 indexed tokenId, address indexed to);
    event Certified(uint256 indexed tokenId, address indexed by);

    constructor(address factory_) ERC721("WatchNFT", "WATCH") Ownable(msg.sender) {
        require(factory_ != address(0), "factory=0");
        factory = factory_;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only Producer can do this");
        _;
    }

    modifier onlyReseller() {
        require(reseller[msg.sender], "Only Active Reseller can do this");
        _;
    }

    function setEmergencyStop(bool status) external onlyOwner {
        if (status) _pause(); else _unpause();
    }

    function setReseller(address who, bool enabled) external onlyOwner {
        require(who != address(0), "reseller=0");
        reseller[who] = enabled; 
        
        // Logica KnownReseller (serve al Market per non bloccare gli ex-reseller)
        if (enabled) {
            knownReseller[who] = true;
            emit ResellerEnabled(who);
        } else {
            emit ResellerDisabled(who);
        }
    }

    function manufacture(address to) external onlyFactory whenNotPaused returns (uint256 tokenId) {
        require(to != address(0), "to=0");
        tokenId = ++nextId;
        _safeMint(to, tokenId);
        emit Manufactured(tokenId, to);
    }

    // FIX FIREFLY: Funzione manuale con nome argomento ESPLICITO
    // Questo risolve l'errore "Missing required input argument"
    function certified(uint256 tokenId) external view returns (bool) {
        return _certified[tokenId];
    }

    function certify(uint256 tokenId) external onlyReseller whenNotPaused {
        require(ownerOf(tokenId) == msg.sender, "Must own watch to certify");
        
        // Usiamo la variabile privata interna
        require(!_certified[tokenId], "Already certified");
        
        _certified[tokenId] = true;
        emit Certified(tokenId, msg.sender);
    }
}