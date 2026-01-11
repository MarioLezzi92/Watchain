// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./security/EmergencyStop.sol";

contract WatchNFT is ERC721, Ownable, EmergencyStop {
    uint256 public nextId;

    // produttore: fisso, non modificabile per sicurezza
    address public immutable factory;

    // venditori autorizzati a certificare
    mapping(address => bool) public reseller;

    // Stato certificazione per ogni orologio tokenId -> certificato
    mapping(uint256 => bool) public certified;

    // EVENTI 
    event ResellerEnabled(address indexed who);
    event ResellerDisabled(address indexed who);
    event Manufactured(uint256 indexed tokenId, address indexed to);
    event Certified(uint256 indexed tokenId, address indexed by);

    constructor(address factory_) ERC721("WatchNFT", "WATCH") Ownable(msg.sender) {
        require(factory_ != address(0), "factory=0");
        factory = factory_;
    }

    // --- Access control ---

    modifier onlyFactory() {
        require(msg.sender == factory, "Solo il Producer può eseguire questa azione");
        _;
    }

    modifier onlyReseller() {
        require(reseller[msg.sender], "Solo un Reseller attivo può eseguire questa azione");
        _;
    }

    // --- Gestione emergenza ---

    // Permette di congelare le operazioni critiche in caso di bug/attacchi
    function setEmergencyStop(bool status) external onlyOwner {
        if (status) {
            _pause(); // Blocca: manufacture, certify
        } else {
            _unpause(); // Riapre le operazioni
        }
    }

    // --- Gestione ruoli ---

    // Abilita/Disabilita Reseller
    function setReseller(address who, bool enabled) external onlyOwner {
        require(who != address(0), "reseller=0");
        reseller[who] = enabled;
        
        // Emissione evento specifico in base all'azione
        if (enabled) {
            emit ResellerEnabled(who);
        } else {
            emit ResellerDisabled(who);
        }
    }

    // --- Logica Principale ---

    // PRODUCER: crea un nuovo orologio
    function manufacture(address to) external onlyFactory whenNotPaused returns (uint256 tokenId) {
        require(to != address(0), "to=0");
        tokenId = ++nextId;
        _safeMint(to, tokenId);
        emit Manufactured(tokenId, to);
    }

    // RESELLER: certifica un orologio (solo se lo possiede e se è Reseller)
    function certify(uint256 tokenId) external onlyReseller whenNotPaused {
        require(ownerOf(tokenId) == msg.sender, "Must own watch to certify");
        require(!certified[tokenId], "Already certified");
        
        certified[tokenId] = true;
        emit Certified(tokenId, msg.sender);
    }
}