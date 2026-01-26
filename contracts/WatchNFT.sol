// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./security/EmergencyStop.sol";

contract WatchNFT is ERC721, Ownable, EmergencyStop {
    uint256 public nextId;
    address public immutable factory;

    // Ruoli
    mapping(address => bool) public reseller;        // attivo ora
    mapping(address => bool) public activeReseller;   
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

    modifier onlyActiveReseller() {
        require(activeReseller[msg.sender], "Only Active Reseller can do this");
        _;
    }

    function setEmergencyStop(bool status) external onlyOwner {
        if (status) _pause();
        else _unpause();
    }


    function setReseller(address who, bool enabled) external onlyOwner {
        require(who != address(0), "reseller=0");
        require(who != factory, "factory cannot be reseller");
        require(activeReseller[who] != enabled, "No state change");

        if (enabled) {
            reseller[who] = true;
            activeReseller[who] = true;
            emit ResellerEnabled(who);
        } else {
            activeReseller[who] = false;
            emit ResellerDisabled(who);
        }
    }


    //  il producer minta sempre e solo a se stesso (factory)
    function manufacture() external onlyFactory whenNotPaused returns (uint256 tokenId) {
        tokenId = ++nextId;
        _safeMint(factory, tokenId);
        emit Manufactured(tokenId, factory);
    }

    function certified(uint256 tokenId) external view returns (bool) {
        return _certified[tokenId];
    }

    function certify(uint256 tokenId) external onlyActiveReseller whenNotPaused {
        require(ownerOf(tokenId) == msg.sender, "Must own watch to certify");
        require(!_certified[tokenId], "Already certified");

        _certified[tokenId] = true;
        emit Certified(tokenId, msg.sender);
    }
}
