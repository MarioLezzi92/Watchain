// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LuxuryCoin is ERC20 {
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;

    // Il costruttore riceve gli indirizzi a cui inviare i fondi iniziali
    constructor(address reseller, address consumer) ERC20("LuxuryCoin", "LUX") {
        uint256 distributed = 0;

        // Assegna 10.000 LUX al Reseller
        if (reseller != address(0)) {
            uint256 amount = 10_000 ether;
            _mint(reseller, amount);
            distributed += amount;
        }

        // Assegna 10.000 LUX al Consumer
        if (consumer != address(0)) {
            uint256 amount = 10_000 ether;
            _mint(consumer, amount);
            distributed += amount;
        }

        // Il resto va al Producer (chi esegue il deploy)
        _mint(msg.sender, INITIAL_SUPPLY - distributed);
    }
}