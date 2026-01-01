// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./security/EmergencyStop.sol";

contract WatchNFT is ERC721, Ownable, EmergencyStop {
    uint256 public nextId;

    /// @dev produttore: fisso, non modificabile per sicurezza
    address public immutable factory;

    /// @dev venditori autorizzati a certificare
    mapping(address => bool) public reseller;

    /// @notice tokenId -> certificato
    mapping(uint256 => bool) public certified;

    event ResellerSet(address indexed who, bool enabled);
    event Manufactured(uint256 indexed tokenId, address indexed to);
    event Certified(uint256 indexed tokenId, address indexed by);

    constructor(address factory_) ERC721("WatchNFT", "WATCH") Ownable(msg.sender) {
        require(factory_ != address(0), "factory=0");
        factory = factory_;
    }

    // ------------------------
    // Access control
    // ------------------------

    modifier onlyFactory() {
        require(msg.sender == factory, "only factory");
        _;
    }

    modifier onlyReseller() {
        require(reseller[msg.sender], "only reseller");
        _;
    }

    // ------------------------
    // Admin
    // ------------------------

    function setReseller(address who, bool enabled) external onlyOwner {
        require(who != address(0), "reseller=0");
        reseller[who] = enabled;
        emit ResellerSet(who, enabled);
    }

    // ------------------------
    // Core logic
    // ------------------------

    /// @notice PRODUCER: fabbrica (mint) un nuovo orologio
    function manufacture(address to) external onlyFactory whenNotPaused returns (uint256 tokenId) {
        require(to != address(0), "to=0");
        tokenId = ++nextId;
        _safeMint(to, tokenId);
        emit Manufactured(tokenId, to);
    }

    /// @notice RESELLER: certifica un orologio (solo se lo possiede e se è rivenditore)
    function certify(uint256 tokenId) external onlyReseller whenNotPaused {
        require(ownerOf(tokenId) == msg.sender, "Must own watch to certify");
        require(!certified[tokenId], "Already certified");
        
        certified[tokenId] = true;
        emit Certified(tokenId, msg.sender);
    }

    // ------------------------
    // Gas Optimization (Memory Array Building)
    // ------------------------

    /// @notice Restituisce tutti i Token ID posseduti da un indirizzo
    /// @dev Implementa il pattern 'Memory Array Building' per evitare loop costosi off-chain
    function getItemsByOwner(address _owner) external view returns (uint256[] memory) {
        uint256 totalItems = nextId; 
        uint256 count = 0;

        // Fase 1: Conta quanti oggetti possiede l'utente
        for (uint256 i = 1; i <= totalItems; i++) {
            // Se supporti il burning, dovresti controllare _exists(i) qui
            // ownerOf lancia revert se il token non esiste, quindi in uno scenario senza burn è ok.
            // In uno scenario con burn, usa try/catch o _ownerOf (se interna).
            try this.ownerOf(i) returns (address owner) {
                if (owner == _owner) {
                    count++;
                }
            } catch {
                // Token bruciato o non esistente, ignora
            }
        }

        // Fase 2: Crea l'array in memoria
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;

        // Fase 3: Popola l'array
        for (uint256 i = 1; i <= totalItems; i++) {
            try this.ownerOf(i) returns (address owner) {
                if (owner == _owner) {
                    result[index] = i;
                    index++;
                }
            } catch {
                continue;
            }
        }

        return result;
    }
}